# inacons.com.pe

Sitio web corporativo de **INACONS S.R.L.**, empresa peruana de ingeniería y
construcción con más de 15 años ejecutando proyectos en todo el país.

Sitio estático hecho con Astro 6. Sin base de datos, sin framework de UI y con solo dos
dependencias: `astro` y `@astrojs/sitemap`.

**Producción:** [home.inacons.com.pe](https://home.inacons.com.pe)

## Empezar

```bash
npm install
npm run dev        # http://localhost:4321
```

Requiere **Node ≥ 22.12.0**.

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga en caliente |
| `npm run build` | Genera el sitio en `dist/` |
| `npm run preview` | Sirve el build para revisarlo antes de publicar |

## Publicar

Push a `main`. GitHub Actions compila y sube `dist/` a cPanel por FTP. No hay paso
manual. Detalles y configuración en [docs/deploy.md](docs/deploy.md).

## Editar contenido

Los proyectos, servicios y recursos son archivos Markdown en `src/content/`. Para
agregar un proyecto se crea un `.md` nuevo con su frontmatter y se hace push — el sitio
se regenera solo.

La guía completa, con los campos de cada tipo y las reglas de imágenes, está en
[docs/contenido.md](docs/contenido.md).

## Documentación

| Doc | Para qué |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Reglas y contexto para agentes de IA que trabajen en el repo |
| [docs/arquitectura.md](docs/arquitectura.md) | Cómo está armado el sitio: estructura, CSS, JavaScript, el mapa, el home |
| [docs/contenido.md](docs/contenido.md) | Agregar y editar proyectos, servicios, recursos e imágenes |
| [docs/deploy.md](docs/deploy.md) | CI/CD, hosting, dominios, `.htaccess`, indexación |
| [docs/performance.md](docs/performance.md) | Core Web Vitals, pendientes de optimización, historial |
| [docs/formularios.md](docs/formularios.md) | Backends de Google Apps Script, captura de leads, QR |

## Estructura rápida

```
src/pages/        páginas del sitio
src/content/      proyectos, servicios y recursos en Markdown
src/components/   MediaCard, CtaBand, PageHero
src/layouts/      BaseLayout — head, nav, footer
public/assets/    CSS, JS, imágenes, video, documentos
```

El detalle está en [docs/arquitectura.md](docs/arquitectura.md).

---

Cliente: INACONS S.R.L. · Repositorio privado.
