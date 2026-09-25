# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primario:** Mario, ciclista de carretera, que la usa para revisar su progresión y planificar sus próximas salidas.
- **Secundario:** cualquier ciclista puede crear cuenta (registro abierto desde la landing `/inicio`); en la práctica, la grupeta de Mario, cada uno con sus propios datos.
- **Terciario:** quien vea el proyecto como parte del portfolio de Mario. La app tiene que aguantar una revisión como trabajo propio y cuidado.

## Product Purpose

Registrar las salidas en bici (a mano, importando GPX o sincronizando con Strava), analizar el rendimiento (distancia, tiempo, desnivel, pulso medio y máximo, zonas de pulso) y ver cómo evoluciona con el tiempo. En la misma herramienta, trazar rutas en un mapa y exportarlas en GPX al ciclocomputador.

Éxito: que Mario y su grupeta la prefieran a Strava para revisar lo rodado y preparar lo que van a rodar, y que funcione como pieza de portfolio creíble.

## Positioning

Junta **lo rodado** (Salidas) y **lo que se va a rodar** (Rutas) en un solo sitio, y da de serie las métricas que Strava cobra: zonas de pulso, evolución y estimaciones a partir del perfil (FC máx., IMC, edad).

## Operating Context

- **Revisar progresión:** con calma, en escritorio o en el móvil. Resumen semanal o mensual, evolución, zonas de pulso y detalle de cada salida con mapa y perfil de altimetría.
- **Planificar la próxima:** sobre todo en el ordenador. Se marcan puntos en el mapa, se elige tipo de trazado (carretera, gravel, trekking o línea recta), se ven distancia y desnivel y se exporta un GPX para el ciclocomputador.
- **Entrada de datos:** Strava (OAuth y sincronización), GPX soltado sobre la app (si trae tiempos es una salida grabada; si no, una ruta) o formulario manual.
- **Disciplina principal:** carretera. El modelo también admite gravel, MTB, virtual y e-bike (`sportType`).

## Capabilities and Constraints

- **Secciones:** Resumen (`/`), Salidas (`/salidas`, `/salidas/:id`), Rutas (`/rutas`, `/rutas/nueva`, `/rutas/:id`) y Perfil (`/perfil`).
- **Terminología fija:** «Salidas» son las actividades ya hechas y «Rutas» las planificadas por hacer.
- **Stack:** Express 5 + Prisma/SQLite en el backend; React 19 + Vite + Tailwind v4 + Leaflet en el frontend. Autenticación con JWT y bcrypt. Los tokens de Strava van cifrados con AES-256-GCM.
- **Idioma de la interfaz:** español.
- **Datos opcionales:** pulso, desnivel, velocidad máxima y track GPS pueden faltar, así que toda vista tiene que funcionar sin ellos.
- **Rangos válidos:** frecuencia cardíaca entre 40 y 220 bpm; duraciones positivas.

## Brand Commitments

- **Nombre:** BikeTelemetry.
- **Dirección visual vinculante:** la de `CLAUDE.md` (paleta azul marino, tarjetas translúcidas, acentos de datos `dist`/`elev`/`hr`, animaciones sutiles).
- **Encargo del usuario:** que se sienta más real y menos «hecho por IA», sin alejarse de esa dirección.

## Evidence on Hand

- Actividades reales del usuario en `dev.db`, sincronizadas desde Strava o importadas por GPX.
- No hay testimonios, usuarios externos ni cifras de uso. No hay que inventarlos.

## Product Principles

1. **Los datos mandan.** Cada pantalla existe para que una cifra o un trazado se entienda antes; lo decorativo va después.
2. **Hecho y por hacer, siempre separados y conectados.** Salidas y Rutas son mundos distintos con puentes claros («repetir salida», importar GPX).
3. **Honestidad con los datos incompletos.** Si falta un dato se dice o se omite; nunca se rellena con estimaciones sin marcarlas como tales.
4. **Herramienta de ciclista, no demo.** Vocabulario y unidades del ciclismo de carretera (km, m+, bpm, km/h) y flujos que coinciden con cómo se entrena y se planifica de verdad.

## Accessibility & Inclusion

- Los colores de datos se validan para daltonismo y contraste sobre la tarjeta, y siempre van acompañados de etiqueta.
- Todas las animaciones respetan `prefers-reduced-motion`.
