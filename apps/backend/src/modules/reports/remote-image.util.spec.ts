/**
 * remote-image.util.spec.ts — Blindaje anti-SSRF de la descarga de la firma
 *
 * Estos casos NO tocan la red: se rechazan por protocolo/puerto antes de
 * abrir el socket, o por el hook `lookup` al resolver una IP interna
 * (dns.lookup sobre una IP literal la devuelve sin consultar a nadie).
 */
import { fetchImageAsDataUri } from './remote-image.util';

describe('fetchImageAsDataUri — protección SSRF', () => {
  it('devuelve null si no hay URL', async () => {
    await expect(fetchImageAsDataUri(null)).resolves.toBeNull();
    await expect(fetchImageAsDataUri(undefined)).resolves.toBeNull();
    await expect(fetchImageAsDataUri('')).resolves.toBeNull();
  });

  it.each([
    ['http (sin cifrar)',      'http://example.com/firma.png'],
    ['file://',                'file:///etc/passwd'],
    ['data: URI',              'data:image/png;base64,iVBORw0KGgo='],
    ['gopher://',              'gopher://example.com/1'],
    ['texto que no es URL',    'no-soy-una-url'],
  ])('rechaza %s', async (_label, url) => {
    await expect(fetchImageAsDataUri(url)).resolves.toBeNull();
  });

  it('rechaza puertos distintos de 443', async () => {
    await expect(fetchImageAsDataUri('https://example.com:8080/firma.png')).resolves.toBeNull();
  });

  it.each([
    ['loopback',                     'https://127.0.0.1/firma.png'],
    ['loopback alterno',             'https://127.127.1.1/firma.png'],
    ['metadata de la nube',          'https://169.254.169.254/latest/meta-data/'],
    ['red privada 10/8',             'https://10.0.0.5/firma.png'],
    ['red privada 172.16/12',        'https://172.16.31.9/firma.png'],
    ['red privada 192.168/16',       'https://192.168.1.10/firma.png'],
    ['CGNAT 100.64/10',              'https://100.64.0.1/firma.png'],
    ['this-network 0.0.0.0/8',       'https://0.0.0.0/firma.png'],
    ['IPv6 loopback',                'https://[::1]/firma.png'],
    ['IPv6 unique-local',            'https://[fd00::1]/firma.png'],
    ['IPv6 link-local',              'https://[fe80::1]/firma.png'],
    ['IPv4 privada mapeada en IPv6', 'https://[::ffff:10.0.0.1]/firma.png'],
  ])('bloquea destino interno: %s', async (_label, url) => {
    await expect(fetchImageAsDataUri(url)).resolves.toBeNull();
  }, 15_000);
});
