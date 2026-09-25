---
version: 1
slug: "frontend-src-pages-landingpage-jsx"
primary_target: "frontend/src/pages/LandingPage.jsx"
related_targets: []
---

# Landing /inicio

Scope: página pública previa al registro, ruta `/inicio` (sin sesión). Modo: **Persuade**. Build: code-led (sin generación de imágenes).

Audiencia: cualquier ciclista (sobre todo de carretera) que ya graba salidas en Strava o en GPX. Acción: crear cuenta (`/registro`); secundaria: entrar (`/`).
Prueba: la propia interfaz con datos de ejemplo etiquetados; sin testimonios, usuarios ni cifras de uso inventadas.
Restricciones: mundo visual fijo de CLAUDE.md (azul marino, tarjetas sólidas, paneles con filetes, tipografía del sistema, acentos dist/elev/hr); estructura pedida por el usuario: navbar, hero con CTA y mockup, 3–4 funciones con icono, 3 pasos, CTA final, footer.

## Direction contract

THESIS: la landing es el instrumento funcionando, no un folleto: el hero enseña una salida de ejemplo analizada con los componentes reales de la app. Rechaza el hero centrado con blob de color, captura inclinada y tres tarjetas de icono genéricas.
OWN-WORLD: fondo #0a1024 liso con luz cenital fija; superficies sólidas zinc-900 con borde zinc-800; paneles de lecturas con filetes de 1 px; marcas de color de 2 px (dist azul, elev ámbar, hr magenta); botón principal azul sólido; cifras tabulares; iconos lucide de trazo.
STORY: el visitante ve una salida real de carretera desmenuzada (km, desnivel, pulso, zonas, perfil), entiende que junta lo rodado y lo que va a rodar, y crea cuenta.
FIRST VIEWPORT: escritorio en dos columnas 5/7: izquierda titular de 2 líneas (text-5xl/6xl), subtítulo y CTA «Crear cuenta» + «Ya tengo cuenta»; derecha el panel de la salida de ejemplo (lecturas, mapa del bucle, perfil de altitud) a escala real. Móvil: texto y CTA primero, panel debajo.
FORM: extensión de superficie dentro de un mundo establecido; estructura fijada por el brief del usuario; sin concept-seed (petición precisa). Seed key: n/a. Interacción firma: pasar el cursor/dedo por el perfil de altitud mueve el punto sobre el trazado del mapa, como en el detalle de salida real.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
