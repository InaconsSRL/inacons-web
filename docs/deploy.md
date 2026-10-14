# Deploy e infraestructura

## Cómo se publica

Push a `main` → GitHub Actions (`.github/workflows/deploy.yml`) → `npm ci` →
`npm run build` → `dist/` se guarda como artefacto 90 días → subida por FTP a
`public_html/sites/home.inacons.com.pe/` en cPanel, con una cuenta FTP cuya raíz es esa
carpeta: el deploy no puede tocar nada más del hosting.

No hay staging: `home.inacons.com.pe` **es** producción. Para volver a una versión
anterior se descarga el artefacto `dist-<sha>` de ese run y se sube.

| Configuración en GitHub | Tipo | Qué es |
|---|---|---|
| `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD` | Secret | Acceso FTP del cPanel |
| `PUBLIC_CONTACT_ENDPOINT` | Variable | Destino del formulario de contacto. Opcional y público |
| `PUBLIC_ANALYTICS_TOKEN` | Variable | Token de Cloudflare Web Analytics. Sin él no se carga analítica |
| `FTP_PROTOCOL` | Variable | `ftps` si el hosting llegara a aceptar TLS. Vacía → `ftp` sin cifrar |

### Límites del plan de hosting

El plan contratado en Ecohosting Perú no ofrece, y el proveedor no habilita:

- **FTP cifrado (FTPS) ni SSH.** La contraseña del deploy viaja sin cifrar. Se mitiga así:
  - La cuenta `web@inacons.com.pe` tiene como raíz `public_html/sites/home.inacons.com.pe`
    y no ve nada más del hosting. Nunca se usa la cuenta principal `ene06ind`.
  - Su contraseña es exclusiva de esa cuenta y se cambia (cPanel y secret `FTP_PASSWORD`)
    si hay sospecha de filtración o cuando alguien con acceso deja el equipo.
- **Control del `Cache-Control`.** Un proxy delante de Apache añade un segundo valor a cada
  respuesta. No rompe nada (ver la sección de caché).

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

**Caché** (solo con `mod_headers`; `mod_expires` duplicaba `Cache-Control`):

- `/_astro/` → un año, `immutable`. Todo lo que procesa Astro lleva hash en el nombre.
- Archivos de `public/` con nombre fijo → 30 días.
- HTML → `no-cache, must-revalidate`, para que un despliegue se vea al instante.

Toda respuesta trae además un segundo `Cache-Control` que añade un proxy del hosting
delante de Apache. No se puede quitar desde `.htaccess` (probado) y el plan no permite
cambiarlo: el HTML se sigue revalidando siempre por `no-cache`.

**Sitio anterior**: los `.html` de la raíz (`/nosotros.html`, `/obras-civiles.html`…) y
los PDF que vivían en la raíz redirigen con 301 a su página o archivo actual. Cualquier otro
`.html` de la raíz va al inicio. El deploy solo borra lo que él mismo subió, así que esos
archivos viejos pueden seguir en el servidor sin que nadie llegue a verlos.

**Seguridad**: `Options -Indexes`, `X-Frame-Options`, `X-Content-Type-Options`,
`Referrer-Policy`, `Permissions-Policy` y HSTS.

## Indexación

Dos listas en paralelo: el filtro del sitemap (`SECCIONES_PRIVADAS` en
`astro.config.mjs`) y los `Disallow` de `public/robots.txt`.

- `/sistema/` → fuera del sitemap y bloqueada en `robots.txt`.
- `/privacidad/` → fuera del sitemap y con `noindex` mientras sea borrador.
- `/recursos/` → fuera del sitemap y con `noindex`, pero **no** en `robots.txt`: una URL
  bloqueada no se rastrea y nadie leería su `noindex`.
