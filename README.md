# BikeTelemetry

Aplicación web para registrar salidas en bici, analizar el rendimiento y planificar las próximas rutas. Junta en un solo sitio **lo rodado** (Salidas) y **lo que se va a rodar** (Rutas).

## Funciones

- **Salidas:** alta manual, importación de archivos GPX (distancia, desnivel, tiempo en movimiento y pulso se calculan solos) y sincronización con Strava.
- **Resumen:** última salida con su recorrido, el mes en curso comparado con el mismo tramo del anterior, histórico total y evolución por semanas o meses.
- **Zonas de pulso:** cinco zonas a partir de la FC máxima indicada, la mayor registrada o la estimada por edad.
- **Detalle de salida:** mapa del recorrido y perfil de altitud enlazados (al pasar el cursor por el perfil se sitúa el punto en el mapa).
- **Rutas:** trazado sobre el mapa ajustado a carretera, gravel o caminos, con perfil, tiempo estimado y exportación a GPX para el ciclocomputador. Cualquier salida se puede «repetir» como ruta.
- **Cuentas:** email y contraseña, o acceso con Strava y con Google.

## Stack

| Parte | Tecnologías |
|---|---|
| Backend | Node.js, Express 5, Prisma + SQLite |
| Autenticación | JWT, bcrypt, OAuth 2.0 (Strava y Google); tokens de Strava cifrados con AES-256-GCM |
| Frontend | React 19, Vite, React Router, Tailwind CSS v4, Leaflet, Base UI |
| Tests | `node:test` |

## Puesta en marcha

Requisitos: Node.js 22 o superior.

```bash
# Backend (raíz del proyecto)
npm install
cp .env.example .env        # rellena JWT_SECRET y, si los usas, Strava y Google
npx prisma migrate dev      # crea la base de datos SQLite
npm run dev                 # API en http://localhost:3000

# Frontend (otra terminal)
cd frontend
npm install
npm run dev                 # app en http://localhost:5173 (redirige /api al backend)
```

Las integraciones son opcionales: sin credenciales de Strava o Google la app funciona con email y contraseña e importación de GPX. Las variables de entorno están descritas en `.env.example`.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Backend con recarga automática |
| `npm test` | Tests del backend (usan una base de datos aparte) |
| `npm run lint` | Linter del backend (oxlint) |
| `npm run db:migrate` | Aplica las migraciones de Prisma |
| `npm run db:studio` | Explorador de la base de datos |
| `cd frontend && npm run build` | Build de producción del frontend |
| `cd frontend && npm run lint` | Linter del frontend (oxlint) |

## Estructura

```
src/                 Backend
  routes/            Endpoints REST
  controllers/       Validación de peticiones y respuestas
  services/          Lógica de negocio (estadísticas, zonas, GPX, Strava, rutas)
  models/            Acceso a datos con Prisma
  middlewares/       Autenticación y gestión de errores
prisma/              Esquema y migraciones
tests/               Tests de la API
frontend/src/
  pages/             Pantallas (Resumen, Salidas, Rutas, Perfil, landing)
  components/        Componentes de la interfaz
  lib/               Cliente de la API, formato, geometría y utilidades
docs/                Documentación del proyecto
```

La guía visual de la interfaz (paleta, tipografía, componentes) está en [docs/sistema-de-diseno.md](docs/sistema-de-diseno.md).
