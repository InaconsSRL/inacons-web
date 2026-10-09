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

No hay backend propio ni base de datos. El único dato dinámico es el envío del
formulario de contacto, que sale a un endpoint externo configurable (ver
[contenido.md](contenido.md#formulario-de-contacto)).

## Árbol

```
src/
  assets/imagenes/     fotos y logos de clientes — pasan por astro:assets
  components/          PageHero, MediaCard, CtaBand, Icono, SellosCertificacion
  content/             servicios, proyectos, recursos, certificaciones (Markdown)
  data/empresa.ts      contacto, cifras del brochure, proyectos por ciudad
  layouts/BaseLayout   head, top-bar, nav, menú móvil, pie, JSON-LD
  lib/                 iconos.ts (catálogo de SVG), servicios.ts (orden de la colección)
  pages/               una ruta por archivo
  scripts/main.ts      comportamiento compartido
  styles/              design-system.css, scroll-animations.css
public/
  assets/documentos/   PDF: certificados, políticas, brochure
  assets/imagenes/     logos SVG (header, JSON-LD) y peru-depts.svg (mapa)
  assets/recursos/     flyers descargables
  assets/videos/       hero.mp4
  .htaccess            caché, seguridad y redirecciones de QR impresos
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
| `/privacidad/` | `privacidad.astro` | ❌ mientras `BORRADOR = true` — pendiente de revisión legal |
| `/contacto/` | `contacto.astro` | ✅ |
| `/mineria/` | `mineria.astro` | ✅ presentación del sector minero (sin menú ni pie) |
| `/recursos/` | `recursos/index.astro` | ❌ `noindex` — material interno |
| `/sistema/` | `sistema/index.astro` | ❌ `noindex` + `robots.txt` — referencia de componentes |
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
componentes compartidos (botones, controles, pestañas, prosa, avisos…); `/sistema/` los muestra pintados con ese mismo archivo. Se importa
en `BaseLayout`, así que sale minificado, con hash y cacheable para siempre.

Las páginas solo escriben en su `<style>` el layout que es suyo. Regla 1 de
[CLAUDE.md](../CLAUDE.md): un selector de página no alcanza a lo que pinta un componente
hijo ni a lo que inyecta JavaScript. `<Image>` de `astro:assets` sí recibe el atributo de
scope de la página, así que `.marco img` en la página funciona.

## main.ts

Trece funciones `init*`, cada una aislada con `try/catch`: un error en una no detiene a las
demás. Todas respetan `prefers-reduced-motion`.

| Función | Qué hace | Hook HTML |
|---|---|---|
| `initScrollAnimations` | Animación de entrada | `data-aos`, `data-aos-duration`, `data-aos-delay` |
| `initTypewriter` | Escribe las palabras del H1 del home | `.word.typewriter[data-text]` + `.tw-typed` |
| `initCounters` | Anima cifras al entrar en vista | `data-counter`, `data-prefix`, `data-suffix` |
| `initMobileMenu` | Menú móvil, acordeón, trampa de foco | `#menuToggle`, `#mobileMenu` |
| `initHeaderScroll` | Oculta header y top-bar al bajar | `#header`, `.top-bar` |
| `initBackToTop` | Botón volver arriba | `#backToTop` |
| `initSmoothScroll` | Anclas `#` con margen del header | `a[href^="#"]` |
| `initResponsive` | Clase `with-topbar` en escritorio | `#header`, `.main` |
| `initClientsCarousel` | Pausa del carrusel de clientes | `.clients-track`, `#clientsPauseBtn` |
| `initHeroVideo` | Carga el vídeo solo en escritorio | `.hero-video[data-src]`, `#heroPauseBtn` |
| `initTabs` | Pestañas ARIA: clic, flechas, Inicio y Fin | `[role="tablist"]` con `.tab[aria-controls]` |
| `initScrollHint` | Flecha del hero | `.scroll-hint` |
| `initCoverageMap` | Inyecta el mapa y dibuja los pines | `#peruMapContainer[data-ciudades]` |

El HTML ya trae el valor final de cada cifra y el contenido visible: `main.ts` solo anima.
Las animaciones `data-aos` ocultan contenido únicamente bajo la clase `.js`, que pone una
línea inline en el `<head>`; sin JavaScript todo se ve.

## Mapa de cobertura

`initCoverageMap` pide `public/assets/imagenes/peru-depts.svg` (exportado de CorelDRAW), lo
inyecta y calcula el centro de cada departamento con `getBBox()`. Las ciudades llegan en
`data-ciudades` desde `PROYECTOS_POR_CIUDAD`: `idMapa` es el id del departamento en el SVG
y `peso` (1–4) la intensidad del relleno y el tamaño del pin.

**`#peruMapContainer` no puede quedar en `display:none` en ningún breakpoint** (regla 4):
`getBBox()` sobre un elemento sin caja devuelve ceros y los pines desaparecen sin error.

## Home

Secciones claro/oscuro alternadas (referencia Bechtel): hero con vídeo y cifras → quiénes
somos → servicios → dónde construimos (mapa) → proyectos destacados → clientes → banda de
cierre. El póster del vídeo es la imagen LCP y se precarga; el vídeo solo se descarga en
escritorio, sin ahorro de datos y sin movimiento reducido.
