# Contexto del Proyecto: BikeTelemetry / Cycling Analytics

Aplicación web personal para registrar entrenamientos y rutas en bicicleta, analizar métricas de rendimiento (pulsaciones medias/máximas, distancia, desnivel acumulado, tiempo, cadencia/potencia opcional) y visualizar la evolución a lo largo del tiempo.

---

## 🛠️ Stack Tecnológico
- **Backend:** Node.js + Express (JavaScript / TypeScript)
- **Base de Datos:** SQLite / PostgreSQL local (ORM/Query Builder: Prisma o Knex / pg)
- **Frontend:** HTML/Tailwind CSS con templates (o Astro / React según convención acordada)
- **Autenticación:** JWT o cookies de sesión (bcrypt para hashing de contraseñas)
- **Control de Versiones:** Git

---

## 💻 Comandos Frecuentes
- Arrancar en desarrollo: `npm run dev`
- Ejecutar migraciones/BD: `npx prisma migrate dev` (o script equivalente)
- Ejecutar tests: `npm test`
- Linter / Formato: `npm run lint`

---

## 📁 Convenciones de Arquitectura y Carpetas
Seguir un patrón por capas claro y desacoplado:

/src
  ├── /controllers   # Manejo de peticiones HTTP, validación y respuestas
  ├── /routes        # Definición de rutas y endpoints REST
  ├── /services      # Lógica de negocio (cálculo de promedios, zonas de pulso, etc.)
  ├── /models        # Esquemas de datos y acceso a base de datos
  ├── /middlewares   # Verificación de autenticación (authMiddleware) y errores
  └── server.js      # Punto de entrada de la aplicación

---

## 🔒 Reglas de Desarrollo y Buenas Prácticas
1. **Paso a paso e incremental:** No implementes múltiples módulos a la vez. Desarrolla y valida primero la base de datos y la autenticación antes de pasar a la visualización de rutas o métricas.
2. **Seguridad básica:**
   - Nunca almacenar contraseñas en texto plano; usar siempre hashing con salt (bcrypt / argon2).
   - Proteger los endpoints privados mediante el middleware de autenticación.
   - Usar variables de entorno (`.env`) para secrets (JWT_SECRET, puertos, credenciales de BD) y no comitearlas al repositorio.
3. **Manejo de Errores:**
   - Devolver respuestas JSON uniformes (`{ "error": "Mensaje descriptivo" }`) con los códigos de estado HTTP adecuados (400, 401, 403, 404, 500).
4. **Validación de Datos:**
   - Validar los datos de entrada antes de guardarlos (duraciones positivas, fechas válidas, rangos lógicos de frecuencia cardíaca, ej. 40-220 bpm).
5. **No romper código existente:** Antes de modificar un archivo, comprueba las funciones y modelos actuales para evitar duplicar lógica o renombrar imports.
## 🎨 Dirección de Diseño (UI/UX)
- **Estética:** Moderna y elegante, inspirada en Apple / shadcn/ui, con un punto llamativo pero sin excesos.
- **Paleta azul marino** (tokens en `frontend/src/index.css`, bloque `@theme`):
  - Fondo `#0a1024` con degradado y aurora animada (`components/Backdrop.jsx`).
  - La escala `zinc` de Tailwind está redefinida en tonos azul marino: usar `bg-zinc-900/70` (tarjetas), `border-zinc-800` (bordes), `text-zinc-100` (texto), `text-zinc-400` (etiquetas), `text-zinc-500` (terciario). No usar `neutral`/`slate`/`gray`.
  - Marca: degradado azul → cian (`from-brand to-brand-2`) para el botón principal y detalles destacados.
  - Acentos de datos: `dist` azul (distancia/velocidad), `elev` ámbar (desnivel), `hr` coral magenta (pulso); zonas `zone-1`…`zone-5`. Van en marcas e iconos, nunca como color de texto, y siempre con etiqueta.
  - Colores usados desde JS (mapas, gráficos) en `frontend/src/lib/theme.js`, alineados con los tokens.
  - Cualquier color de datos nuevo se valida para daltonismo y contraste sobre la tarjeta (`#101832`) antes de usarlo.
- **Componentes:** Tarjetas con borde fino, fondo translúcido y `backdrop-blur-md`; tipografía del sistema; cifras en `text-3xl font-semibold tracking-tight` y etiquetas en `text-xs font-medium uppercase tracking-wider text-zinc-400`.
- **Animaciones:** Sutiles y cortas (≈300–600 ms, curvas suaves): `animate-page-in`, `.stagger` con `--i` para entradas escalonadas, `animate-grow-x`/`.grow-y` en barras, `useCountUp` en KPIs. Siempre deben respetar `prefers-reduced-motion` (regla global en `index.css`).
- **Herramienta de estilos:** Tailwind CSS v4.
