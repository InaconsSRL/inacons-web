# inacons.com.pe

Sitio web corporativo de **INACONS S.R.L.**, empresa peruana de ingeniería y
construcción. Sitio estático hecho con Astro, sin backend ni base de datos.

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

Push a `main`. GitHub Actions compila y sube `dist/` a cPanel por FTP. Ver
[docs/deploy.md](docs/deploy.md).

## Editar contenido

Servicios, proyectos, recursos y certificaciones son archivos Markdown en
`src/content/`; las cifras y los datos de contacto, `src/data/empresa.ts`. Se edita y se
hace push. Guía en [docs/contenido.md](docs/contenido.md).

## Estructura

```
src/pages/        páginas
src/content/      servicios, proyectos, recursos y certificaciones (Markdown)
src/data/         datos de empresa y cifras del brochure
src/components/   PageHero, MediaCard, CtaBand, Icono, SellosCertificacion
src/layouts/      BaseLayout — head, nav, footer
src/styles/       sistema de diseño
src/scripts/      comportamiento compartido
src/assets/       fotos (optimizadas en el build)
public/           PDF, vídeo, logos, flyers y .htaccess
```

| Doc | Para qué |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Reglas del repositorio |
| [docs/arquitectura.md](docs/arquitectura.md) | Cómo está armado el sitio |
| [docs/contenido.md](docs/contenido.md) | Editar contenido y contrato del formulario |
| [docs/deploy.md](docs/deploy.md) | CI/CD, dominios, `.htaccess` |

---

Cliente: INACONS S.R.L. · Repositorio privado.
