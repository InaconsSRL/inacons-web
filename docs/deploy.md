# Deploy e infraestructura

## Cómo se publica

Push a `main` → GitHub Actions (`.github/workflows/deploy.yml`):

1. `npm ci` y `npm run check` (tipos y esquemas de contenido).
2. **Exigir variables del formulario**: corta si `PUBLIC_CONTACT_ENDPOINT` o
   `PUBLIC_TURNSTILE_SITE_KEY` están vacías. Sin esto el build sale en verde y los
   formularios quedan sin envío (pasó dos veces, ver la bitácora).
3. `npm run build`, y una comprobación de que `dist/contacto/` y `dist/canal-etico/`
   traen `cf-turnstile`.
4. `dist/` se guarda como artefacto 90 días.
5. Subida por FTP a `public_html/sites/home.inacons.com.pe/` en cPanel, con una cuenta FTP
   cuya raíz es esa carpeta: el deploy no puede tocar nada más del hosting.
6. **Humo posterior**: pide `/contacto/` y `/canal-etico/` ya publicadas (con un query
   para saltar la caché del proxy) y exige `cf-turnstile`. Avisa, no deshace el deploy.

Un segundo job, `worker`, corre en paralelo: `tsc` sobre `workers/contacto/`. No bloquea la
publicación del sitio, pero deja el workflow en rojo. El Worker sigue desplegándose a mano.

Las acciones de GitHub están fijadas por SHA de commit, con la versión en un comentario.
Dependabot (`.github/dependabot.yml`, semanal) abre los PR que mueven SHA y comentario
juntos. Para fijar una a mano: `git ls-remote --tags https://github.com/<owner>/<repo>.git
<tag>` da el SHA.

No hay staging: `home.inacons.com.pe` **es** producción. Para volver a una versión
anterior se descarga el artefacto `dist-<sha>` de ese run y se sube.

| Configuración en GitHub | Tipo | Qué es |
|---|---|---|
| `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD` | Secret | Acceso FTP del cPanel |
| `PUBLIC_CONTACT_ENDPOINT` | Variable | URL del Worker de contacto. Opcional y público |
| `PUBLIC_TURNSTILE_SITE_KEY` | Variable | Clave de sitio de Turnstile. Pública; solo se usa con endpoint |
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

## Worker del formulario de contacto

`workers/contacto/` no se publica con el push: es un Cloudflare Worker que se despliega
a mano desde esa carpeta. Usa la cuenta de Cloudflare de la empresa, Zoho CPaaS (ex
ZeptoMail) para enviar y una base D1 para guardar la copia de cada consulta.

**Antes, en Zoho CPaaS:** dominio `inacons.com.pe` verificado (un TXT `…._domainkey` y un
CNAME de rebotes en el Editor de zona DNS del cPanel, sin tocar el SPF ni el `_dmarc`
existentes) y el Agent `web-contacto` asociado al dominio. En su pestaña *SMTP/API* están
la clave API (secret `CPAAS_TOKEN`) y el anfitrión de la API, que con `/v1.1/email` es
`CPAAS_URL` en `wrangler.jsonc`.

**Antes, en Cloudflare → Turnstile:** un widget para `home.inacons.com.pe` y `localhost`.
Da una clave de sitio (variable `PUBLIC_TURNSTILE_SITE_KEY` en GitHub) y una secreta
(secret del Worker).

**Primera vez**, desde `workers/contacto/`:

```bash
npm ci
npx wrangler login
npx wrangler d1 create inacons-contacto      # copiar el database_id a wrangler.jsonc
npx wrangler d1 execute inacons-contacto --remote --file=schema.sql
npx wrangler secret put CPAAS_TOKEN
npx wrangler secret put TURNSTILE_SECRET
npx wrangler secret put IP_SALT               # cualquier texto aleatorio largo
npx wrangler deploy                           # imprime la URL *.workers.dev
```

La URL que imprime `deploy` va en la variable `PUBLIC_CONTACT_ENDPOINT` de GitHub. El
siguiente push del sitio ya envía al Worker. Hoy es
`https://inacons-contacto.inacons-contacto.workers.dev`, en la cuenta de Cloudflare de
`soporteinformatico.inacons@gmail.com`.

**Cambios posteriores:** `npx wrangler deploy` desde la carpeta. Los secrets no se
vuelven a poner.

**Probar contra el sitio local.** `ORIGENES` en `wrangler.jsonc` es solo
`https://home.inacons.com.pe`: el Worker publicado rechaza `localhost`. Para `npm run dev`
del sitio, `.dev.vars` (copia de `.dev.vars.example`) trae `ORIGENES` con
`http://localhost:4321` añadido, y ahí pisa al valor del archivo. Si el widget de Turnstile
todavía incluye `localhost` entre sus dominios, conviene quitarlo desde su panel.

**Ver las consultas** (una con `estado = 'error'` es una que ventas no recibió):

```bash
npx wrangler d1 execute inacons-contacto --remote --command "SELECT id, creado, nombre, correo, servicio, estado FROM consultas ORDER BY id DESC LIMIT 20"
```

**Ver los reportes del Canal Ético** (solo quien gestiona cumplimiento debería hacerlo):

```bash
npx wrangler d1 execute inacons-contacto --remote --command "SELECT codigo, creado, tipo, modalidad, estado FROM reportes ORDER BY id DESC LIMIT 20"
```

**Cambios en `schema.sql`:** se vuelve a aplicar con el mismo `d1 execute … --file`; todas
las sentencias son `IF NOT EXISTS`, así que no tocan lo que ya existe.

**Errores de envío:** Cloudflare → Workers → `inacons-contacto` → Logs. Solo aparecen los
fallos, con el número de consulta o reporte: el registro automático de cada petición está
apagado (`invocation_logs: false`) para que el Canal Ético no deje datos de conexión.

## Cloudflare Web Analytics

Mide visitas sin cookies. `BaseLayout.astro` carga el beacon solo si el build trae
`PUBLIC_ANALYTICS_TOKEN`; sin la variable no se pide ningún script a Cloudflare.

**Dónde sale el token:** Cloudflare → Analytics → Web Analytics → *View Web Analytics
sites* → `home.inacons.com.pe` → *Manage site*, en el snippet
`data-cf-beacon='{"token": "…"}'`. El dominio no está en Cloudflare (el sitio vive en
cPanel), por eso se usa el snippet manual y no la configuración automática.

**En la variable va solo el valor del token**, la cadena de 32 caracteres, no el snippet
completo. Con el snippet pegado el build sale en verde pero el HTML publicado trae un
`data-cf-beacon` roto y no se registra nada. Se comprueba tras el deploy:

```bash
curl -s https://home.inacons.com.pe/ | grep -o 'data-cf-beacon="[^"]*"'
```

Debe imprimir `{"token":"<32 caracteres>"}` y nada más.

**Cambiar el token:** actualizar la variable y volver a lanzar el deploy (*Re-run all jobs*
basta: las variables se leen en cada build).

Los datos tardan de minutos a más de una hora en aparecer, y INP y CLS solo se llenan con
visitas que interactúan con la página.

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

- `/sistema/` → no existe en producción: solo se genera con `npm run dev`. Tampoco
  aparece en `robots.txt`, porque ahí anunciaría una página interna. `npm run preview` sirve
  el build, así que tampoco la muestra.
- `/privacidad/` → fuera del sitemap y con `noindex` mientras sea borrador. **Se publica con
  un solo cambio**: `PRIVACIDAD_PUBLICADA = true` en `src/data/empresa.ts`. Ese valor indexa
  la página, la mete en el sitemap y la enlaza desde el pie, `/contacto/` y los términos del
  Canal Ético. Antes, el abogado tiene que cerrar lo marcado *pendiente* en la página.
- `/mineria/` → fuera del sitemap y con `noindex, follow`. Es la landing del stand de
  Expomina y el destino de los QR impresos (siguen funcionando); no compite con
  `/servicios/mineria/`. Si se quiere posicionarla, se quita de `SECCIONES_PRIVADAS` y su
  `robots` en `mineria.astro`.
- `/recursos/` → fuera del sitemap y con `noindex`, pero **no** en `robots.txt`: una URL
  bloqueada no se rastrea y nadie leería su `noindex`.

### Google Search Console

Propiedad de **dominio** `inacons.com.pe`, verificada por DNS: cubre `home`, la raíz y
`www`, en http y https. Se prefirió a la de prefijo de URL porque el host del sitio podría
cambiar sin perder el historial, y porque no obliga a tocar el HTML.

**Verificación.** Es un registro TXT `google-site-verification=…` en la zona DNS de
`inacons.com.pe`, que vive en el cPanel de Ecohosting (*Editor de zona*), no en Cloudflare.
Convive con el TXT del SPF en el mismo nombre. **No se borra**: sin él Google pierde la
verificación pasados unos días.

**Sitemap.** Enviado como `https://home.inacons.com.pe/sitemap-index.xml`. En una
propiedad de dominio hay que dar la URL completa; la ruta relativa da *Dirección de sitemap
no válida*. Un sitemap recién enviado muestra *No se ha podido obtener* y *Páginas
descubiertas: 0* durante horas o un par de días aunque responda 200; no se reenvía.

**Qué es normal ver en *Páginas*:** `/recursos/`, `/privacidad/` y `/mineria/` como
*Excluida por noindex*. `/sistema/` pudo aparecer antes como *Bloqueada por robots.txt*; ya no
existe en producción, así que pasará a *No se ha encontrado (404)* y desaparece sola. Una
página pública en esa lista sí es un problema.

Al publicar una sección nueva basta con que salga en el sitemap; no hace falta pedir la
indexación a mano salvo para acelerarla.
