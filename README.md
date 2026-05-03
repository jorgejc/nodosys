# 🚀 NodoSys — Guía de Configuración Fase 0

> **Sistema Integral de Gestión · Nodo Arboletes · IU Digital**  
> Para Jorge Enlace — Guía completa paso a paso

---

## ¿Qué vamos a hacer en la Fase 0?

Antes de escribir una sola línea de código funcional, necesitamos
preparar el "taller de trabajo": instalar herramientas, crear la
estructura del proyecto y conectar la base de datos.

Piénsalo así: antes de construir una casa, preparas los cimientos.
Eso es la Fase 0.

---

## PASO 1 — Instalar pnpm (gestor de paquetes)

`npm` (que ya tienes) instala paquetes individualmente.
`pnpm` es más rápido, ahorra espacio en disco y es perfecto
para proyectos con múltiples aplicaciones (monorepos).

Abre tu terminal y ejecuta:

```bash
npm install -g pnpm
```

Verifica que se instaló:

```bash
pnpm --version
# Deberías ver algo como: 9.x.x
```

---

## PASO 2 — Instalar NestJS CLI globalmente

El CLI (Command Line Interface) de NestJS te permite crear
módulos, servicios, controladores con comandos rápidos.

```bash
pnpm install -g @nestjs/cli
```

Verifica:

```bash
nest --version
# Deberías ver algo como: 10.x.x
```

---

## PASO 3 — Clonar/Copiar la estructura del proyecto

Mueve la carpeta `nodosys` (que descargaste) a donde quieras
tener el proyecto. Ejemplo:

```
C:\Users\TuUsuario\Proyectos\nodosys\
```

O en Mac/Linux:

```
~/Proyectos/nodosys/
```

Luego abre esa carpeta en VS Code:

```bash
code nodosys
```

---

## PASO 4 — Instalar dependencias del proyecto

Desde la raíz del proyecto (`nodosys/`), ejecuta:

```bash
pnpm install
```

pnpm leerá el `pnpm-workspace.yaml` e instalará las dependencias
de TODOS los proyectos (backend Y frontend) a la vez. Espera
unos minutos la primera vez.

---

## PASO 5 — Crear la base de datos en PostgreSQL

Ya tienes PostgreSQL 16 instalado en tu computador.
Necesitamos crear la base de datos para NodoSys.

### Opción A: Usando psql (terminal de PostgreSQL)

```bash
# Entrar a PostgreSQL como administrador
psql -U postgres

# Dentro de psql, crear la base de datos
CREATE DATABASE nodosys_dev;

# Salir de psql
\q
```

### Opción B: Usando pgAdmin (interfaz gráfica)

1. Abre pgAdmin
2. Clic derecho en "Databases" → Create → Database
3. Name: `nodosys_dev`
4. Clic Save

### Ejecutar el esquema (crear las tablas)

Una vez creada la BD, ejecuta el archivo `schema.sql`:

```bash
psql -U postgres -d nodosys_dev -f apps/backend/src/database/schema.sql
```

Si todo sale bien, verás al final:
```
NodoSys schema creado exitosamente 🚀
```

---

## PASO 6 — Configurar variables de entorno del backend

Las variables de entorno guardan información sensible (contraseñas, claves)
FUERA del código fuente. Nunca se suben a GitHub.

```bash
# Entra a la carpeta del backend
cd apps/backend

# Copia el archivo de ejemplo
cp .env.example .env
```

Abre el archivo `.env` y edítalo con tus datos reales:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=TU_CONTRASEÑA_DE_POSTGRES_AQUI
DB_NAME=nodosys_dev

JWT_SECRET=nodosys_jorge_arboletes_2026_secreto_super_largo
JWT_EXPIRES_IN=7d

PORT=3001
NODE_ENV=development
```

**¿Dónde encuentro mi contraseña de PostgreSQL?**
Es la que pusiste cuando instalaste PostgreSQL en tu computador.
Si no la recuerdas, puedes resetearla o crear un usuario nuevo.

---

## PASO 7 — Configurar variables de entorno del frontend

```bash
# Desde la raíz del proyecto
cd apps/frontend
cp .env.example .env
```

El archivo `.env` del frontend no necesita cambios para desarrollo local.

---

## PASO 8 — Arrancar el proyecto

Vuelve a la raíz del proyecto y ejecuta:

```bash
# Terminal 1: arrancar el backend
pnpm dev:backend

# Terminal 2 (nueva terminal): arrancar el frontend
pnpm dev:frontend
```

O en una sola terminal (con concurrently):

```bash
pnpm dev
```

### ¿Cómo saber si funciona?

**Backend (NestJS):**
- Abre: http://localhost:3001/api/health
- Deberías ver: `{"status":"ok","system":"NodoSys","nodo":"Arboletes"}`
- Documentación API: http://localhost:3001/api/docs

**Frontend (React):**
- Abre: http://localhost:5173
- Deberías ver la pantalla de "NodoSys - en construcción"

---

## PASO 9 — Crear cuenta en Supabase (storage de fotos)

Para guardar las fotos de evidencia necesitamos Supabase.

1. Ve a: https://supabase.com
2. Clic en "Start your project" → Crea cuenta con GitHub o Google
3. Crea un nuevo proyecto:
   - Name: `nodosys`
   - Database Password: guarda esta contraseña
   - Region: São Paulo (más cercano a Colombia)
4. Espera ~2 minutos a que cree el proyecto
5. Ve a: Settings → API
6. Copia:
   - `Project URL` → pega en `SUPABASE_URL` del `.env`
   - `anon public` key → pega en `SUPABASE_ANON_KEY`
   - `service_role` key → pega en `SUPABASE_SERVICE_KEY`

Por ahora con esto basta para la Fase 0. El storage lo configuramos
en la Fase 3 cuando lleguemos a las fotos de evidencia.

---

## PASO 10 — Configurar GitHub

Guarda tu proyecto en GitHub para no perder nada.

```bash
# Inicializar repositorio git (desde la raíz del proyecto)
git init
git add .
git commit -m "feat: fase 0 - estructura base del proyecto NodoSys"

# Crear repositorio en github.com y conectarlo:
git remote add origin https://github.com/TU_USUARIO/nodosys.git
git branch -M main
git push -u origin main
```

---

## Estructura de carpetas resultado

```
nodosys/
├── apps/
│   ├── backend/               ← API NestJS
│   │   ├── src/
│   │   │   ├── config/        ← Configuración (BD, JWT...)
│   │   │   ├── database/      ← Esquema SQL, migraciones
│   │   │   ├── modules/       ← Aquí irán: auth, inventory, work-plan...
│   │   │   ├── app.module.ts  ← Módulo raíz
│   │   │   └── main.ts        ← Arranque del servidor
│   │   ├── .env               ← Variables de entorno (NO subir a GitHub)
│   │   └── package.json
│   │
│   └── frontend/              ← App React
│       ├── src/
│       │   ├── components/    ← Componentes reutilizables
│       │   ├── pages/         ← Páginas (Dashboard, Inventario...)
│       │   ├── hooks/         ← Hooks personalizados
│       │   ├── stores/        ← Estado global (Zustand)
│       │   ├── services/      ← Llamadas a la API
│       │   ├── types/         ← Tipos TypeScript
│       │   ├── App.tsx        ← Rutas
│       │   └── main.tsx       ← Punto de entrada
│       └── package.json
│
├── pnpm-workspace.yaml        ← Conecta los dos proyectos
├── package.json               ← Scripts raíz
└── .gitignore                 ← Archivos que NO van a GitHub
```

---

## Si algo falla — Soluciones comunes

**Error: "Cannot connect to PostgreSQL"**
→ Verifica que PostgreSQL esté corriendo
→ En Windows: Servicios → PostgreSQL 16 → Iniciar
→ Verifica la contraseña en el `.env`

**Error: "Port 3001 already in use"**
→ Otro proceso usa ese puerto
→ Cambia `PORT=3002` en el `.env` del backend

**Error: "pnpm: command not found"**
→ Cierra y abre el terminal de nuevo después de instalar pnpm

---

## ¿Qué sigue después de la Fase 0?

Con la Fase 0 completa, en la **Fase 1** construimos:
- Login y registro de usuarios
- Autenticación con JWT
- Layout base del sistema (sidebar, navbar)

---

*NodoSys · Nodo Arboletes · IU Digital · Jorge Enlace · 2026*
