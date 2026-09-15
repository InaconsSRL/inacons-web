# Deploy e infraestructura

## Cómo se publica

Push a `main` → GitHub Actions (`.github/workflows/deploy.yml`) → `npm ci` →
`npm run build` → sube `dist/` por FTP a cPanel.

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
| `0004_datos_prueba.sql` | Filas de ejemplo, borrables |

Entre `0001` y `0002` las tablas existen sin protección. Se ejecutan seguidos.

### Configuración obligatoria del proyecto

- **Authentication → Sign Ups: desactivado.** El usuario administrador se crea a
  mano desde el panel de Supabase.
- El administrador además tiene que estar en la tabla `administradores`. Estar
  registrado no alcanza: las políticas de RLS consultan esa allowlist. Es lo que
  evita que activar el registro por error abra la base entera.
- **Respaldos.** El plan gratuito no tiene ninguno. Ver ESPECIFICACION.md §10.
- El plan gratuito **pausa el proyecto** tras una semana sin uso. Con QRs
  impresos circulando eso es una caída sin aviso: contratar plan de pago antes de
  imprimir el primer lote (§13).

### Comprobar que RLS funciona

`/panel/`, ya con sesión, tiene un botón que intenta leer y escribir cada tabla
con la clave anónima y sin sesión. Todas tienen que salir bloqueadas. Es el
criterio de aceptación de la Fase 1 y conviene repetirlo cada vez que se agregue
una tabla o se toque una política.

## public/.htaccess

Se copia tal cual al build. Contiene cinco bloques:

**1. Página de error** — `ErrorDocument 404 /404.html`.

**2. URL corta para QR** — `home.inacons.com.pe/r/CODIGO` → `/empresa/?c=CODIGO` (302).
Usar siempre el host `home.…` en un QR, nunca `inacons.com.pe`: el dominio principal hace
301 a home, así que entrar por él agrega un salto al inicio y otro al final. Son cuatro
redirecciones en vez de dos, sobre la wifi saturada de un pabellón de feria. Menos
caracteres significa menos módulos y un QR más legible. Ver [formularios.md](formularios.md).

> La Fase 2 invierte esta regla: el redirector pasa a vivir en `/r/` y
> `/empresa/?c=` queda como 301 de compatibilidad. **Las dos reglas juntas son un
> bucle infinito de redirecciones**, así que la vieja se borra en el mismo commit
> que crea la nueva.

**3. Compresión** — Deflate/gzip para html, css, js, json, svg, pdf y fuentes.

**4. Caché** — ya aplicada: imágenes, css, js y fuentes a 1 año; PDF a 6 meses; mp4 a 1
mes; html a 0 segundos.

**5. Cabeceras de seguridad** — `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options:
nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`
(cámara y micrófono bloqueados, geolocalización solo same-origin) y HSTS a un año con
`includeSubDomains`.

## Indexación

Dos listas que hay que mantener **en paralelo**: el filtro del sitemap en
`astro.config.mjs` y los `Disallow` de `public/robots.txt`. Una ruta interna
nueva va en las dos.

Hoy quedan fuera del sitemap y del rastreo: `/panel/`, `/empresa/`, `/recursos/`,
`/formulario/` y `/expomina/`.

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
