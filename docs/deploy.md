# Deploy e infraestructura

## Cómo se publica

Push a `main` → GitHub Actions (`.github/workflows/deploy.yml`) → `npm ci` →
`npm run build` → `dist/` se guarda como artefacto 90 días → subida por FTP a
`/sites/home.inacons.com.pe/` en cPanel.

No hay staging: `home.inacons.com.pe` **es** producción. Para volver a una versión
anterior se descarga el artefacto `dist-<sha>` de ese run y se sube.

| Configuración en GitHub | Tipo | Qué es |
|---|---|---|
| `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD` | Secret | Acceso FTP del cPanel |
| `PUBLIC_CONTACT_ENDPOINT` | Variable | Destino del formulario de contacto. Opcional y público |
| `PUBLIC_ANALYTICS_TOKEN` | Variable | Token de Cloudflare Web Analytics. Sin él no se carga analítica |

## Dominios

El host del sitio es **`home.inacons.com.pe`**, declarado en `site` de `astro.config.mjs`.
Es la única fuente del dominio: canonical, sitemap, Open Graph y JSON-LD salen de ahí.

`inacons.com.pe` y `www` redirigen solo la raíz a `home`; cualquier otra ruta da 404 en
ese host. Toda URL que se comparta o se imprima usa `home.inacons.com.pe`.

Los enlaces internos llevan **barra final** (`/servicios/`): Apache sirve
`ruta/index.html` y responde 301 en `/ruta`. `trailingSlash: 'always'` hace que el
servidor de desarrollo avise si falta.

## public/.htaccess

Se copia tal cual al build.

**Redirecciones de QR impresos.** Hay papel en circulación con QR hacia `/r/CODIGO`,
`/empresa/?c=CODIGO` y `/expomina/`. El redirector dinámico se retiró, así que estas URL
se resuelven con reglas fijas:

| Origen | Destino |
|---|---|
| `/r/CANAL_ETICO`, `/empresa/?c=canal_etico` | `/canal-etico/` |
| `/r/TICKETS_TI`, `/empresa/?c=tickets_ti` | `https://materen-ti.vercel.app/soporte` |
| `/r/EXPOMINA_FORM` | `/mineria/` |
| `/expomina/` | `/mineria/` (301) |
| cualquier otro `/r/…` o `/empresa/…` | `/` |

Son 302 para que el sistema nuevo pueda tomar `/r/` sin pelear con redirecciones
permanentes guardadas en los navegadores. **Llevan `[NC]` y no es opcional**: los QR se
codificaron en mayúsculas y el escaneo llega como `/R/CANAL_ETICO`; sin `[NC]` el papel da
404 aunque tecleado en minúsculas funcione.

**Caché** (solo con `mod_headers`; el `mod_expires` del servidor se apaga con `ExpiresActive Off`):

- `/_astro/` → un año, `immutable`. Todo lo que procesa Astro lleva hash en el nombre.
- Archivos de `public/` con nombre fijo → 30 días.
- HTML → `no-cache, must-revalidate`, para que un despliegue se vea al instante.

Si una respuesta vuelve a traer dos `Cache-Control`, el segundo lo pone un proxy delante
de Apache y se quita desde el panel del hosting.

**Seguridad**: `Options -Indexes`, `X-Frame-Options`, `X-Content-Type-Options`,
`Referrer-Policy`, `Permissions-Policy` y HSTS.

## Indexación

Dos listas en paralelo: el filtro del sitemap (`SECCIONES_PRIVADAS` en
`astro.config.mjs`) y los `Disallow` de `public/robots.txt`.

- `/sistema/` → fuera del sitemap y bloqueada en `robots.txt`.
- `/privacidad/` → fuera del sitemap y con `noindex` mientras sea borrador.
- `/recursos/` → fuera del sitemap y con `noindex`, pero **no** en `robots.txt`: una URL
  bloqueada no se rastrea y nadie leería su `noindex`.
