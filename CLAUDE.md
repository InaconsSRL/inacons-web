# CLAUDE.md — INACONS Web

Sitio corporativo de INACONS S.R.L. (ingeniería y construcción, Perú).
Astro 6 en modo estático. Sin framework de UI, sin build de CSS, sin dependencias
más allá de `astro` y `@astrojs/sitemap`.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Dev server en http://localhost:4321 |
| `npm run build` | Genera `dist/` |
| `npm run preview` | Sirve el build local |

Node ≥ 22.12.0. El deploy es automático al hacer push a `main` — ver [docs/deploy.md](docs/deploy.md).

## Dónde va cada cosa

| Necesitas tocar | Archivo |
|---|---|
| Tokens, utilidades, estilos que cruzan componentes | `public/assets/css/design-system.css` |
| Comportamiento del sitio | `public/assets/js/main.js` (12 funciones `init*`, un solo `DOMContentLoaded`) |
| Head, nav, footer, meta OG | `src/layouts/BaseLayout.astro` |
| Home | `src/pages/index.astro` |
| Proyectos / servicios / recursos | `src/content/<colección>/*.md` — nunca hardcodear en la página |
| Schemas de las colecciones | `src/content.config.ts` |
| Backends de formularios | `src/appscripts/*.js` (Google Apps Script) |

Detalle completo en [docs/arquitectura.md](docs/arquitectura.md).

## Reglas duras

**1. El `<style>` de una página Astro solo alcanza al markup que esa página escribe.**
Astro le pega `data-astro-cid-XXXX` al último selector. Falla en silencio — el build
pasa, el CSS se emite, el selector no engancha con nada — en dos casos que ya
rompieron este repo:

- Elementos inyectados por JS (el SVG del mapa): el estilo va en el propio JS, con
  `element.style.…`.
- Elementos que renderiza un componente hijo (`.cards-row > *` con hijos `MediaCard`):
  el estilo va en `design-system.css`, o dentro del componente, o se pasa como custom
  property inline desde la página (`style="--card-ratio: 4/5"`), que sí atraviesa.

Regla práctica: **si el selector cruza la frontera de un componente, no lo escribas en
la página.** Se verifica con `grep '\[data-astro-cid-[^]]*\] > \[data-astro-cid' dist/_astro/*.css`
— ese patrón casi siempre es un bug.

**2. Los valores salen de los tokens.** Si un tamaño, espaciado o color no viene de una
custom property de `design-system.css`, es un bug. El naranja `--c-accent` solo va sobre
fondo oscuro (sobre claro da 2.93:1 y no pasa AA); sobre claro se usa `--c-accent-ink`.

**3. El contenido dinámico viene de `src/content/`.** Proyectos, servicios y recursos
nunca se escriben a mano en el HTML.

**4. `#peruMapContainer` no puede quedar en `display:none` en ningún breakpoint.**
`initCoverageMap()` mide con `getBBox()`; sobre un elemento sin caja devuelve ceros y los
pines desaparecen sin error. Ocultar por opacidad es seguro, por display no.

**5. Apps Script: editar la implementación existente, nunca crear una nueva.** Crear una
nueva cambia la URL `/exec` y el formulario deja de guardar sin error visible.
Ver [docs/formularios.md](docs/formularios.md).

## Convenciones

- No agregar comentarios que expliquen el cambio (`// Agregado para X`). Los comentarios
  del repo explican **por qué** una decisión es como es, no qué hace la línea.
- No crear archivos `.md` nuevos salvo que se pidan.
- Enlaces internos **con barra final** en lo nuevo: Astro genera `ruta/index.html` y Apache
  responde 301 en `/ruta`, 200 en `/ruta/`. Ojo: hoy **ningún** enlace del repo la lleva, así
  que esto es la regla a aplicar, no lo que hay. Ver [docs/deploy.md](docs/deploy.md).
- Imágenes en WebP, con `width` y `height` explícitos siempre.
- Preguntar si los placeholders son temporales antes de hardcodear datos: el sitio se
  construye con poca información real disponible.

## Referencia de diseño

**Bechtel** (bechtel.com): secciones claro/oscuro alternadas, tipografía grande y bold,
imágenes dramáticas, KPIs integrados en el layout. El home alterna a propósito —
ver el comentario de orden en `src/pages/index.astro`.

## Documentación

| Doc | Contenido |
|---|---|
| [docs/arquitectura.md](docs/arquitectura.md) | Estructura, `main.js`, CSS, el mapa, el home sección por sección |
| [docs/contenido.md](docs/contenido.md) | Cómo agregar proyectos, servicios y recursos |
| [docs/deploy.md](docs/deploy.md) | CI/CD, hosting, dominios, `.htaccess` |
| [docs/performance.md](docs/performance.md) | Core Web Vitals, pendientes, historial |
| [docs/formularios.md](docs/formularios.md) | Backends Apps Script, captura de leads, QR |
