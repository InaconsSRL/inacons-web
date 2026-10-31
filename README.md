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
| `npm run check` | Tipos y esquemas de contenido; falla si un `.md` no cumple su schema |

## Publicar

Push a `main`. GitHub Actions comprueba tipos, compila y sube `dist/` a cPanel por FTP.
Ver [docs/deploy.md](docs/deploy.md).

Los formularios (contacto y Canal Ético) los recibe un Cloudflare Worker aparte, en
`workers/contacto/`, que **no** se publica con el push: se despliega a mano.

## Editar contenido

Servicios, proyectos, recursos y certificaciones son archivos Markdown en
`src/content/`; las cifras y los datos de contacto, `src/data/empresa.ts`. Se edita y se
hace push. Guía en [docs/contenido.md](docs/contenido.md).

## Documentación

| Doc | Para qué |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Reglas del repositorio y dónde va cada cosa |
| [docs/arquitectura.md](docs/arquitectura.md) | Estructura de carpetas, rutas, CSS, scripts y lo que un cambio grande no puede romper |
| [docs/contenido.md](docs/contenido.md) | Editar contenido y contrato de los formularios |
| [docs/deploy.md](docs/deploy.md) | CI/CD, Worker, dominios, `.htaccess`, indexación |
| [docs/bitacora.md](docs/bitacora.md) | Lista única de pendientes y qué se hizo en cada sesión |

---

Cliente: INACONS S.R.L. · Repositorio privado.
