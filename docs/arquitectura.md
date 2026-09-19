# Arquitectura

## Stack

| Capa | Elección |
|---|---|
| Framework | Astro 6.1.9, salida estática |
| Estilos | CSS propio en `public/assets/css/` — sin preprocesador ni build |
| Animaciones | IntersectionObserver + `scroll-animations.css` (AOS fue eliminado) |
| Iconos | SVG inline (Lucide y Font Awesome fueron eliminados) |
| Fuentes | Google Fonts — Montserrat, carga asíncrona |
| Datos y sesión | Supabase (Postgres + Auth), solo en `/panel/` |
| Dependencias | `astro`, `@astrojs/sitemap`, `@supabase/supabase-js`, `qrcode` |

Las dependencias se cuentan con los dedos de una mano, y es deliberado: cada librería que
entró para decorar (AOS, Swiper, Lucide, Font Awesome) terminó saliendo por peso. Las dos
que se agregaron en 2026 no decoran — `@supabase/supabase-js` es el cliente de la base y
`qrcode` genera los símbolos. Esta última reemplazó a `qrcodejs` cargado desde un CDN:
solo implementaba modo byte, no emitía SVG, y era una dependencia externa con su hash SRI
que mantener.

Las páginas públicas siguen sin cargar nada de eso: Supabase viaja únicamente en el bundle
de `/panel/`, y `qrcode` en el de `/panel/` y `/recursos/`.

## Árbol

```
web-astro/
├── CLAUDE.md                  # reglas para agentes
├── README.md                  # presentación del proyecto
├── docs/                      # esta documentación
├── astro.config.mjs           # site + filtro del sitemap
├── src/
│   ├── content.config.ts      # schemas Zod de las 3 colecciones
│   ├── lib/
│   │   ├── qr.ts              # ÚNICA fuente de generación de QR
│   │   └── supabase.ts        # ÚNICO lugar que instancia el cliente
│   ├── layouts/
│   │   └── BaseLayout.astro   # head, nav, footer, meta OG
│   ├── components/
│   │   ├── MediaCard.astro    # tarjeta imagen + overlay (servicios y proyectos)
│   │   ├── CtaBand.astro      # banda CTA oscura con 2 botones
│   │   └── PageHero.astro     # cabecera de páginas interiores + breadcrumb
│   ├── pages/                 # ver tabla de rutas abajo
│   └── content/
│       ├── proyectos/         # 2 entradas
│       ├── servicios/         # 6 entradas
│       └── recursos/          # 3 entradas
├── supabase/
│   └── migrations/            # se ejecutan a mano en el SQL Editor, en orden
├── _archivo/                  # código despublicado que no se borra — hoy vacío
└── public/
    ├── .htaccess              # QR corto, gzip, caché, cabeceras de seguridad
    ├── robots.txt
    ├── assets/
    │   ├── css/design-system.css       # tokens + utilidades globales
    │   ├── css/scroll-animations.css
    │   ├── js/main.js                  # todo el comportamiento
    │   ├── imagenes/                   # 51 archivos, WebP + SVG
    │   ├── videos/hero.mp4             # 4.6 MB
    │   ├── documentos/                 # 11 PDF públicos (certificados, políticas)
    │   └── recursos/                   # flyers descargables
    ├── r/index.php            # redirector de QR — resuelve contra Supabase y hace el 302
    └── empresa/               # panel PHP antiguo (config.php en .gitignore)
```

## Rutas

| Ruta | Archivo | Indexada |
|---|---|---|
| `/` | `index.astro` | ✅ |
| `/nosotros` | `nosotros.astro` | ✅ |
| `/servicios` | `servicios/index.astro` | ✅ |
| `/servicios/[slug]` | `servicios/[slug].astro` | ✅ |
| `/proyectos` | `proyectos/index.astro` | ✅ |
| `/proyectos/[slug]` | `proyectos/[slug].astro` | ✅ |
| `/contacto` | `contacto.astro` | ✅ |
| `/sostenibilidad` | `sostenibilidad.astro` | ✅ |
| `/canal-etico` | `canal-etico.astro` | ✅ |
| `/documentos` | `documentos.astro` | ✅ |
| `/404` | `404.astro` | — |
| `/recursos` | `recursos/index.astro` | ❌ noindex |
| `/empleados` | `empleados/index.astro` | ✅ directorio público — lee `directorio_empleados()` en el navegador |
| `/empleados/SLUG` | reescrita a `tarjetas/index.astro` (ver `.htaccess`) | ❌ noindex — datos de contacto de una persona |
| `/expomina` | `expomina.astro` | ❌ noindex (campaña terminada) |
| `/panel` | `panel/index.astro` | ❌ noindex — administración |
| `/sistema` | `sistema/index.astro` | ❌ noindex — referencia de componentes |
| `/r/CODIGO` | `public/r/index.php` | ❌ no es una página: redirige |

Las internas se excluyen del sitemap en `astro.config.mjs` y de `robots.txt`. **Las dos
listas se mantienen en paralelo**: una ruta nueva que no deba indexarse va en las dos.

El filtro del sitemap compara el **primer segmento** de la ruta, no la URL entera. La
versión anterior buscaba la palabra en cualquier posición, así que una futura
`/proyectos/recursos-hidricos/` habría quedado fuera sin que nadie lo notara.

`/formulario/amonestaciones` ya no existe: se despublicó en la Fase 0 y su código se
borró del todo en la limpieza posterior (set 2026) — tenía PIN en el cliente y un
endpoint que devolvía todos los registros disciplinarios sin autenticación. Borrar el
código no cierra el endpoint de Apps Script, que vive en Google: ver
`docs/ESPECIFICACION.md` §14.

## CSS

`design-system.css` abre con el bloque de tokens, que es la única fuente de verdad.
Antes de existir, el sitio tenía 65 tamaños de fuente distintos, 106 paddings y 122
`rgba()` inventados en el punto de uso — de ahí salieron los fallos de contraste, porque
no había un lugar donde revisarlos.

### Paleta

```css
--c-primary:      #14172d   /* azul marino profundo — identidad */
--c-secondary:    #1b5278   /* azul medio — soporte */
--c-accent:       #d9822b   /* naranja — SOLO sobre fondo oscuro */
--c-accent-hover: #c2711e
--c-accent-ink:   #96530f   /* naranja para fondo claro — 5.93:1 sobre blanco */
```

Texto sobre oscuro: tres niveles verificados contra `--c-primary` —
`--c-on-dark-1` (14.95:1, titulares), `--c-on-dark-2` (9.52:1, apoyo),
`--c-on-dark-3` (7.37:1, metadatos; es el mínimo permitido). No inventar alfas nuevas:
si hace falta otro nivel, se agrega al bloque de tokens.

Hubo dos alias heredados, `--c-text-white-70` y `--c-text-white-45`, que apuntaban a los
niveles 2 y 3. Se eliminaron: el "45" original daba 4.45:1 y no pasaba AA, y mantener dos
nombres para el mismo valor contradice que el bloque de tokens sea la única fuente de
verdad. Usar `--c-on-dark-2` y `--c-on-dark-3` directamente.

### Clases globales

Están **todas** en `/sistema/`, que las muestra armadas y con su markup al lado. Esa
página se pinta con el CSS real, así que no puede quedar desactualizada.

- **Layout:** `.sec` / `.sec--white` / `.sec--muted` / `.sec--dark`, `.container`
- **Cabecera de sección:** `.sh` con `.sh-label` / `.sh-title` / `.sh-desc`
- **Botones:** `.btn` + `.btn-primary` / `-outline` / `-outline-light` / `-accent` /
  `-sm` / `-lg` / `-block`
- **Tarjetas:** `.card`, `.card--media`, `.card--stat` con `.stat-num`
- **Formularios:** `.form-row`, `.form-group`, `.form-input` / `-textarea` / `-select`,
  `.form-hint`, `.form-error`
- **Avisos:** `.notice` + `--ok` / `--error` / `--warn` / `--info`
- **Superficies:** `.panel` + `--accent` / `--raised` / `--ghost`
- **Datos:** `.data-list`, `.tabla` dentro de `.tabla-scroll`, `.status-ok` / `-error` /
  `-warn` / `-off`
- **Diálogos:** `.dialogo` con `.dialogo-caja`
- **QR:** `.qr-lienzo` — ver la trampa de abajo

La capa de formularios y avisos nació tarde y por duplicado: `/contacto` tenía su juego
dentro de la página y el panel escribió otro distinto para lo mismo, ya divergiendo en el
radio del borde y la duración de la transición. Los valores canónicos salieron de
`/contacto`, con los tokens puestos donde había literales.

`/contacto` todavía conserva su copia local — es el único duplicado que queda.

### Scoping — la trampa principal

Está documentada como regla dura en [CLAUDE.md](../CLAUDE.md). En resumen: el `<style>`
de un `.astro` solo alcanza al markup de ese archivo. Ni elementos inyectados por JS, ni
elementos que renderiza un componente hijo.

El caso que más costó: `.cards-row > *` en `index.astro` compilaba a
`.cards-row[cid] > [cid]`. Los hijos eran `MediaCard`, que **al no tener `<style>` propio
no lleva ningún cid**. La regla no enganchó, las tarjetas se quedaron sin `flex-basis`, y
como su imagen va en `position:absolute` no aportan ancho intrínseco: colapsaron a cero.
Servicios y proyectos desaparecieron del home sin error de build ni nada en consola.

Y volvió a pasar, en tres páginas a la vez. `/recursos/`, `/sistema/` y `/panel/`
dimensionaban el SVG del QR desde su propio `<style>`. Ese SVG llega en tiempo de
ejecución —lo inyecta JS o entra por `set:html`— así que **nunca lleva el cid**. Cuatro
reglas compiladas como `.contenedor[cid] svg[cid]`, ninguna enganchando. Como el SVG del
módulo trae `viewBox` pero no `width` ni `height`, el símbolo salía del tamaño que el
navegador quisiera.

La solución es la que dice CLAUDE.md: el estilo va en `design-system.css`, que es el único
CSS que alcanza a lo que la página no escribió, y el tamaño viaja como custom property
inline, que sí atraviesa la frontera:

```html
<div class="qr-lienzo" style="--qr-lado: 210px"></div>
```

Se verifica con:

```bash
grep -roh '\[data-astro-cid-[a-z0-9]*\] svg\[data-astro-cid-[a-z0-9]*\]' dist/_astro/*.css
```

Cada resultado hay que mirarlo: si ese `<svg>` está escrito en el markup de la página,
está bien; si lo pone JavaScript, está roto.

### El atributo `hidden` gana siempre

`design-system.css` declara `[hidden] { display: none !important }` en el reset, y no es
decoración. Por defecto `hidden` solo vale `display: none` en la hoja del navegador, así
que **cualquier regla de autor que fije `display` lo anula** — y lo anula en silencio,
porque el atributo sigue en el HTML y todo parece correcto al leerlo.

Pasó con `.dialogo`, que declara `display: flex`: los dos diálogos del panel se pintaban
apilados sobre la página y no se podía usar nada.

## Los tres subsistemas fuera del sitio público

El sitio institucional es estático y no depende de nada. Encima de él conviven tres cosas
que sí:

| | Qué es | Dónde | Detalle |
|---|---|---|---|
| **Módulo QR** | Genera los símbolos. Única fuente | `src/lib/qr.ts` | [formularios.md](formularios.md) |
| **Redirector** | Resuelve `/r/CODIGO` y hace el 302 | `public/r/index.php` | [formularios.md](formularios.md) |
| **Panel** | Administra los códigos | `src/pages/panel/` | [deploy.md](deploy.md) |

El redirector es la única parte no estática del sitio, junto con `/empresa/`. Sigue siendo
PHP porque es la única forma de dar un **302 real del servidor** con dominio propio sin
meter Cloudflare delante: un sitio estático solo puede servir una página que después
redirige con JavaScript, y eso mete una pantalla en blanco justo después del escaneo.

`public/empresa/` es el panel PHP antiguo. **Sigue en pie a propósito** hasta que
`/panel/` haga todo lo que hace él; el 301 se activa al final de la Fase 3.

## main.js

Un solo archivo, cargado con `defer`, un solo `DOMContentLoaded`. Doce funciones:

| Función | Qué hace | Hook HTML |
|---|---|---|
| `initScrollAnimations()` | IntersectionObserver para `data-aos` | elementos con `data-aos` |
| `initTypewriter()` | Escribe secuencialmente 3 palabras del H1 | `.word.typewriter` con `data-text`, más `.tw-typed` |
| `initCounters()` | Anima contadores al entrar en vista | `data-counter` con `data-target` y `data-suffix` |
| `initMobileMenu()` | Menú móvil, acordeón de sub-items, focus trap | `#menuToggle`, `#mobileMenu`, `.mobile-dropdown` |
| `initHeaderScroll()` | Oculta header y top-bar al bajar | `#header`, `.top-bar` |
| `initBackToTop()` | Botón volver arriba (tras 400 px) | `#backToTop` |
| `initSmoothScroll()` | Anclas con hash, con offset de header | enlaces cuyo href empieza en `#` |
| `initResponsive()` | Clase `with-topbar` según viewport (≥768 px) | `#header`, `.main` |
| `initClientsCarousel()` | Pausa la animación CSS en hover/touch | `.clients-track` |
| `initHeroPause()` | Pausa/play del video hero | `#heroPauseBtn`, `.icon-pause`, `.icon-play` |
| `initScrollHint()` | Click baja 88 vh | `.scroll-hint` |
| `initCoverageMap()` | Inyecta el SVG del Perú y dibuja los pines | `#peruMapContainer` |

Notas:

- `initCounters` usa `easeOutCubic` en 1800 ms, con threshold 0.3.
- El estado inicial del botón de pausa se fija desde JS (`display: block/none`), no desde
  CSS — había un override que lo dejaba con los dos iconos visibles.
- Para propiedades SVG usar notación de corchetes: `element.style["stroke-width"]`, no
  `element.style.strokeWidth`.

## Mapa de cobertura

`public/assets/imagenes/peru-depts.svg` — export de CorelDRAW, ~286 KB,
`viewBox="0 0 15306.62 22149.86"`.

`initCoverageMap()` hace `fetch()` del SVG y lo inyecta inline con `innerHTML`. **Tiene
que ser inline**: `getBBox()` no funciona sobre un `<img>`. Por eso los colores de
departamento se aplican con `element.style.fill` desde el JS — un style inline además
gana contra la clase `.fil0` que trae el export.

Los IDs son los que puso CorelDRAW, no un esquema propio:

| Ciudad | ID en el SVG | Proyectos |
|---|---|---|
| Piura | `Piura` | 3+ |
| Trujillo | `La_x0020_Libertad` | 2+ |
| Pasco | `Pasco` | 6+ |
| Lima | `path2641` | 25+ |
| Huancayo | `Junín` | 50+ |
| Huancavelica | `Huancavelica` | 5+ |
| Ica | `Ica` | 5+ |

Lima no tiene nombre en el SVG: se identifica por `path2641`.

Por cada ciudad se calcula el centro con `getBBox()` y se crean dos anillos de pulso con
animación **SMIL** (elementos `<animate>` sobre `r` y `opacity`, `dur` 2.6 s, offset de
1.3 s entre anillos). SMIL en vez de CSS porque el radio varía por ciudad y se controla
desde el mismo JS que ya está midiendo.

El contenedor no puede quedar en `display:none` en ningún breakpoint: sobre un elemento
sin caja `getBBox()` devuelve ceros, los siete pines desaparecen y el mapa se sigue
dibujando, sin error. Ocultar por opacidad (`data-aos`) es seguro; por display no.

## El home

`src/pages/index.astro`. El orden alterna claro y oscuro a propósito — antes iba
hero → oscuro → claro → oscuro → claro → oscuro, con dos oscuras pegadas al arrancar y la
banda CTA compitiendo con Proyectos por ser el cierre.

| # | Sección | Fondo | Qué tiene |
|---|---|---|---|
| ① | Hero | video | Typewriter H1, CTA, botón pausa, scroll hint, barra de indicadores |
| ② | Quiénes somos | claro | Imagen con marco accent y badge 15+ años, texto, KPIs, CTA |
| ③ | Lo que construimos | oscuro | Tarjetas de servicios desde `content/servicios/` |
| ④ | Dónde construimos | muted | Mapa SVG y barras de proyectos por ciudad |
| ⑤ | Nuestros proyectos | oscuro | Tarjetas dinámicas; se oculta si no hay `destacado: true` |
| ⑥ | Nuestros clientes | claro | Scroll infinito de logos — cierra en claro |

② y ④ estuvieron fusionadas porque repetían datos: "96+ Proyectos ejecutados" salía dos
veces palabra por palabra y "Departamentos" decía 7 en una y 6 en la otra. Ahora las
cifras están repartidas y no se pisan, así que volvieron a ser dos secciones.

### Hero

- Video `hero.mp4`, autoplay + muted + loop + playsinline, poster `image_heroprincipal.webp`.
- El H1 son 3 líneas fijas; las palabras entre corchetes se escriben secuencialmente:
  `CONSTRUIMOS [CONFIANZA]` / `[INNOVAMOS] ESPACIOS` / `TRASCENDEMOS [JUNTOS]`.
- Cada palabra lleva un ghost invisible (`.tw-ghost`) que reserva el espacio, más
  `.tw-typed` en absolute que se va llenando. El cursor solo aparece durante el typing.
- **El word cycling fue descartado**: ciclar palabras distintas no gustó, se volvió a las
  3 líneas fijas.
