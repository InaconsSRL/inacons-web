# Deploy e infraestructura

## Cómo se publica

Push a `main` → GitHub Actions (`.github/workflows/deploy.yml`) → `npm ci` →
`npm run build` → sube `dist/` por FTP a cPanel.

Hay un segundo workflow, `latido.yml`, que no despliega nada — ver
[Latido](#latido-contra-la-suspensión).

- Runner: `ubuntu-latest`, Node 22, caché de npm.
- Acción de subida: `SamKirkland/FTP-Deploy-Action@v4.3.5`.
- Destino: `/sites/home.inacons.com.pe/`.

No hay entorno de staging separado: `home.inacons.com.pe` **es** producción.

### Secrets del repositorio de GitHub

| Secret | Qué es |
|---|---|
| `FTP_SERVER` | Host FTP del cPanel |
| `FTP_USERNAME` | Usuario FTP |
| `FTP_PASSWORD` | Contraseña FTP |
| `PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase |
| `PUBLIC_SUPABASE_ANON_KEY` | Clave `anon` del proyecto |

Los dos últimos están como secrets por comodidad, no por secreto: Astro los
inserta dentro del JavaScript en el build y terminan siendo públicos igual. Ver
[Supabase](#supabase) más abajo.

## Dominios

El host real de la web es **`home.inacons.com.pe`**, y así lo declara `site` en
`astro.config.mjs`. Ese valor es la **única** fuente del dominio en todo el
repositorio: canonical, Open Graph, JSON-LD y sitemap salen de ahí vía
`Astro.site`. Nada lo escribe a mano, y nada debería volver a hacerlo.

El dominio `inacons.com.pe` redirige **solo la raíz**: `/` hace 301 a home, pero
`/servicios`, `/nosotros/` y cualquier otra ruta devuelven **404**. Por eso el
canónico no es ese. Se arreglaría con un `.htaccess` en el docroot de
`inacons.com.pe` que reenvíe todas las rutas, no solo `/`; mientras tanto,
cualquier URL que se comparta hacia afuera usa `home.inacons.com.pe`.

**Los enlaces internos deberían llevar barra final, y hoy ninguno la lleva.**
Astro genera `ruta/index.html`; Apache responde 301 en `/ruta` y 200 en `/ruta/`.
Los 56 enlaces internos del repo van sin barra, así que cada navegación interna
pasa por un 301 y aterriza en una URL distinta de la canónica, que sí la lleva.
Al escribir enlaces nuevos usar `/servicios/`; migrar los existentes es un
pendiente registrado.

## Supabase

Datos, autenticación y, más adelante, storage y Edge Functions. Ver
[ESPECIFICACION.md](ESPECIFICACION.md) §6.

### Variables de entorno

En local van en `.env` (ignorado por git); en CI, en los secrets de GitHub.
`.env.example` documenta cuáles son sin revelar valores.

```
PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

El prefijo `PUBLIC_` no es decorativo: es lo que hace que Astro inserte el valor
dentro del bundle del navegador. Sin él, la variable existe solo durante el build
y el panel se queda sin conexión.

**Qué es pública y qué no:**

- La clave **`anon`** es pública por diseño. Viaja dentro del JavaScript que
  descarga cualquier visitante. No es una fuga, y esconderla no protegería nada.
  Lo que impide que sirva para algo es RLS.
- La clave **`service_role`** se salta RLS entera. Quien la tenga tiene la base
  completa sin login. **No va en este repositorio, ni en secrets de build, ni en
  ninguna variable con prefijo `PUBLIC_`.**

### Migraciones

`supabase/migrations/` se ejecuta a mano en el SQL Editor de Supabase, **en
orden**, una sola vez:

| Archivo | Qué hace |
|---|---|
| `0001_esquema.sql` | Tablas, tipos, triggers y funciones |
| `0002_rls.sql` | Row Level Security. **Sin esto la base está abierta** |
| `0003_agregados.sql` | `escaneos_diarios` + tarea de `pg_cron` |
| `0005_redirector.sql` | Permiso de `resolver_qr()` al rol anónimo + validación de host |
| `0006_migrar_codigos.sql` | Los cuatro códigos de MySQL, con su nombre exacto |
| `0007_codigo_tolerante.sql` | El guión bajo y el medio son el mismo código |
| `0008_codigo_existe.sql` | Comprobación sin registrar escaneo — la usa el build |
| `0009_panel.sql` | `reasignar_qr()` y permisos del panel |
| `0010_latido.sql` | Tabla y función del latido |
| `0011_saneamiento_escaneos.sql` | `resolver_qr()` deja de guardar user-agent/referrer en escaneos que no son `ok` + purga de `escaneos` a 90 días |

Entre `0001` y `0002` las tablas existen sin protección. Se ejecutan seguidos.

Los datos de ejemplo que antes eran `0004_datos_prueba.sql` viven ahora en
`supabase/semillas/datos_prueba.sql`, fuera de esta carpeta a propósito: no es una
migración, es una semilla para verificar RLS a mano en un proyecto de prueba, y
reejecutarla contra producción mete códigos QR falsos en un sistema con papel
circulando. Ver el encabezado del archivo.

Cada archivo va en **una sola transacción**: el SQL Editor ejecuta sentencia por
sentencia, así que sin eso un error a la mitad deja la base en un estado intermedio que
hay que deshacer a mano antes de poder reintentar. Y son idempotentes: reejecutar uno no
duplica nada.

### Configuración obligatoria del proyecto

- **Authentication → Sign Ups: desactivado.** El usuario administrador se crea a
  mano desde el panel de Supabase.
- El administrador además tiene que estar en la tabla `administradores`. Estar
  registrado no alcanza: las políticas de RLS consultan esa allowlist. Es lo que
  evita que activar el registro por error abra la base entera.
- **Respaldos.** El plan gratuito no tiene ninguno. Ver ESPECIFICACION.md §10.

### Latido contra la suspensión

El plan gratuito **pausa el proyecto tras una semana sin actividad**. Con QRs
impresos circulando eso es una caída sin aviso: la gente escanea, no llega a
ningún lado, y nadie se entera hasta que alguien se queja.

`.github/workflows/latido.yml` lo evita llamando a `latido()` cada 3 días.

**No se puede resolver con `pg_cron`**, que sería lo natural: `pg_cron` corre
*dentro* de la base, así que si el proyecto se pausa se pausa con él. Lo que lo
mantiene vivo tiene que venir de afuera.

Cada 3 días y no cada 6 porque el cron de Actions es "cuando se pueda", no "a
esta hora": puede retrasarse o saltarse bajo carga. Con ese período hacen falta
dos fallos seguidos para llegar a los 7 días.

El latido **escribe** en vez de leer. Una escritura es actividad sin ambigüedad,
y no conviene averiguar cómo mide Supabase una lectura el día que el proyecto
amanezca pausado. Además deja rastro: si la tarea muere en silencio —GitHub
desactiva los cron de repositorios inactivos durante 60 días—, `latidos.ultimo`
lo dice; sin eso la primera señal sería la pausa.

> **Esto no reemplaza al plan de pago.** Evita la pausa, no los respaldos: el
> plan gratuito no tiene ninguno, y eso no lo arregla ningún script. Cuando
> entren contactos de personas reales (Fase 4), esa sigue siendo la razón para
> pagar — no la pausa.

### Comprobar que RLS funciona

`/panel/`, ya con sesión, tiene un botón ("Probar aislamiento (RLS)") que intenta
leer cada tabla de `TABLAS` (`src/lib/supabase.ts`) con un cliente **sin sesión**,
usando la clave anónima. Todas tienen que salir bloqueadas. Solo prueba lectura, y
alcanza: con RLS activo y cero políticas, Postgres niega **todo** comando sobre esa
tabla, no solo el que se prueba — bloquear el `SELECT` ya certifica que
`INSERT`/`UPDATE`/`DELETE` están igual de cerrados.

Es el criterio de aceptación de la Fase 1 y conviene repetirlo cada vez que se
agregue una tabla o se toque una política — y agregar la tabla nueva a `TABLAS` en
el mismo commit que la crea: esta lista se escribe a mano, no se deriva del
catálogo de Postgres, y ya pasó una vez que una tabla (`latidos`, 0010) se quedó
fuera sin que nada lo señalara.

## public/.htaccess

Se copia tal cual al build. Contiene cinco bloques:

**1. Página de error** — `ErrorDocument 404 /404.html`.

**2. URL corta para QR** — `/r/CODIGO` se reescribe **internamente** a
`public/r/index.php`, que resuelve contra Supabase y hace el 302. Reescritura interna y no
redirección: el visitante no paga un salto de más y la URL que ve sigue siendo la corta.

La regla lleva **`[NC]`, y no es opcional**. El módulo codifica la URL entera en
mayúsculas, así que lo que llega de un escaneo es `/R/CODIGO`. Sin `[NC]`, `^r/` no
engancha y Apache devuelve 404 antes de que el PHP se ejecute: el código existe, la base
está bien, y solo falla lo que sale de un escaneo real. Todas las pruebas tecleadas en
minúsculas pasan.

`/empresa/?c=CODIGO` queda como **301 de compatibilidad** hacia `/r/CODIGO`, para el
material ya impreso. Cuesta tres líneas y evita papel muerto.

> **Las dos reglas son inversas entre sí.** Antes de la Fase 2, `/r/X` redirigía a
> `/empresa/?c=X`; ahora es al revés. Tenerlas a la vez es un bucle infinito de
> redirecciones, por eso la vieja se borró en el mismo commit que entró esta. Si alguna
> vez hay que revertir, se revierten las dos juntas.

Usar siempre el host `home.…` en un QR, nunca `inacons.com.pe`: el dominio principal hace
301 a home, así que entrar por él agrega un salto al inicio y otro al final. Son cuatro
redirecciones en vez de dos, sobre la wifi saturada de un pabellón de feria. Ver
[formularios.md](formularios.md).

**3. Compresión** — Deflate/gzip para html, css, js, json, svg, pdf y fuentes.

**4. Caché** — y acá hay una trampa que costó encontrar.

El hosting **inyecta su propio `Cache-Control` por encima** de lo que declare
`mod_expires`, y cuando la respuesta lleva los dos, `Cache-Control: max-age` le gana a
`Expires`. Medido en producción: el HTML salía con `Expires: <ahora>` —el "0 segundos" del
`.htaccess`, aplicado correctamente— y a la vez `max-age=3600`. Ganaba el segundo, así que
**cada despliegue tardaba hasta una hora en llegarle a quien ya había visitado el sitio**.
El síntoma parecía un fallo de la aplicación y era una cabecera.

Por eso lo que importa se fija con `mod_headers`, que el hosting sí respeta:

- **HTML** → `no-cache, must-revalidate`. El navegador pregunta siempre y recibe 304 si no
  cambió nada, así que no cuesta ancho de banda.
- **`/_astro/`** → `max-age=31536000, immutable`. Astro les pone un hash en el nombre:
  cambiar el contenido cambia la URL, así que la respuesta vieja nunca queda obsoleta.
- **CSS y JS de `public/`** → 1 día, **no 1 año**. `design-system.css` y `main.js` tienen
  nombre fijo: cachearlos un año significa que un arreglo de estilos no llega durante un
  año a quien ya visitó el sitio, sin forma de corregirlo salvo renombrar el archivo. Esa
  regla llevaba tiempo escrita y no hizo daño solo porque el hosting la estaba pisando.
- Imágenes y fuentes a 1 año, PDF a 6 meses, mp4 a 1 mes.

**La cabecera del hosting no se puede quitar**: la agrega después de que corren las reglas
del `.htaccess`, así que `unset` no la alcanza. Quedan las dos, con la nuestra primero; por
norma `no-cache` gana al combinarse. Si algún día algo se ve raro tras un despliegue, este
es el primer sitio donde mirar.

**5. Cabeceras de seguridad** — `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options:
nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`
(cámara y micrófono bloqueados, geolocalización solo same-origin) y HSTS a un año con
`includeSubDomains`.

## Indexación

Dos listas que hay que mantener **en paralelo**: el filtro del sitemap en
`astro.config.mjs` y los `Disallow` de `public/robots.txt`. Una ruta interna
nueva va en las dos.

Hoy quedan fuera del sitemap y del rastreo: `/panel/`, `/sistema/`, `/empresa/`,
`/recursos/`, `/formulario/` y `/expomina/`.

El filtro compara el **primer segmento** de la ruta, no la URL entera. La versión
anterior buscaba la palabra en cualquier posición, así que una futura
`/proyectos/recursos-hidricos/` habría quedado fuera del sitemap sin que nadie lo
notara: no hay error, solo una página que Google no encuentra.

## Panel PHP

`public/empresa/` es un panel de QR dinámicos en PHP que corre en el mismo cPanel:
`index.php` resuelve el código y redirige, `admin.php` administra los destinos.
`config.php` está en `.gitignore` — contiene credenciales de MySQL y no se versiona.

Es la única parte del sitio que no es estática.

**Sigue en pie hasta que `/panel/` haga lo mismo.** El 301 de `/empresa/admin.php`
se activa al final de la Fase 3, no antes: desviarlo a un panel que todavía no
administra códigos deja al administrador sin herramienta.
