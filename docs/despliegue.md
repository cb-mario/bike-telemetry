# Despliegue: Vercel + Supabase

La app se publica en **Vercel**: el frontend como estático y la API de Express como una única función serverless (`api/index.js`). La base de datos es PostgreSQL en **Supabase**. Ambos en el plan gratuito.

Cómo encaja todo (`vercel.json`):

- `/api/*` → función `api/index.js` (Express recibe la ruta original).
- Cualquier otra ruta → `frontend/dist/index.html` (la SPA resuelve la página).
- En cada despliegue se aplican las migraciones pendientes (`prisma migrate deploy`) y se compila el frontend.
- Un cron diario llama a `/api/health/db` para que Supabase no pause el proyecto por inactividad (lo hace tras 7 días sin uso en el plan gratuito).

## 1. Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com) (región: *West EU (Paris)* o *Central EU (Frankfurt)*). Guarda la contraseña de la base de datos.
2. En **Connect** copia dos cadenas de conexión y sustituye `[YOUR-PASSWORD]`:
   - **Transaction pooler** (puerto **6543**) → será `DATABASE_URL`. Añádele al final `?sslmode=require&uselibpqcompat=true`.
   - **Session pooler** (puerto **5432**) → será `DIRECT_URL`. Añádele `?sslmode=require`.

Las tablas se crean solas en el primer despliegue. No hace falta tocar nada más en Supabase.

## 2. Vercel

1. Entra en [vercel.com](https://vercel.com) con tu cuenta de GitHub → **Add New… → Project** → importa `cycling-stats`.
2. Deja *Framework Preset* en **Other** y el *Root Directory* en la raíz. El resto lo toma de `vercel.json`.
3. Añade las variables de entorno (**Settings → Environment Variables**):

| Variable | Valor |
|---|---|
| `DATABASE_URL` | Transaction pooler de Supabase (paso 1) |
| `DIRECT_URL` | Session pooler de Supabase (paso 1) |
| `JWT_SECRET` | Una cadena larga y aleatoria: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `FRONTEND_URL` | `https://TU-PROYECTO.vercel.app` (sin barra final) |
| `TRUST_PROXY` | `1` |
| `NODE_ENV` | `production` |

4. **Deploy**. Cuando termine, abre `https://TU-PROYECTO.vercel.app/api/health/db`: debe responder `{"status":"ok"}`.

Opcionales, según lo que quieras activar:

| Para… | Variables |
|---|---|
| Recuperar contraseña por correo | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` (ver abajo) |
| Strava | `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_REDIRECT_URI=https://TU-PROYECTO.vercel.app/api/strava/callback`, `TOKEN_ENCRYPTION_KEY` |
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI=https://TU-PROYECTO.vercel.app/api/auth/google/callback` |
| Search Console | `VITE_GOOGLE_SITE_VERIFICATION` (ver paso 4) |

Cada cambio de variables necesita un nuevo despliegue (**Deployments → ⋯ → Redeploy**).

### Correo (recuperar contraseña)

Sin SMTP la app funciona, pero el enlace de recuperación solo se escribe en los logs de Vercel. Con Gmail:

1. Activa la verificación en dos pasos de tu cuenta de Google.
2. Crea una **contraseña de aplicación** en [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
3. `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER=tu@gmail.com`, `SMTP_PASS=<la contraseña de aplicación>`, `MAIL_FROM="BikeTelemetry <tu@gmail.com>"`.

### Strava y Google

- **Strava** ([strava.com/settings/api](https://www.strava.com/settings/api)): cambia *Authorization Callback Domain* a `TU-PROYECTO.vercel.app`.
- **Google Cloud Console** → Credenciales → tu cliente OAuth: añade `https://TU-PROYECTO.vercel.app/api/auth/google/callback` a los URI de redirección autorizados.

## 3. Mapas

Las teselas por defecto son de Stadia Maps, que sin clave solo funcionan en `localhost`. Crea una cuenta gratuita en [stadiamaps.com](https://stadiamaps.com) y añade `TU-PROYECTO.vercel.app` en **Authentication → Domains**. No hace falta ninguna variable.

## 4. Que aparezca en Google

El build ya genera lo necesario a partir del dominio de producción de Vercel: título y descripción, vista previa al compartir (`og-image.png`), `robots.txt` y `sitemap.xml` con las páginas públicas (`/inicio`, `/`, `/registro`). Si usas un dominio propio, define `VITE_SITE_URL=https://tudominio.com`.

1. Entra en [Google Search Console](https://search.google.com/search-console) → **Añadir propiedad → Prefijo de la URL** → `https://TU-PROYECTO.vercel.app`.
2. Método **Etiqueta HTML**: copia solo el valor de `content="…"` en la variable `VITE_GOOGLE_SITE_VERIFICATION` de Vercel, vuelve a desplegar y pulsa **Verificar**.
3. **Sitemaps** → envía `sitemap.xml`.
4. **Inspección de URLs** → `https://TU-PROYECTO.vercel.app/inicio` → **Solicitar indexación**.

Google tarda entre unos días y un par de semanas en mostrarla. Para el portfolio enlaza a `/inicio`, que es la landing.

## Límites del plan gratuito

- Las peticiones a la API no pueden superar **4,5 MB** (afecta solo a GPX muy grandes) ni durar más de **60 s**. Una primera importación de Strava con muchos años de salidas podría cortarse; basta con volver a sincronizar y continúa donde lo dejó.
- El límite de intentos de acceso se guarda en memoria y cada instancia de la función tiene el suyo, así que protege algo menos que en un servidor fijo.
- Tras un rato sin visitas, la primera petición tarda 1–2 s más (arranque en frío).

## Si algo falla

- **El build falla en `prisma migrate deploy`**: revisa `DIRECT_URL` (puerto 5432, contraseña sin `[ ]`).
- **`self-signed certificate in certificate chain`** en los logs: a `DATABASE_URL` le falta `&uselibpqcompat=true`.
- **La API responde 500 nada más arrancar**: los logs de la función (**Deployments → Functions**) dicen qué variable falta.
- **El login con Strava/Google vuelve a localhost**: revisa `FRONTEND_URL` y las `*_REDIRECT_URI`.
