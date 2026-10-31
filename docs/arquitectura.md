# Arquitectura

## Stack

| Capa | Elección |
|---|---|
| Framework | Astro 7, salida estática (`dist/` = HTML + activos) |
| Estilos | CSS propio en `src/styles/`, sin preprocesador. Astro lo minifica y le pone hash |
| Comportamiento | `src/scripts/main.ts`, un módulo empaquetado por Astro |
| Imágenes | `astro:assets`: WebP, `srcset` y dimensiones reales generadas en el build |
| Contenido | Content collections en `src/content/`, validadas con Zod |
| Fuentes | Montserrat con la API de fuentes de Astro: se descarga en el build y se sirve desde `/_astro/fonts/` |
| Dependencias | `astro` y `@astrojs/sitemap`. Nada más |

El sitio no tiene backend ni base de datos. El único dato dinámico es el envío de los
formularios de contacto y del Canal Ético, que salen al Worker de `workers/contacto/`: un proyecto aparte, con
su propio `package.json`, que se despliega en Cloudflare y no en el hosting (ver
[contenido.md](contenido.md#formulario-de-contacto) y
[deploy.md](deploy.md#worker-del-formulario-de-contacto)).

## Árbol

```
src/
  assets/imagenes/     fotos y logos de clientes — pasan por astro:assets
  components/          PageHero, MediaCard, CtaBand, Galeria, Icono, SellosCertificacion
  content/             servicios, proyectos, recursos, certificaciones (Markdown)
  data/empresa.ts      contacto, cifras del brochure, proyectos por ciudad
  layouts/BaseLayout   head, top-bar, nav, menú móvil, pie, JSON-LD
  lib/                 iconos.ts (catálogo de SVG), servicios.ts (orden de la colección)
  pages/               una ruta por archivo
  scripts/main.ts      comportamiento compartido
  scripts/formulario.ts envío común de /contacto/ y /canal-etico/ (no lo carga main.ts)
  styles/              design-system.css, scroll-animations.css
public/
  assets/documentos/   PDF: certificados, políticas, brochure
  assets/imagenes/     logos SVG (header, JSON-LD), peru-depts.svg (mapa) y certificaciones/, vacía hasta que lleguen los sellos ISO
  assets/recursos/     flyers descargables
  assets/videos/       hero.mp4
  .htaccess            caché, seguridad y redirecciones de QR impresos
  robots.txt           solo apunta al sitemap: no bloquea nada (ver deploy.md#indexación)
  favicon.*, icon-*    iconos y site.webmanifest
workers/contacto/      receptor de los formularios: proyecto aparte, con su package.json
  src/index.ts           CORS, tope de cuerpo, Turnstile y reparto por ruta ("/" y "/canal")
  src/contacto.ts        validación y envío de /contacto/ (y la lista SERVICIOS)
  src/canal.ts           validación y envío del Canal Ético (y la tabla TIPOS)
  src/comun.ts           utilidades compartidas: Turnstile, CPaaS, validación de campos
  schema.sql             tablas D1 `consultas` y `reportes`
  wrangler.jsonc         variables públicas, D1, límite del Canal y purga diaria
  test/                  Vitest; contrato.test.ts lee los archivos del sitio
scripts/
  verificar-dist.mjs     comprueba dist/ tras el build: CSP, regla 1 y enlaces (npm run verificar)
.github/
  workflows/deploy.yml   CI en cada push y PR; deploy por FTP solo desde main
  dependabot.yml         actualizaciones semanales del sitio, del Worker y de las acciones
```

Va en `public/` solo lo que tiene que conservar su URL exacta: lo que se descarga,
lo que se enlaza desde fuera o lo que se pide por `fetch`. Toda foto que se muestra en
una página va en `src/assets/` y se importa.

## Rutas

| Ruta | Archivo | Indexada |
|---|---|---|
| `/` | `index.astro` | ✅ |
| `/nosotros/` | `nosotros.astro` | ✅ |
| `/servicios/`, `/servicios/[slug]/` | `servicios/` | ✅ |
| `/proyectos/`, `/proyectos/[slug]/` | `proyectos/` | ✅ |
| `/sostenibilidad/` | `sostenibilidad.astro` | ✅ |
| `/documentos/` | `documentos.astro` | ✅ |
| `/canal-etico/` | `canal-etico.astro` | ✅ |
| `/privacidad/` | `privacidad.astro` | ❌ mientras `PRIVACIDAD_PUBLICADA = false` (`src/data/empresa.ts`) — pendiente de revisión legal |
| `/contacto/` | `contacto.astro` | ✅ |
| `/mineria/` | `mineria.astro` | ❌ `noindex, follow` y fuera del sitemap — landing del stand de Expomina y destino de QR impresos; el sector minero se indexa en `/servicios/mineria/` |
| `/recursos/` | `recursos/index.astro` | ❌ `noindex` — material interno |
| `/sistema/` | `sistema/[...ruta].astro` | ❌ solo con `npm run dev`: no se genera en el build — referencia de componentes |
| `/404.html` | `404.astro` | — |

`/r/…`, `/empresa/…` y `/expomina/` no son páginas: son redirecciones fijas en
`public/.htaccess` para material impreso (ver [deploy.md](deploy.md)).

## Datos compartidos

`src/data/empresa.ts` es la única fuente de lo que aparece en más de una página:

- **`CONTACTO`** — correos, teléfono, WhatsApp, redes, sedes. Lo usan el layout, `/contacto/` y el JSON-LD.
- **`CIFRAS` y `NORMAS_ISO`** — las cifras del **brochure corporativo**, copiadas tal cual. No se agregan cifras que el brochure no declare.
- **`PROYECTOS_POR_CIUDAD`** — la lista del home y los pines del mapa salen del mismo arreglo.

El orden de los servicios en menú, pie, home y formulario lo da el campo `menu` de cada
`.md` de servicio (`serviciosPorMenu()` en `src/lib/servicios.ts`); `/servicios/` usa
`orden` (`serviciosPorOrden()`).

## CSS

`src/styles/design-system.css` tiene los tokens (color, tipografía, espaciado) y todos los
componentes compartidos (botones, controles, pestañas, prosa, avisos, banda de cifras,
asistente de pasos, preguntas frecuentes…); `/sistema/` los muestra pintados con ese mismo
archivo, pero solo con `npm run dev`. Se importa en `BaseLayout`, así que sale minificado,
con hash y cacheable para siempre. `scroll-animations.css` guarda solo las animaciones de
entrada (`data-aos`).

Las páginas solo escriben en su `<style>` el layout que es suyo. Regla 1 de
[CLAUDE.md](../CLAUDE.md): un selector de página no alcanza a lo que pinta un componente
hijo ni a lo que inyecta JavaScript. `<Image>` de `astro:assets` sí recibe el atributo de
scope de la página, así que `.marco img` en la página funciona.

## main.ts

Catorce funciones `init*`, cada una aislada con `try/catch`: un error en una no detiene a
las demás. Las que mueven algo (animaciones, cifras, máquina de escribir, carrusel, vídeo,
desplazamiento) respetan `prefers-reduced-motion`.

| Función | Qué hace | Hook HTML |
|---|---|---|
| `initScrollAnimations` | Animación de entrada; pone `.aos-listo` en `<html>`, que apaga el respaldo de CSS que lo muestra todo si el script no corre | `data-aos`, `data-aos-duration`, `data-aos-delay` |
| `initTypewriter` | Escribe las palabras del H1 del home; pone `.tw-listo` en `<html>` (mismo respaldo) | `.word.typewriter[data-text]` + `.tw-typed` |
| `initCounters` | Anima cifras al entrar en vista | `data-counter`, `data-prefix`, `data-suffix` |
| `initMobileMenu` | Menú móvil, acordeón, trampa de foco | `#menuToggle`, `#mobileMenu` |
| `initNavDropdown` | Esc cierra el desplegable de Servicios aunque el foco o el cursor sigan encima | `.nav .dropdown` (clase `.dropdown--cerrado`) |
| `initHeaderScroll` | Oculta header y top-bar al bajar | `#header`, `.top-bar` |
| `initBackToTop` | Botón volver arriba | `#backToTop` |
| `initSmoothScroll` | Anclas `#` con margen del header | `a[href^="#"]` |
| `initResponsive` | Clase `with-topbar` en escritorio | `#header`, `.main` |
| `initClientsCarousel` | Pausa del carrusel de clientes | `.clients-track`, `#clientsPauseBtn` |
| `initHeroVideo` | Carga el vídeo solo en escritorio | `.hero-video[data-src]`, `#heroPauseBtn` |
| `initTabs` | Pestañas ARIA: clic, flechas, Inicio y Fin | `[role="tablist"]` con `[role="tab"][aria-controls]` |
| `initScrollHint` | Flecha del hero | `.scroll-hint` |
| `initCoverageMap` | Inyecta el mapa y dibuja los pines | `#peruMapContainer[data-ciudades]` |

El HTML ya trae el valor final de cada cifra y el contenido visible: `main.ts` solo anima.
Las animaciones `data-aos` ocultan contenido únicamente bajo la clase `.js`, que pone una
línea inline en el `<head>`; sin JavaScript todo se ve.

## formulario.ts

`conectarFormulario()` es el envío que comparten `/contacto/` y `/canal-etico/`: valida, descarta
el campo trampa, espera el token de Turnstile, hace el POST JSON con `AbortSignal.timeout` y
pinta el aviso de éxito o de error. Cada página le pasa lo suyo (la URL, qué hacer sin
endpoint, el texto de éxito y de error); el orden de los pasos es único. Un 503 del Worker
(Turnstile no respondió) tiene un texto común. No importa `astro:env`: la URL la decide la
página, que sí lo importa.

`main.ts` no lo carga: lo importa el `<script>` de cada página. En `/canal-etico/` ese script
también maneja el asistente de tres pasos (validación por paso, foco, Turnstile explícito);
como importa `formulario.ts`, Astro lo emite como archivo y no en línea, y por eso la CSP no
lleva su hash (ver [deploy.md](deploy.md#publichtaccess)).

## Mapa de cobertura

`initCoverageMap` pide `public/assets/imagenes/peru-depts.svg` (exportado de CorelDRAW), lo
inyecta y calcula el centro de cada departamento con `getBBox()`. Las ciudades llegan en
`data-ciudades` desde `PROYECTOS_POR_CIUDAD`: `idMapa` es el id del departamento en el SVG
y `peso` (1–4) la intensidad del relleno y el tamaño del pin.

**`#peruMapContainer` no puede quedar en `display:none` en ningún breakpoint** (regla 4):
`getBBox()` sobre un elemento sin caja devuelve ceros y los pines desaparecen sin error.

## Home

Secciones claro/oscuro alternadas (referencia Bechtel): hero con vídeo y, debajo del
titular, la banda con las cuatro cifras del brochure (`.stat-band`) → quiénes somos →
servicios → presencia nacional (mapa) → proyectos destacados (los tres primeros con
`destacado: true`; la sección no se emite si no hay) → clientes → banda de cierre. El
póster del vídeo es un `<Image>` con `srcset` (768, 1280 y 1920 px) y es la imagen LCP; el
vídeo solo se descarga en escritorio, sin ahorro de datos y sin movimiento reducido.

## Fichas de servicio y de proyecto

`servicios/[slug].astro` y `proyectos/[slug].astro` pintan solo lo que el `.md` trae: sin
`destacados`, `faqs`, `galeria` o `ficha`, la sección no se emite. Con `faqs` sale también
el `FAQPage` en el JSON-LD. Un servicio con `categoria` lista los proyectos de esa
categoría. Las dos fichas cierran con la banda de contacto sobre la foto de la ficha.

## Lo que un rediseño no puede romper

Contratos que cruzan archivos o salen del repositorio. Ninguno falla en el build si se
rompe; por eso están juntos aquí y hay que repasarlos antes de cerrar un cambio grande.
Los que dicen **CI** en la última columna los vigila el workflow (`npm run verificar`,
`npm test` del Worker o el paso de Turnstile); los demás dependen de quien hace el cambio.

| Contrato | Dónde vive | Qué pasa si se rompe |
|---|---|---|
| **URLs públicas.** Toda ruta de la tabla de arriba está indexada o impresa | `src/pages/` | Renombrar una exige su 301 en `public/.htaccess`; si no, enlaces y Search Console dan 404 |
| **QR impresos y sitio anterior**: `/r/…`, `/empresa/…`, `/expomina/`, los `.html` y PDF de la raíz | `public/.htaccess` (regla 6 de CLAUDE.md) | El papel en circulación da 404. `/canal-etico/` y `/mineria/` son destino de QR: no cambian de URL |
| **Archivos con URL fija**: PDF, vídeo, logos SVG, flyers | `public/assets/` | Los enlazan los certificados, el JSON-LD y material externo. Reemplazar un archivo conserva su nombre |
| **Campos de los formularios** (`name`, `maxlength`) | `contacto.astro`, `canal-etico.astro` ↔ `LIMITES` de `workers/contacto/src/contacto.ts` y `canal.ts` | El Worker rechaza con 400 lo que el formulario deja escribir. Contrato completo en [contenido.md](contenido.md#formulario-de-contacto) y [Canal Ético](contenido.md#canal-ético) |
| **Lista de servicios** | títulos de `src/content/servicios/` ↔ `SERVICIOS` del Worker | **CI**: `npm test` del Worker falla; si no se despliega, el Worker rechaza el servicio nuevo |
| **Tipos del Canal Ético** | `CANALES` de `canal-etico.astro` ↔ `TIPOS` de `canal.ts` | **CI**: igual, `npm test` lo detecta |
| **`action` de Turnstile** | `data-action="contacto"` y `action: 'canal'` en las páginas ↔ `ACCION_TURNSTILE` de `contacto.ts` y `canal.ts` | El Worker responde 403 a todo envío de ese formulario. Se despliega primero el sitio y después el Worker |
| **Turnstile en `/contacto/` y `/canal-etico/`** | `.github/workflows/deploy.yml` busca `cf-turnstile` en esas dos rutas | **CI**. Mover o renombrar los formularios exige ajustar el CI y el humo posterior |
| **Scripts en línea** | hashes de la CSP en `public/.htaccess` | **CI**: `npm run verificar` corta si un script en línea nuevo o editado (la clase `js`, `/mineria/`) no tiene su hash. Sin él, el navegador lo bloquea cuando la CSP deje el modo informe |
| **Estilos de página** (regla 1 de CLAUDE.md) | `<style>` de cada página | **CI**: `npm run verificar` corta si un selector no encuentra ningún elemento |
| **Enlaces internos** | todo `href`, `src` y `srcset` | **CI**: `npm run verificar` corta si apunta a algo que no está en `dist/` |
| **Proveedores externos** (Turnstile, Web Analytics, Maps, YouTube, el Worker) | CSP en `public/.htaccess` | Uno nuevo hay que añadirlo a su directiva |
| **`#peruMapContainer` con caja** | regla 4 de CLAUDE.md | Los pines desaparecen sin error |
| **Cifras del brochure** | solo `src/data/empresa.ts` (regla 5) | Una cifra escrita en una página se separa de la fuente |
| **Host del sitio** | `site` de `astro.config.mjs` | Canonical, sitemap, Open Graph y JSON-LD salen de ahí |
| **Lo que no se indexa** | `SECCIONES_PRIVADAS` de `astro.config.mjs` + `robots` de cada página | Ver [deploy.md](deploy.md#indexación). `robots.txt` no lleva `Disallow` a propósito |
| **Privacidad sin publicar** | `PRIVACIDAD_PUBLICADA` en `src/data/empresa.ts` | Una página nueva que enlace `/privacidad/` debe respetar ese interruptor |
