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

Un segundo job, `worker`, corre en paralelo: `npm run check` (tipos) y `npm test` (34
pruebas de Vitest) sobre `workers/contacto/`. No bloquea la publicación del sitio, pero deja
el workflow en rojo. El Worker sigue desplegándose a mano.

Dos pushes seguidos no se pisan: el workflow usa un `concurrency` que encola el segundo en
vez de cancelar el primero, porque un FTP a medio subir deja el sitio mezclado. Para
redesplegar sin un commit (por ejemplo tras cambiar una variable) basta *Actions → Deploy a
cPanel → Run workflow* (`workflow_dispatch`).

Las acciones de GitHub están fijadas por SHA de commit, con la versión en un comentario.
Dependabot (`.github/dependabot.yml`, semanal) abre los PR que mueven SHA y comentario
juntos. Para fijar una a mano: `git ls-remote --tags https://github.com/<owner>/<repo>.git
<tag>` da el SHA.

No hay staging: `home.inacons.com.pe` **es** producción. Para volver a una versión
anterior se descarga el artefacto `dist-<sha>` de ese run y se sube.

| Configuración en GitHub | Tipo | Qué es |
|---|---|---|
| `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD` | Secret | Acceso FTP del cPanel |
| `PUBLIC_CONTACT_ENDPOINT` | Variable | URL del Worker de contacto. Pública. **El CI corta si está vacía** (en local, vacía = modo `mailto`) |
| `PUBLIC_TURNSTILE_SITE_KEY` | Variable | Clave de sitio de Turnstile. Pública. **El CI corta si está vacía** |
| `PUBLIC_ANALYTICS_TOKEN` | Variable | Token de Cloudflare Web Analytics. Vacía: el CI avisa y el sitio sale sin analítica |
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
npx wrangler secret put IP_SALT               # cualquier texto aleatorio largo; ver abajo
npx wrangler deploy                           # imprime la URL *.workers.dev
```

La URL que imprime `deploy` va en la variable `PUBLIC_CONTACT_ENDPOINT` de GitHub. El
siguiente push del sitio ya envía al Worker. Hoy es
`https://inacons-contacto.inacons-contacto.workers.dev`, en la cuenta de Cloudflare de
`soporteinformatico.inacons@gmail.com`.

**Cambios posteriores:** `npm run check` y `npm test` y, si pasan, `npx wrangler deploy`
desde la carpeta. Los secrets no se vuelven a poner. `contrato.test.ts` lee
`src/content/servicios/` y `canal-etico.astro`: falla si se creó o renombró un servicio, o un
tipo del Canal, sin actualizar la lista copiada en el Worker.

**Variables y secrets.** Las públicas están en `wrangler.jsonc` (`vars`): `ORIGENES` (solo
`https://home.inacons.com.pe`), `CPAAS_URL`, `CORREO_DESTINO`, `CORREO_REMITENTE`,
`ENVIAR_ACUSE` (`si` o se apagan los acuses) y `RETENCION_MESES` (12). Los secrets son
`CPAAS_TOKEN`, `TURNSTILE_SECRET` e `IP_SALT`; `IP_SALT` sazona el hash de la IP que usa el
límite de contacto, así que cambiarla solo reinicia ese límite. El límite del Canal Ético es
el binding `LIMITE_CANAL` (5 por minuto por conexión, en memoria; `period` solo admite 10 o
60 s). Un cron cada 15 minutos reenvía los avisos que no salieron y borra las consultas
más antiguas que `RETENCION_MESES`; los reportes del Canal no se purgan.

**Avisos que no salieron.** Si CPaaS falla o tarda más de 4 s, la consulta o el reporte
queda guardado en `estado = 'error'` y el visitante ve el error. El cron lo reenvía a los
responsables con `[Reenvío]` en el asunto (sin acuse al visitante), hasta 20 filas por
pasada, mientras tenga menos de 7 días. Puede llegar un duplicado si la persona también
reenvió a mano: el n.° de consulta o el código del reporte lo delatan. Lo que siga en
`error` o `recibido` pasados 7 días ya no se reintenta y hay que mirarlo a mano con las
consultas de abajo.

**Tope diario.** Más de 100 consultas, o 100 reportes, en 24 h responden 503 hasta que
baje la cuenta; en Logs queda la línea "se alcanzó el tope". El tráfico real está muy por
debajo: si aparece, es un ataque o hay que subir `TOPE_DIARIO` en `src/comun.ts`.

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
las sentencias son `IF NOT EXISTS`, así que no tocan lo que ya existe. La tabla `limites`
(hash de IP y hora de cada envío del Canal, retirada en `3e78a2f`) no existe en
producción: comprobado el 2026-10-31.

**Errores de envío:** Cloudflare → Workers → `inacons-contacto` → Logs. Solo aparecen los
fallos, con el número de consulta o reporte: el registro automático de cada petición está
apagado (`invocation_logs: false`) para que el Canal Ético no deje datos de conexión. Una
línea `Turnstile: invalid-input-secret` (o `missing-input-secret`) significa que
`TURNSTILE_SECRET` está mal: todos los envíos están dando 403. Un `Error no controlado`
es un 500 (D1 caído, por ejemplo).

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
ese host (comprobado en producción el 2026-10-22). Toda URL que se comparta o se imprima usa
`home.inacons.com.pe`.

**Pendiente:** esa regla vive en el `.htaccess` del docroot del dominio raíz, que no está en
este repositorio. Mientras no conserve la ruta con un 301, los enlaces antiguos al dominio
raíz mueren en 404 (E-01, con la regla propuesta, en los pendientes de la
[bitácora](bitacora.md#pendientes-abiertos)).

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

**Content-Security-Policy, en modo informe.** La cabecera es
`Content-Security-Policy-Report-Only`: no bloquea nada y no hay colector, así que las
violaciones solo se ven abriendo la consola del navegador. Limita qué puede cargar la página
si alguien llegara a inyectar un script (por ejemplo en `/canal-etico/`, donde se escriben
denuncias). Para pasar a bloqueo:

1. Con el sitio publicado, recorrer `/`, `/contacto/` (enviando una consulta de prueba, con
   Turnstile), `/canal-etico/`, `/nosotros/` (vídeo), `/mineria/` y el menú móvil, con la
   consola abierta, y anotar toda violación.
2. Hacerlo de nuevo tras cada cambio de scripts o de proveedores externos, durante dos
   semanas. Cero violaciones → cambiar el nombre de la cabecera a
   `Content-Security-Policy`.

Dos cosas que la rompen en silencio: (a) el script en línea de `/mineria/` está permitido
**por hash** y el hash cambia con cualquier edición de ese script; Chrome indica el hash
esperado en el mensaje de la violación. El del Canal Ético no cuenta: importa
`scripts/formulario.ts` y Astro lo emite como archivo. (b) Un proveedor
nuevo (otro iframe, otro script, otro host de fetch) hay que añadirlo a la directiva que
corresponda. `style-src 'unsafe-inline'` se queda: Astro emite estilos en línea.

## Indexación

La lista que manda es el filtro del sitemap (`SECCIONES_PRIVADAS` en `astro.config.mjs`),
más el `robots` de cada página. `public/robots.txt` **no tiene ningún `Disallow`**: solo
`Allow: /` y la URL del sitemap. Es a propósito: una URL bloqueada ahí no se rastrea y
nadie leería su `noindex`, y listar una página interna la anunciaría.

- `/sistema/` → no existe en producción: solo se genera con `npm run dev`. `npm run preview`
  sirve el build, así que tampoco la muestra.
- `/privacidad/` → fuera del sitemap y con `noindex` mientras sea borrador. **Se publica con
  un solo cambio**: `PRIVACIDAD_PUBLICADA = true` en `src/data/empresa.ts`. Ese valor indexa
  la página, la mete en el sitemap y la enlaza desde el pie, `/contacto/` y los términos del
  Canal Ético. Antes, el abogado tiene que cerrar lo marcado *pendiente* en la página.
- `/mineria/` → fuera del sitemap y con `noindex, follow`. Es la landing del stand de
  Expomina y el destino de los QR impresos (siguen funcionando); no compite con
  `/servicios/mineria/`. Si se quiere posicionarla, se quita de `SECCIONES_PRIVADAS` y su
  `robots` en `mineria.astro`.
- `/recursos/` → fuera del sitemap y con `noindex`. Material interno con los flyers.

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
