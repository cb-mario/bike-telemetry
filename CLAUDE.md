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
- **Estética:** Moderna y sobria, inspirada en Apple / shadcn/ui: un panel de instrumentos de ciclista, no un SaaS de escaparate. Nada de brillos, cristal decorativo ni degradados de adorno.
- **Paleta azul marino** (tokens en `frontend/src/index.css`, bloque `@theme`):
  - Fondo `#0a1024` liso con una luz cenital tenue y estática (`components/Backdrop.jsx`).
  - La escala `zinc` de Tailwind está redefinida en tonos azul marino: usar `bg-zinc-900` (tarjetas), `border-zinc-800` (bordes), `text-zinc-100` (texto), `text-zinc-400` (etiquetas), `text-zinc-500` (terciario). No usar `neutral`/`slate`/`gray`.
  - Marca: `brand` (#2563eb, sólido) para el botón principal; `brand-2` (cian) solo para indicadores activos, foco y cursor. Sin texto en degradado.
  - Acentos de datos: `dist` azul (distancia/velocidad), `elev` ámbar (desnivel), `hr` coral magenta (pulso); zonas `zone-1`…`zone-5`. Van en marcas e iconos, nunca como color de texto, y siempre con etiqueta.
  - Colores usados desde JS (mapas, gráficos) en `frontend/src/lib/theme.js`, alineados con los tokens.
  - Cualquier color de datos nuevo se valida para daltonismo y contraste sobre la tarjeta (`#101832`) antes de usarlo.
- **Componentes:** Tarjetas sólidas (`bg-zinc-900`) con borde fino; el desenfoque solo en superficies que flotan sobre contenido (cabecera fija, panel sobre el mapa). Hover = cambio de borde, sin elevar ni brillar. Varias métricas juntas van en un panel con filetes (`grid gap-px bg-zinc-800`, celdas `bg-zinc-900`), no en tarjetas sueltas ni anidadas. Tipografía del sistema; cifras en `text-3xl font-semibold tracking-tight tabular-nums` y etiquetas de datos en `text-xs font-medium uppercase tracking-wider text-zinc-400` con marca de color `h-3 w-0.5`. Etiquetas de formulario en minúscula (`text-[13px] font-medium text-zinc-300`); sin antetítulos sobre los títulos. Iconos con `components/ui/Icon.jsx`, nunca glifos Unicode.
- **Animaciones:** Sutiles y cortas (≈150–450 ms, ease-out): `animate-page-in`, `.stagger` con `--i` para entradas escalonadas, `animate-grow-x`/`.grow-y` en barras, `useCountUp` en KPIs. Sin animaciones en bucle ni decorativas. Siempre deben respetar `prefers-reduced-motion` (regla global en `index.css`).
- **Herramienta de estilos:** Tailwind CSS v4.
- **shadcn/ui (adopción parcial, base Base UI, `frontend/components.json`):** solo para lo que no teníamos: `select`, `alert-dialog`, `dropdown-menu`, `tooltip` (en `components/ui/`, en minúscula). `Button`, `Card`, `Dialog`, `Field` y los gráficos siguen siendo propios. Los tokens semánticos (`--background`, `--card`, `--primary`, `--muted-foreground`…) están asignados a la paleta azul marino en `:root` de `index.css`; la app es solo oscura (`class="dark"` en `<html>`). `alert-dialog.jsx` está adaptado a mano para usar nuestro `Button`: no instalar el `button` de shadcn (choca con `Button.jsx` en macOS). Clases condicionales con `cn` (paquete `cn`) e imports con el alias `@/`.
