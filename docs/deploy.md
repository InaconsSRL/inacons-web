# Deploy e infraestructura

## Cómo se publica

Push a `main` → GitHub Actions (`.github/workflows/deploy.yml`) → `npm ci` →
`npm run build` → sube `dist/` por FTP a cPanel.

- Runner: `ubuntu-latest`, Node 22, caché de npm.
- Acción de subida: `SamKirkland/FTP-Deploy-Action@v4.3.5`.
- Destino: `/sites/home.inacons.com.pe/`.

Secrets requeridos en el repositorio de GitHub:

| Secret | Qué es |
|---|---|
| `FTP_SERVER` | Host FTP del cPanel |
| `FTP_USERNAME` | Usuario FTP |
| `FTP_PASSWORD` | Contraseña FTP |

No hay entorno de staging separado: `home.inacons.com.pe` **es** producción.

## Dominios — el problema pendiente

El host real de la web es **`home.inacons.com.pe`**. El dominio `inacons.com.pe`
redirige **solo la raíz**: `/` hace 301 a home, pero `/servicios`, `/nosotros/` y
cualquier otra ruta devuelven **404**.

Consecuencia: `astro.config.mjs` declara `site: 'https://inacons.com.pe'`, así que todos
los canonical y el sitemap apuntan a URLs que dan 404.

Se arregla con un `.htaccess` en el docroot de `inacons.com.pe` que reenvíe **todas** las
rutas, no solo `/`. Mientras tanto, cualquier URL que se comparta hacia afuera debe usar
`home.inacons.com.pe`.

**Los enlaces internos deberían llevar barra final, y hoy ninguno la lleva.** Astro genera
`ruta/index.html`; Apache responde 301 en `/ruta` y 200 en `/ruta/`. Los 56 enlaces internos
del repo van sin barra, así que cada navegación interna pasa por un 301 y aterriza en una
URL distinta de la canónica, que sí la lleva. Al escribir enlaces nuevos usar `/servicios/`;
migrar los existentes es un pendiente registrado.

## public/.htaccess

Se copia tal cual al build. Contiene cuatro bloques:

**1. Página de error** — `ErrorDocument 404 /404.html`.

**2. URL corta para QR** — `home.inacons.com.pe/r/CODIGO` → `/empresa/?c=CODIGO` (302).
Usar siempre el host `home.…` en un QR, nunca `inacons.com.pe`: el dominio principal hace
301 a home, así que entrar por él agrega un salto al inicio y otro al final. Son cuatro
redirecciones en vez de dos, sobre la wifi saturada de un pabellón de feria. Menos
caracteres significa menos módulos y un QR más legible. Ver [formularios.md](formularios.md).

**3. Compresión** — Deflate/gzip para html, css, js, json, svg, pdf y fuentes.

**4. Caché** — ya aplicada: imágenes, css, js y fuentes a 1 año; PDF a 6 meses; mp4 a 1
mes; html a 0 segundos.

**5. Cabeceras de seguridad** — `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options:
nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`
(cámara y micrófono bloqueados, geolocalización solo same-origin) y HSTS a un año con
`includeSubDomains`.

## Indexación

`robots.txt` bloquea `/formulario/` y `/recursos/`. El sitemap, generado por
`@astrojs/sitemap`, filtra además `/expomina/` — es una campaña, no contenido del sitio.

Los dos ajustes hay que hacerlos **en paralelo**: el filtro del sitemap está en
`astro.config.mjs` y el `Disallow` en `public/robots.txt`. Si se agrega una ruta interna
nueva, va en los dos.

## Panel PHP

`public/empresa/` es un panel de QR dinámicos en PHP que corre en el mismo cPanel:
`index.php` resuelve el código y redirige, `admin.php` administra los destinos.
`config.php` está en `.gitignore` — contiene credenciales de MySQL y no se versiona.

Es la única parte del sitio que no es estática.
