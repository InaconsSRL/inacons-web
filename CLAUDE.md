# CLAUDE.md — INACONS Web

Sitio corporativo de INACONS S.R.L. (ingeniería y construcción, Perú).
Astro 7 en modo estático. Sin framework de UI, sin backend, sin base de datos. Dependencias:
`astro` y `@astrojs/sitemap`.

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
| Tokens, utilidades, estilos que cruzan componentes | `src/styles/design-system.css` |
| Ver los componentes que ya existen | `/sistema/` — referencia viva, se pinta con el CSS real |
| Comportamiento del sitio | `src/scripts/main.ts` (funciones `init*` aisladas) |
| Head, nav, footer, meta OG, JSON-LD | `src/layouts/BaseLayout.astro` |
| Contacto, cifras del brochure, proyectos por ciudad | `src/data/empresa.ts` |
| Servicios / proyectos / recursos / certificaciones | `src/content/<colección>/*.md` — nunca hardcodear en la página |
| Schemas de las colecciones | `src/content.config.ts` |
| Fotos que se muestran en páginas | `src/assets/imagenes/` + `astro:assets` |
| Archivos que conservan su URL (PDF, vídeo, logos SVG, flyers) | `public/assets/` |
| Iconos | `src/lib/iconos.ts` + `<Icono nombre="…" />` |
| Formulario de contacto | `src/pages/contacto.astro` — contrato del endpoint en [docs/contenido.md](docs/contenido.md) |
| Redirecciones, caché, cabeceras | `public/.htaccess` |

Detalle en [docs/arquitectura.md](docs/arquitectura.md).

## Reglas duras

**1. El `<style>` de una página Astro solo alcanza al markup que esa página escribe.**
Astro le pega `data-astro-cid-XXXX` al último selector. Falla en silencio —el build pasa,
el CSS se emite, el selector no engancha con nada— en dos casos que ya rompieron este repo:

- Elementos inyectados por JS (el SVG del mapa): el estilo va en el propio JS, con
  `element.style.…`.
- Elementos que renderiza un componente hijo (`.cards-row > *` con hijos `MediaCard`, el
  `<Content />` de una colección): el estilo va en `design-system.css`, dentro del
  componente, con `:global()`, o como custom property inline desde la página
  (`style="--card-ratio: 4/5"`), que sí atraviesa.

`<Image>` de `astro:assets` es la excepción: recibe el atributo de scope de la página.
Se verifica con `grep '\[data-astro-cid-[^]]*\] > \[data-astro-cid' dist/_astro/*.css` —
ese patrón casi siempre es un bug.

**2. Los valores salen de los tokens, y los componentes del sistema.** Si un tamaño,
espaciado o color no viene de una custom property de `design-system.css`, es un bug. El
naranja `--c-accent` solo va sobre fondo oscuro (sobre claro da 2.93:1 y no pasa AA);
sobre claro se usa `--c-accent-ink`. Texto sobre `--c-accent` va en `--c-primary`, nunca
en blanco.

Una página nueva no define estilos de campo, botón, aviso, superficie ni lista: abrir
`/sistema/` primero. Si falta uno, se agrega al sistema y después se usa.

**3. El contenido dinámico viene de `src/content/` y los datos de empresa de
`src/data/empresa.ts`.** Servicios, proyectos y recursos nunca se escriben a mano en el
HTML. El orden del menú lo da el campo `menu` de cada servicio.

**4. `#peruMapContainer` no puede quedar en `display:none` en ningún breakpoint.**
`initCoverageMap()` mide con `getBBox()`; sobre un elemento sin caja devuelve ceros y los
pines desaparecen sin error. Ocultar por opacidad es seguro, por display no.

**5. Las cifras corporativas se copian del brochure, tal cual.** Fuente:
`public/assets/documentos/brochure_inacons.pdf`. Viven solo en `src/data/empresa.ts`. No
se agregan cifras que el brochure no declare ni se redondean.

**6. Las reglas de `/r/` y `/empresa/` en `.htaccess` llevan `[NC]` y se quedan.** Hay QR
impresos codificados en MAYÚSCULAS (`/R/CANAL_ETICO`); sin `[NC]` el papel da 404 aunque
tecleado en minúsculas funcione. Son 302 a propósito: el sistema nuevo de QR tomará `/r/`.

**7. Nada secreto en el repositorio.** Todo lo que lleve prefijo `PUBLIC_` termina dentro
del JavaScript público. Credenciales (FTP) solo en los secrets de GitHub.

**8. `/contacto/` no va en el menubar principal.** El menú nombra lo que la empresa
*es*; contactar es una acción. Vive en la píldora del top-bar, en el menú móvil y en el
pie. Como el top-bar se oculta al primer píxel de scroll, **toda página de cara al cliente
cierra con `<CtaBand>`**.

## Convenciones

- Los comentarios explican **por qué** una decisión es como es, no qué hace la línea ni
  qué cambió (`// Agregado para X` no).
- No crear archivos `.md` nuevos salvo que se pidan.
- Enlaces internos **siempre con barra final** (`/servicios/`).
- Fotos en `src/assets/` con `<Image>`; nunca `<img>` a una foto de `public/`.
- Preguntar si los placeholders son temporales antes de hardcodear datos.
- Al repositorio sube solo lo necesario: nada de reportes, volcados ni configuración local
  (`.gitignore`).

## Referencia de diseño

**Bechtel** (bechtel.com): secciones claro/oscuro alternadas, tipografía grande y bold,
imágenes dramáticas, KPIs integrados en el layout.

## Documentación

| Doc | Contenido |
|---|---|
| [docs/arquitectura.md](docs/arquitectura.md) | Estructura, datos compartidos, CSS, `main.ts`, el mapa |
| [docs/contenido.md](docs/contenido.md) | Colecciones, imágenes, cifras y contrato del formulario |
| [docs/deploy.md](docs/deploy.md) | CI/CD, dominios, `.htaccess`, indexación |
