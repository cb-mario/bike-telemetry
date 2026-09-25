# Sistema de diseño

BikeTelemetry se diseña como el **panel de instrumentos de un ciclista**: minimalista, denso en datos y sobrio. Los datos mandan y los recorridos son la imagen de la app. Referencias: Wahoo, Intervals.icu, Linear.

La interfaz es solo oscura. Los tokens viven en `frontend/src/index.css` (bloque `@theme`) y los colores que se pintan desde JavaScript (mapas y gráficos) en `frontend/src/lib/theme.js`.

## Color

| Token | Valor | Uso |
|---|---|---|
| `surface` | `#080d1c` | Fondo de la app, liso con una luz cenital tenue y estática |
| `zinc-900` | `#131d3b` | Tarjetas |
| `zinc-800` | `#222e55` | Bordes y filetes |
| `zinc-100` / `400` / `500` | | Texto principal / etiquetas / texto terciario |
| `brand` | `#d4ff3a` | Único acento de marca: botón principal, sección activa, foco, selección |
| `brand-ink` | `#080d1c` | Texto sobre el lima (contraste 16:1) |
| `dist` | `#3987e5` | Distancia y velocidad |
| `elev` | `#c98500` | Desnivel |
| `hr` | `#d55181` | Pulso |
| `zone-1` … `zone-5` | gris azulado → violeta | Zonas de pulso, de frío a cálido |

La escala `zinc` de Tailwind está redefinida en tonos azul marino, así que las clases `zinc-*` ya dan la paleta; no se usan `slate`, `gray` ni `neutral`.

- **La marca no representa datos y los datos no hacen de marca.** El lima solo marca acciones y estados activos; un botón nunca puede confundirse con una métrica.
- **Los colores de datos van en marcas e iconos, no en el texto.** Cada lectura lleva una marca de color de 2 px junto a su etiqueta y la cifra va en tinta neutra.
- **Accesibilidad:** todo color nuevo se valida para daltonismo (deuteranopía y protanopía) y contraste sobre la tarjeta antes de usarlo, y siempre va acompañado de etiqueta.
- **Tendencias neutras:** las variaciones («+12 % vs. agosto») van en tinta neutra con un icono de flecha, sin verde ni rojo. Rodar menos no es un error.

## Tipografía

Alojada en la propia app con `@fontsource` (importada en `main.jsx`), sin peticiones a servicios externos.

- **Barlow** (400/500/600): interfaz y texto.
- **Barlow Semi Condensed** (500/600): cifras, títulos `h1`/`h2` y logotipo. Recuerda a la rotulación de carretera y a las pantallas de los ciclocomputadores.

| Elemento | Clases |
|---|---|
| Cifra | `font-display text-3xl font-semibold tracking-tight tabular-nums` (componente `Metric`) |
| Unidad | `text-base font-normal text-zinc-400` |
| Etiqueta de dato | `text-xs font-medium uppercase tracking-wider text-zinc-400` + marca `h-3 w-0.5` |
| Etiqueta de formulario | `text-[13px] font-medium text-zinc-300` |

## Logotipo

Placa lima redondeada con el perfil de altimetría de un puerto y un punto en la cima (`components/Logo.jsx`, el mismo dibujo que `public/favicon.svg`). El nombre va a dos tintas: «Bike» en blanco y «Telemetry» en gris azulado.

## Componentes

- **Tarjetas** sólidas (`bg-zinc-900`) con borde fino. El hover cambia el borde, sin elevar ni brillar. El desenfoque se reserva a lo que flota sobre contenido (cabecera fija, panel sobre el mapa).
- **Paneles de lecturas:** varias métricas juntas van en un panel con filetes (`grid gap-px bg-zinc-800` y celdas `bg-zinc-900`, componente `Reading`), no en tarjetas sueltas ni anidadas.
- **Datos que faltan se omiten**, nunca se rellenan con «—». Las rejillas ajustan sus columnas para no dejar celdas vacías.
- **Botón principal desactivado** en neutro (`bg-zinc-800 text-zinc-400`); mientras carga mantiene el lima.
- **Títulos sin antetítulo:** el contexto va en la línea de detalle («Última salida · jue, 24 sept»).
- **Iconos** de trazo (`components/ui/Icon.jsx` o lucide), nunca glifos Unicode ni emojis.
- **shadcn/ui** (sobre Base UI) solo para `select`, `alert-dialog`, `dropdown-menu` y `tooltip`, en `components/ui/`. `Button`, `Card`, `Dialog`, `Field` y los gráficos son propios. No se instala el `button` de shadcn porque choca con `Button.jsx` en sistemas de archivos que no distinguen mayúsculas.

## Pantallas

- **Resumen en bento:** la última salida (mapa grande y lecturas) ocupa 2×2; al lado, el mes en curso comparado con el mismo tramo del anterior y la próxima ruta. Debajo, el histórico y los gráficos. Solo celdas con datos reales.
- **Recorridos grandes:** 176 px de alto en las tarjetas y mapa principal en el Resumen. Sin GPS, la distancia ocupa el sitio del mapa.
- **Mapas** teñidos hacia el azul marino (clase `map-tiles`), con el trazado sobre un contorno oscuro.
- **Gráficos de evolución:** el periodo en curso a plena intensidad y el resto atenuado.
- **Landing:** las funciones se enseñan con piezas reales de la interfaz sobre datos de ejemplo etiquetados como tales, sin testimonios ni cifras de uso inventadas.

## Movimiento

Animaciones cortas (150–450 ms, ease-out): entrada de página, entradas escalonadas, barras que crecen y recuento de cifras solo en las del mes. Nada en bucle ni decorativo, y todo respeta `prefers-reduced-motion`.

## Lo que se evita

Glassmorphism general, neón y halos de color, degradados de adorno o texto en degradado, fondos animados, tarjetas de KPI con un icono grande en un círculo de color, velocímetros o esferas imitando instrumentos, cifras en color, celdas de relleno, fotos de stock o ilustraciones 3D, y mapas con teselas claras sobre la interfaz oscura.
