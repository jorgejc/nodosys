/**
 * remote-image.util.ts — Descarga segura de imágenes remotas para los PDF
 *
 * pdfmake NO descarga imágenes por URL: necesita base64 o una ruta local.
 * La firma del enlace se guarda como URL, así que hay que traerla al vuelo.
 *
 * Traer una URL controlada por el usuario desde el servidor es un SSRF de
 * manual (el atacante haría que el backend consulte servicios internos:
 * metadata de la nube, bases de datos, panel de admin en localhost...).
 * Por eso esta función aplica, en este orden:
 *
 *   1. Solo https (nada de http, file://, gopher://, data:...)
 *   2. Puerto 443 únicamente
 *   3. Validación de la IP en DOS frentes:
 *        a) si el host ya es una IP literal (https://169.254.169.254/...),
 *           se comprueba antes de abrir el socket — Node NO invoca el hook
 *           `lookup` en ese caso y conectaría directo
 *        b) si es un dominio, se valida dentro del hook `lookup`, o sea EN EL
 *           MOMENTO DE CONECTAR: así un DNS rebinding no puede colar una IP
 *           privada entre la comprobación y la conexión (TOCTOU)
 *   4. Redirecciones seguidas a mano, máximo 3, revalidando cada salto
 *   5. Timeout corto (5 s) y presupuesto total de tiempo (10 s)
 *   6. Límite de tamaño (2 MB) por Content-Length y por bytes recibidos
 *   7. Content-Type de imagen + comprobación de los magic bytes reales
 *      (PNG/JPEG, que son los formatos que soporta pdfmake)
 *
 * Nunca lanza: si algo falla devuelve null y el PDF sale con la línea de
 * firma vacía. Un certificado sin imagen es un problema de trámite; una
 * excepción no controlada tumbaría la generación entera.
 */
import { Logger } from '@nestjs/common';
import * as https from 'https';
import * as dns from 'dns';
import * as net from 'net';
import { URL } from 'url';

const log = new Logger('RemoteImage');

const MAX_BYTES        = 2 * 1024 * 1024;  // 2 MB
const SOCKET_TIMEOUT   = 5_000;            // 5 s por salto
const TOTAL_BUDGET_MS  = 10_000;           // 10 s en total
const MAX_REDIRECTS    = 3;

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg']);

// ── Rangos IP que jamás deben alcanzarse desde el servidor ──
/** ¿Es una IPv4 privada, loopback, link-local, CGNAT, multicast o reservada? */
function isBlockedIPv4(ip: string): boolean {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;

  if (a === 0)   return true;                        // 0.0.0.0/8   "this network"
  if (a === 10)  return true;                        // 10/8        privada
  if (a === 127) return true;                        // 127/8       loopback
  if (a === 169 && b === 254) return true;           // 169.254/16  link-local (metadata cloud)
  if (a === 172 && b >= 16 && b <= 31) return true;  // 172.16/12   privada
  if (a === 192 && b === 168) return true;           // 192.168/16  privada
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10   CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18/15 benchmarking
  if (a === 192 && b === 0)   return true;           // 192.0.0/24 + 192.0.2/24
  if (a === 198 && b === 51)  return true;           // 198.51.100/24 doc
  if (a === 203 && b === 0)   return true;           // 203.0.113/24  doc
  if (a >= 224)  return true;                        // 224/4 multicast + 240/4 reservada
  return false;
}

/** ¿Es una IPv6 loopback, ULA, link-local, o una IPv4 privada mapeada? */
function isBlockedIPv6(ip: string): boolean {
  const addr = ip.toLowerCase().split('%')[0];       // quita el scope (fe80::1%eth0)

  if (addr === '::1' || addr === '::') return true;

  // IPv4 mapeada en forma decimal: ::ffff:10.0.0.1
  const mappedDotted = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedDotted) return isBlockedIPv4(mappedDotted[1]);

  // IPv4 mapeada en forma hexadecimal: ::ffff:a00:1
  // (new URL() normaliza así, hay que reconstruir la IPv4 para validarla)
  const mappedHex = addr.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16);
    const lo = parseInt(mappedHex[2], 16);
    return isBlockedIPv4(`${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`);
  }

  // IPv4 compatible (::10.0.0.1), obsoleta: se bloquea sin más
  if (/^::\d+\.\d+\.\d+\.\d+$/.test(addr)) return true;

  const head = parseInt(addr.split(':')[0] || '0', 16);
  if ((head & 0xfe00) === 0xfc00) return true;       // fc00::/7  unique local
  if ((head & 0xffc0) === 0xfe80) return true;       // fe80::/10 link-local
  if ((head & 0xff00) === 0xff00) return true;       // ff00::/8  multicast
  return false;
}

function isBlockedAddress(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) return isBlockedIPv4(ip);
  if (version === 6) return isBlockedIPv6(ip);
  return true;   // no es una IP reconocible → bloquear
}

/**
 * `lookup` propio para el socket: resuelve el DNS y rechaza la conexión si
 * la IP resultante es interna. Al ser la MISMA resolución que usa el socket
 * para conectarse, no hay ventana de DNS rebinding.
 */
const guardedLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, options as dns.LookupOneOptions, (err, address, family) => {
    if (err) return callback(err, '', 0);
    if (isBlockedAddress(address)) {
      log.warn(`SSRF bloqueado: ${hostname} resuelve a la IP interna ${address}`);
      return callback(
        new Error(`Destino no permitido: ${hostname} apunta a una red interna`),
        '', 0,
      );
    }
    callback(null, address, family);
  }) as unknown as void;
};

/** ¿Los bytes son realmente un PNG o un JPEG? (no confiamos en el header) */
function sniffImageMime(buf: Buffer): string | null {
  if (buf.length >= 8 &&
      buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return 'image/png';
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  return null;
}

/** Un salto: descarga o devuelve la URL de redirección. */
function fetchOnce(
  rawUrl: string,
  deadline: number,
): Promise<{ buffer: Buffer } | { redirectTo: string }> {
  return new Promise((resolve, reject) => {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      return reject(new Error('URL inválida'));
    }

    if (url.protocol !== 'https:') {
      return reject(new Error(`Protocolo no permitido: ${url.protocol} (solo https)`));
    }
    if (url.port && url.port !== '443') {
      return reject(new Error(`Puerto no permitido: ${url.port} (solo 443)`));
    }

    // Node NO llama al hook `lookup` cuando el host ya es una IP literal
    // (https://169.254.169.254/...): conectaría directo. Hay que validarla aquí.
    const literalHost = url.hostname.replace(/^\[|\]$/g, '');
    if (net.isIP(literalHost) && isBlockedAddress(literalHost)) {
      log.warn(`SSRF bloqueado: IP interna literal ${literalHost}`);
      return reject(new Error(`Destino no permitido: ${literalHost} es una red interna`));
    }

    const remaining = deadline - Date.now();
    if (remaining <= 0) return reject(new Error('Tiempo agotado'));

    const req = https.get(
      url,
      {
        lookup: guardedLookup,
        timeout: Math.min(SOCKET_TIMEOUT, remaining),
        headers: { Accept: 'image/png,image/jpeg', 'User-Agent': 'NodoSys/1.0' },
        // No mandamos cookies ni credenciales: es una descarga anónima
      },
      (res) => {
        const status = res.statusCode ?? 0;

        // Redirección → la resuelve el llamador, revalidando todo de nuevo
        if (status >= 300 && status < 400 && res.headers.location) {
          res.destroy();
          return resolve({ redirectTo: new URL(res.headers.location, url).toString() });
        }

        if (status !== 200) {
          res.destroy();
          return reject(new Error(`HTTP ${status}`));
        }

        const mime = (res.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
        if (!ALLOWED_MIME.has(mime)) {
          res.destroy();
          return reject(new Error(`Content-Type no permitido: ${mime || '(vacío)'}`));
        }

        const declared = Number(res.headers['content-length'] ?? 0);
        if (declared > MAX_BYTES) {
          res.destroy();
          return reject(new Error(`Imagen demasiado grande: ${declared} bytes`));
        }

        const chunks: Buffer[] = [];
        let received = 0;

        res.on('data', (chunk: Buffer) => {
          received += chunk.length;
          if (received > MAX_BYTES) {          // corta aunque mintiera el header
            res.destroy();
            return reject(new Error(`Imagen supera el límite de ${MAX_BYTES} bytes`));
          }
          chunks.push(chunk);
        });
        res.on('end',   () => resolve({ buffer: Buffer.concat(chunks) }));
        res.on('error', reject);
      },
    );

    req.on('timeout', () => { req.destroy(new Error('Timeout de conexión')); });
    req.on('error', reject);
  });
}

/**
 * Descarga una imagen remota y la devuelve como data URI listo para pdfmake.
 * Devuelve null ante cualquier problema (nunca lanza).
 */
export async function fetchImageAsDataUri(rawUrl: string | null | undefined): Promise<string | null> {
  if (!rawUrl) return null;

  const deadline = Date.now() + TOTAL_BUDGET_MS;
  let current = rawUrl;

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const result = await fetchOnce(current, deadline);

      if ('redirectTo' in result) {
        current = result.redirectTo;
        continue;
      }

      const mime = sniffImageMime(result.buffer);
      if (!mime) {
        log.warn('La firma descargada no es un PNG/JPEG válido — se omite');
        return null;
      }
      return `data:${mime};base64,${result.buffer.toString('base64')}`;
    }

    log.warn(`Demasiadas redirecciones al descargar la firma (${rawUrl})`);
    return null;
  } catch (err) {
    log.warn(`No se pudo descargar la firma: ${(err as Error).message}`);
    return null;
  }
}
