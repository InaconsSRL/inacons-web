# Auditoría de arquitectura — INACONS

Base: commit `9f9e67b`, árbol limpio salvo `docs/auditorias/`. Fecha: 17-sep-2026.
Lectura estática del repositorio completo — no tengo acceso al proyecto de Supabase,
al FTP ni al panel de Google.

Parte de `docs/auditorias/auditoria_17092026.md`. No repito sus hallazgos: esto mira
arquitectura, datos, operación y riesgo. Donde discrepo, lo digo.

**Hecho verificado** = lo leí en un archivo y cito archivo:línea.
**Supuesto** = lo deduzco y no lo pude comprobar desde aquí. Los marco.

---

## Corrección de dos premisas del encargo

**1. Los dos paneles no conviven.** `public/empresa/admin.php` e `index.php` se
borraron en `fb1cfc7` (610 líneas, dos archivos). No queda PHP de administración en el
repositorio. Lo que sobrevive son tres reglas de `mod_rewrite`
([public/.htaccess:63-86](public/.htaccess:63)) y, casi con seguridad, archivos en el
servidor que nunca estuvieron en git — ver §1.3. El auditor anterior ya lo señaló; lo
confirmo y lo extiendo.

**2. La fuente de verdad de los códigos QR es única y es Postgres.** Verificado:
`qr_codes` en Supabase, poblada por `0006_migrar_codigos.sql:75-86` con los cuatro
códigos reales. El mensaje de `fb1cfc7` documenta que las dos consultas sobre
`qr_links` en MySQL devolvieron cero filas fuera de esos cuatro. **No hay doble fuente
de verdad de datos.**

Sí hay doble fuente de verdad de otras tres cosas, y son las que me preocupan: el
dominio canónico, la clave de Supabase y la lista de tablas protegidas. §4.1.

---

## 1. Coherencia del stack

### 1.1 Cuántos backends hay

Contado por entorno de ejecución, no por servicio:

| Entorno | Qué corre | Dónde vive | Estado |
|---|---|---|---|
| PostgREST + plpgsql | 10 funciones, 12 tablas | Supabase (plan gratuito) | Vivo, es el núcleo |
| PHP 8 / Apache | `public/r/index.php`, 324 líneas | cPanel | Vivo, una sola responsabilidad |
| Google Apps Script | `expomina.js`, `expomina-avisos.js` | Google | Cerrados |
| Google Apps Script | `_archivo/formulario-amonestaciones/amonestacion.js` | Google | **Vivo según §14 de la especificación** |
| Bitrix24 | 6 formularios del canal ético | SaaS de terceros | Vivo, fuera de control del repo |
| GitHub Actions | `deploy.yml`, `latido.yml` | GitHub | Vivo |
| MySQL | — | cPanel | **Supuesto: la base sigue creada.** Nada en el repo la borra |

Almacenes de datos distintos: Postgres, Google Sheets, Bitrix24 y (probablemente)
MySQL. Sistemas de tareas programadas: dos — `pg_cron` dentro de la base
([0003:68](supabase/migrations/0003_agregados.sql:68)) y GitHub Actions fuera
([latido.yml:29](.github/workflows/latido.yml:29)).

### 1.2 ¿Está justificada la heterogeneidad?

Mayormente sí, y quiero ser explícito porque es raro: **cada pieza tiene un motivo
escrito y el motivo es correcto.**

- El PHP existe porque un sitio estático no puede emitir un 302 real con dominio
  propio ([r/index.php:8-12](public/r/index.php:8)). Es cierto y no hay forma barata
  de esquivarlo sin meter un CDN delante. **No lo consolidaría.** Moverlo a una Edge
  Function de Supabase cambiaría el host del QR a `*.supabase.co`, que es
  precisamente lo que la capa existe para evitar.
- El cron externo existe porque `pg_cron` se pausa junto con el proyecto
  ([0010:13-15](supabase/migrations/0010_latido.sql:13)). Razonamiento correcto.
- Bitrix24 existe porque la empresa ya lo usa. No es deuda del repositorio.

Ahora la parte incómoda. **Casi toda la complejidad accidental de este sistema se
compró con dinero que no se gastó.** El latido, la tabla de agregados para no contar
filas en vivo, la ausencia de respaldos, el aviso de §13 de no imprimir hasta
contratar — son artefactos del plan gratuito de Supabase. 25 USD al mes eliminan el
workflow de latido entero, habilitan recuperación por punto en el tiempo y quitan el
riesgo de §3.2. Es la decisión de arquitectura de mayor relación beneficio/esfuerzo
que tiene el proyecto por delante, y no es técnica.

Lo que sí es complejidad no justificada: **Google Apps Script y Google Sheets.** Dos
backends más, con su propio modelo de autenticación (ninguno), su propio almacén y su
propio ciclo de despliegue manual, para hacer lo que `contactos` + `inscripciones` ya
modelan mejor en el esquema
([0001:333-378](supabase/migrations/0001_esquema.sql:333)). La Fase 4 ya planea
retirarlos. Adelantarla es la consolidación real.

### 1.3 Retiro de `/empresa/`: qué falta y cuál es el riesgo

El código se fue. Lo que queda, por capas:

**a) Tres reglas de `.htaccess`.** Sostienen papel impreso: los dos flyers A4 de
`/recursos/` codifican `/empresa/?c=canal_etico` y `/empresa/?c=tickets_ti`
([.htaccess:45-46](public/.htaccess:45)). Están correctamente documentadas, con el
orden explicado y la condición redundante `!c=` puesta a propósito
([.htaccess:69-86](public/.htaccess:69)). **No las toques.** El bloque es de los
mejores del repositorio. Retirarlas exige antes reemplazar los dos PNG de
`public/assets/recursos/` por versiones que codifiquen `/r/`, y aceptar que el papel
ya distribuido muere. Yo las dejaría diez años: cuestan cero y su ausencia es
irreversible.

**b) Archivos en el servidor que git nunca conoció.** Esto es lo que quiero agregar al
hallazgo S8 del auditor anterior, porque su severidad es distinta a la que le dio.

`.gitignore:32-34` lista `public/empresa/config.php` y `public/empresa/setup.php`. La
acción de despliegue sincroniza contra un archivo de estado en el servidor: borra lo
que desaparece del repositorio, pero **nunca conoció estos dos**, así que no existe
mecanismo alguno que los elimine. Si se subieron por FTP en su día —y `config.php`
tuvo que subirse, porque el sistema funcionaba— **siguen ahí**. No es "puede que queden
residuos": es que no hay forma de que no queden.

`_local/empresa/config.php` (la copia local, ignorada) muestra qué contiene el real:

```
DB_HOST, DB_NAME, DB_USER, DB_PASS, ADMIN_PASS_HASH, BASE_URL, ALLOWED_REDIRECT_HOSTS
```

Credenciales de MySQL y el hash bcrypt del administrador. Hoy Apache los ejecuta y no
los sirve. El día que un cambio de módulo, un `.htaccess` roto o una migración de
cPanel deje de ejecutar PHP en ese directorio, `config.php` se descarga en texto
plano. Y `setup.php` —un instalador— no lo cubre ninguna regla de reescritura: las tres
apuntan a `^empresa/?$` y `^empresa/admin\.php$`, nada a `^empresa/setup\.php$`.

**Plan de retiro, en este orden:**

1. Entrar por FTP y listar `/sites/home.inacons.com.pe/empresa/`. Es la única acción
   que despeja la incógnita y son cinco minutos.
2. Borrar todo `.php` que quede ahí. Las tres reglas de reescritura siguen funcionando
   sin ellos: `mod_rewrite` actúa antes de mirar el disco, como el propio mensaje de
   `fb1cfc7` explica y verificó en producción.
3. Confirmar que la base MySQL está vacía o exportada, y darla de baja en cPanel.
   Mientras exista con credenciales que están en un archivo del servidor, es superficie
   de ataque sin ninguna función.
4. Rotar la contraseña de MySQL y el hash de administrador aunque se borre todo:
   estuvieron en un archivo alcanzable por HTTP durante meses.

Riesgo del plan: **bajo, con una condición.** El paso 2 es seguro solo si el paso 1
confirma que ningún otro `.php` del servidor incluye ese `config.php`. Si el listado
muestra archivos que no reconoces, para y audita antes de borrar.

---

## 2. Modelo de datos y frontera de seguridad

Coincido con el auditor anterior: es la parte mejor hecha. El modelo denegar-todo, el
`revoke` a `PUBLIC` y no solo a `anon`
([0002:98-102](supabase/migrations/0002_rls.sql:98)), el `search_path` fijo en las
siete `SECURITY DEFINER`, y la decisión de exponer funciones en vez de tablas
([0001:431-443](supabase/migrations/0001_esquema.sql:431)) son correctos y están bien
argumentados. No repito lo que ya se verificó. Lo que sigue es lo que no está cubierto.

### 2.1 La garantía de RLS descansa en memoria humana, no en un mecanismo

Tres hechos, verificados:

1. `0002_rls.sql:35-45` activa RLS sobre once tablas, nombradas a mano.
2. `0010_latido.sql:27-35` crea una duodécima, `latidos`, y activa su RLS ella misma.
3. `src/lib/supabase.ts:66-78` declara la lista `TABLAS` que recorre la prueba de RLS
   del panel — **y tiene once entradas. `latidos` no está.**

El comentario de esa constante dice "Es el esquema completo de la sección 6". No lo es
desde `0010`. El botón del panel que existe precisamente para demostrar que RLS
funciona no prueba la tabla más nueva, que es la clase de tabla donde el fallo es más
probable.

`docs/deploy.md:143-146` dice: *"conviene repetirlo cada vez que se agregue una tabla o
se toque una política"*. El procedimiento documentado se siguió —la tabla nació con
RLS— y aun así la prueba quedó atrás. **Ese es el dato importante: no falló por
descuido, falló porque depende de que alguien recuerde dos sitios.**

Además, `alter default privileges`
([0002:112-114](supabase/migrations/0002_rls.sql:112)) cierra los GRANT de lo que se
cree en el futuro, pero **no activa RLS**: eso no existe como privilegio por defecto en
Postgres. Una tabla nueva creada sin la línea de `enable row level security` nace sin
protección de filas aunque `anon` no tenga GRANT — y si alguien escribe una política de
más, ya no hay red.

Hoy no hay agujero. La afirmación "toda tabla nueva nace con RLS activo" de `CLAUDE.md`
regla 6 es una convención, no una propiedad del sistema.

**Arreglo que la convierte en propiedad del sistema (~1 h):** una `0011` con un event
trigger sobre `ddl_command_end` que active RLS en toda tabla nueva de `public`, y
derivar la lista `TABLAS` del catálogo (`pg_class`) en vez de escribirla. La consulta
de verificación de `0002:124-129` ya hace exactamente la pregunta correcta; lo único
que falta es que alguien la corra sin tener que acordarse.

### 2.2 ¿Alcanzan la allowlist + sign-ups desactivado?

Como **autorización**, sí: es un diseño sólido y mejor que el habitual. La allowlist
sobrevive a que alguien active el registro por error, que es el escenario que la
justifica ([0001:20-28](supabase/migrations/0001_esquema.sql:20)).

Como **autenticación**, no del todo, y el hueco está declarado en la propia
especificación. §12 dice: *"El endurecimiento de sesión de `admin.php`: … rate limiting
de 5 intentos por IP en 10 minutos … Supabase Auth cubre lo equivalente, pero
**verificar que nada de esto se pierde, no darlo por sentado**"*. No encuentro en el
repositorio ni en el registro de ejecución ninguna constancia de que se haya
verificado. Supabase aplica límites de tasa en `/auth/v1/token`, pero son ajustables y
su valor por defecto en el plan gratuito **no lo puedo comprobar desde aquí**. Queda
como pendiente de verificación explícita, no como fallo.

Lo que sí es fallo, y es el de mayor severidad del informe:

### 2.3 `resolver_qr()`: la escritura anónima ilimitada puede apagar todos los QR

El auditor anterior lo listó como S1 con "contamina el tablero y puede agotar los
500 MB". Se queda corto. **La consecuencia real es una caída total del sistema de QR, y
es consecuencia directa de una decisión de diseño que el código defiende
explícitamente.**

La cadena, toda verificada:

1. `anon` puede ejecutar `resolver_qr()`
   ([0007:99](supabase/migrations/0007_codigo_tolerante.sql:99)). Tiene que poder: es
   lo que hace funcionar `/r/`.
2. Cada llamada hace un `INSERT` incondicional en `escaneos` — exista el código o no
   ([0007:89-90](supabase/migrations/0007_codigo_tolerante.sql:89)).
3. La resolución y el registro van **en la misma transacción**, a propósito: *"o pasan
   las dos cosas o no pasa ninguna. No puede quedar una redirección sin contar"*
   ([0007:86-88](supabase/migrations/0007_codigo_tolerante.sql:86)).
4. No hay límite de tasa en ninguna capa: ni en `.htaccess`, ni en el PHP, ni en la
   función.
5. Nada purga `escaneos`. No hay política de retención en ningún archivo.
6. Cuando un proyecto de Supabase supera el límite de tamaño, pasa a **solo lectura**.
7. En solo lectura el `INSERT` del punto 2 falla → la función entera falla → PostgREST
   devuelve error → el PHP recibe un código distinto de 200 y sirve la página 503
   ([r/index.php:158-161](public/r/index.php:158), [:69-82](public/r/index.php:69)).

**Resultado: todo QR impreso deja de redirigir.** La propiedad "ninguna redirección sin
contar" se convierte, bajo disco lleno, en "ninguna redirección".

Orden de magnitud, con los supuestos a la vista: cada fila guarda hasta 400 caracteres
de user-agent y 400 de referrer ([r/index.php:63-64](public/r/index.php:63)), más
índice compuesto ([0001:250](supabase/migrations/0001_esquema.sql:250)). Con un
user-agent típico son ~350 B por fila entre tabla e índice; 500 MB ≈ 1,5 M de filas.
Un solo `curl` en bucle a 20 peticiones por segundo genera 1,7 M de filas al día. **Un
atacante, un portátil, menos de un día.** El cálculo es estimativo; la conclusión —que
el límite se alcanza en horas, no en años— no depende de la precisión del número.

Y no hace falta malicia: un rastreador que descubra `/r/` y pruebe variantes hace lo
mismo más despacio.

**Agravante de observabilidad:** el ataque es invisible en la única interfaz que
existe. `escaneos_diarios` solo agrega filas con `resultado = 'ok'`
([0003:45](supabase/migrations/0003_agregados.sql:45)) y el panel lee de ahí
([panel/index.astro:466](src/pages/panel/index.astro:466)). Los `desconocido`,
`bloqueado` e `inactivo` —justo los que produce un barrido— no se muestran en ningún
sitio. Se llenaría la base sin que ningún número del panel se moviera.

**Mitigaciones, de menor a mayor esfuerzo:**

- *Ahora, 30 min:* en `resolver_qr()`, no escribir user-agent ni referrer cuando
  `resultado <> 'ok'`. Recorta el coste por fila del caso abusivo en un orden de
  magnitud sin perder nada útil.
- *Ahora, 1 h:* tarea de `pg_cron` que borre de `escaneos` lo que tenga más de 90 días.
  `escaneos_diarios` ya conserva el agregado, así que no se pierde la serie histórica;
  es exactamente para lo que se creó
  ([0001:253-257](supabase/migrations/0001_esquema.sql:253)). Convierte una tabla de
  crecimiento infinito en una de tamaño acotado. **Esto lo haría primero.**
- *2-3 h:* límite por IP. El sitio correcto es el PHP, no la base: ahí ya existe la IP y
  frenar antes de la llamada de red ahorra también el tiempo de respuesta. Contador en
  archivo o APCu, 30 peticiones por IP por minuto, respuesta 429.
- *Decisión de diseño:* romper el acoplamiento del punto 3. Que un fallo al registrar no
  impida redirigir. Contradice el comentario del código, y es la decisión correcta de
  todos modos: un escaneo sin contar es un dato perdido; una redirección que no ocurre
  es un cliente perdido delante de un cartel. Lo dejaría para después de las
  mitigaciones baratas, pero lo dejaría anotado como la postura correcta.

### 2.4 Dato que entra sin validar y se guarda como si fuera cierto

`pais()` ([r/index.php:191-199](public/r/index.php:191)) lee `HTTP_CF_IPCOUNTRY`,
`GEOIP_COUNTRY_CODE` y `HTTP_X_COUNTRY_CODE`. El comentario dice *"Nunca se adivina"*.
No adivina: **cree lo que le manda el cliente.** `HTTP_CF_IPCOUNTRY` y
`HTTP_X_COUNTRY_CODE` son cabeceras de la petición, y el propio repositorio documenta
que no hay Cloudflare delante ([r/index.php:9](public/r/index.php:9)). Cualquiera puede
enviar `X-Country-Code: FR` y esa fila queda en la base como un escaneo desde Francia.

Severidad baja en seguridad, media en integridad: es una columna que un día alguien va
a usar para decidir dónde repartir material. Arreglo: aceptar solo
`GEOIP_COUNTRY_CODE` (que lo pone el servidor, no el cliente) y validar contra
`^[A-Z]{2}$`. Diez minutos.

### 2.5 Privacidad: `escaneos` es un registro de personas sin política de retención

`escaneos` guarda user-agent, referrer y país por cada escaneo. Bajo la Ley 29733 eso
es, como mínimo, discutible como dato personal, y no hay aviso previo, ni base legal
declarada, ni plazo de conservación, ni mención en ninguna política de privacidad —que
además no existe (M5 del auditor anterior). El propio esquema razona sobre
consentimiento versionado para `inscripciones`
([0001:364-368](supabase/migrations/0001_esquema.sql:364)) con un cuidado que no se
aplicó a `escaneos`. La purga a 90 días del punto anterior resuelve las dos cosas a la
vez.

### 2.6 `service_role` y secretos: correcto, con una excepción

Verificado: no hay ninguna `service_role` ni `sb_secret_` en el árbol. La clave
publicable está en `public/r/index.php:37` y eso es correcto por diseño.

**La excepción:** `_archivo/formulario-amonestaciones/amonestaciones.astro:626`
contiene la URL `/exec` completa del endpoint de amonestaciones. El
`_archivo/README.md` dice, con todas las letras, que ese endpoint devuelve el historial
disciplinario completo sin comprobar sesión y que **mover el archivo no lo cerró**. Es
decir: el repositorio publica las coordenadas exactas de un endpoint abierto con datos
laborales de personas, y esa URL está en el historial de git para siempre.

`origin` es `github.com/InaconsSRL/inacons-web`. **No puedo verificar si es público.**
Si lo es, el hallazgo S7 del auditor anterior pasa de "pendiente" a "exposición
activa". Si es privado, sigue siendo un secreto en el historial que ninguna rotación
alcanza.

En cualquier caso el arreglo es el mismo y es en Google, no aquí: archivar la
implementación. Lo urgente es **hoy**, no "antes de la Fase 4".

### 2.7 Idempotencia y transaccionalidad

Los diez archivos declaran `begin;`/`commit;` y usan `if not exists` / `on conflict` de
forma consistente. Leídos uno a uno, la secuencia completa `0001→0010` ejecutada dos
veces converge al mismo estado: `0004` reinserta los códigos de prueba y `0006` vuelve
a borrarlos ([0006:94-97](supabase/migrations/0006_migrar_codigos.sql:94)). Está bien
pensado.

Dos matices:

- **`0005` no es atómico.** `alter type … add value` va deliberadamente fuera de la
  transacción ([0005:12-17](supabase/migrations/0005_redirector.sql:12)). Si el resto
  falla, el enum queda con un valor que nadie usa. Inocuo, pero la afirmación "cada
  archivo va en una sola transacción" de `docs/deploy.md:104` tiene una excepción no
  documentada ahí.
- **`0004` es una bomba de relojería en producción.** Vive en la misma carpeta, con el
  mismo esquema de numeración, que las migraciones reales. Si alguien lo reejecuta
  contra la base viva sin ejecutar `0006` después, mete cuatro códigos QR falsos y
  sesenta escaneos inventados en un sistema con papel circulando. La única protección
  es un comentario. **Lo movería a `supabase/semillas/`, o le pondría un
  `raise exception` al principio que haya que borrar a mano.** 20 minutos.

---

## 3. Operación y durabilidad

### 3.1 Sin staging: producción es el único entorno

Hecho verificado: `deploy.yml:3-5` dispara con cada push a `main`, no hay otro
workflow, no hay rama de preproducción, no hay paso de verificación entre
`npm run build` y el FTP.

El riesgo mayor no es publicar una página fea. Es esto: **`public/.htaccess` se
despliega por el mismo push que despliega el contenido, sin ninguna validación.** Una
directiva mal escrita en ese archivo no da error de build —Astro lo copia tal cual— y
Apache responde **500 en todo el sitio**, incluido `/r/`. Con QR impresos circulando,
un `.htaccess` roto es una caída total con un despliegue de por medio. Y el archivo es
denso: 164 líneas, reglas cuyo orden importa y que el propio comentario advierte que no
son decorativas ([.htaccess:69-77](public/.htaccess:69)).

**Flujo mínimo, en orden de relación beneficio/coste:**

1. **Validar `.htaccess` en CI antes del FTP** (~1 h). Un paso que levante
   `httpd:2.4-alpine`, monte `dist/` y corra `httpd -t`. No cubre `mod_rewrite`
   semánticamente; sí cubre el error de sintaxis, que es el que tumba el sitio.
2. **`concurrency` en el workflow** (~5 min). Hoy dos push seguidos lanzan dos
   despliegues FTP en paralelo sobre el mismo directorio, compartiendo el archivo de
   estado de sincronización. No hay `concurrency:` en ningún workflow —verificado—. Es
   un `concurrency: {group: deploy, cancel-in-progress: false}`.
3. **Guardar `dist/` como artefacto del workflow** (~15 min). Da tres cosas que hoy no
   existen: origen de rollback, forense de "qué había realmente publicado el día X", y
   la posibilidad de diffear servidor contra build. Retención 90 días.
4. **Un subdominio de staging en el mismo cPanel** (~3 h). `staging.inacons.com.pe`,
   apuntando a otro directorio, desplegado desde una rama `desarrollo`, con
   `robots.txt` bloqueando todo. Es lo que convierte "probar el `.htaccess`" en algo
   que se hace sin pensarlo. Supabase seguiría siendo el mismo proyecto —dos proyectos
   duplicarían el problema de las migraciones sin registro—, así que staging cubre el
   frontend y el `.htaccess`, no la base.

### 3.2 Respaldos: esto no es una nota, es el riesgo que puede terminar el proyecto

`ESPECIFICACION.md:341-349` lo dice mejor de lo que yo lo diría: *"El punto que menos se
ve y más duele. Hoy los datos están en Google Sheets, que hace copias solo sin que nadie
piense en eso. Al mover todo a Supabase esa red desaparece sin que se note."* Y lo
declara **requisito, no opcional**, con verificación de una restauración real.

Estado hoy, verificado: plan gratuito, cero respaldos, cero restauraciones probadas, y
`0010` documenta explícitamente que el latido no sustituye nada de eso.

**Qué pasa cuando entren contactos reales.** La Fase 4 llena `contactos` e
`inscripciones` con nombres, correos y teléfonos de personas, con consentimiento
versionado ([0001:364-368](supabase/migrations/0001_esquema.sql:364)). A partir de ese
momento:

- Un `delete` sin `where` desde el SQL Editor —el mismo sitio desde el que se aplican
  las migraciones, con la misma clave que se salta RLS— **no tiene vuelta atrás**. No
  hay respaldo, no hay recuperación por punto en el tiempo, no hay papelera.
- La obligación de la Ley 29733 no es solo no filtrar datos: es también poder
  atenderlos. Perder el registro de consentimiento deja a la empresa sin poder demostrar
  a qué texto dijo que sí cada persona, que es exactamente lo que
  `version_consentimiento` existe para probar.
- El plan gratuito pausa por inactividad. La pausa no borra, pero un proyecto pausado y
  olvidado el tiempo suficiente **sí se elimina**. El latido protege mientras corra; y
  el propio workflow documenta que GitHub apaga los cron de repositorios inactivos a los
  60 días ([latido.yml:17-20](.github/workflows/latido.yml:17)). Son dos temporizadores
  corriendo en direcciones opuestas, y el que protege es el que se apaga solo.

**Recomendación, sin adornos: contratar el plan de pago antes de escribir la primera
línea de la Fase 4, no antes de imprimir el primer lote de QR como dice §13.** El
disparador correcto es "entran datos de personas", no "sale papel". Y en cualquier caso,
hacer una restauración de prueba y anotar el resultado: un respaldo no probado es una
creencia.

**Mientras tanto, gratis (~2 h):** un tercer workflow semanal que haga `pg_dump` con la
conexión directa, cifre el volcado con GPG y lo suba como artefacto de GitHub con
retención larga. No es recuperación por punto en el tiempo y no sustituye al plan de
pago, pero convierte "pérdida total" en "pérdida de hasta siete días", que es una
categoría de desastre distinta.

### 3.3 Despliegue por FTP: historia de rollback y acoplamientos

**Rollback: no existe como procedimiento.** El único camino es `git revert` + push +
esperar el build + esperar el FTP. Supuesto razonable: 3-5 minutos con todo
funcionando. No hay forma de servir la versión anterior de inmediato, porque el
artefacto anterior no se guarda en ningún sitio (§3.1 punto 3). Si el fallo está en el
`.htaccess`, esos minutos son con el sitio en 500.

**Acoplamientos al hosting, ordenados por lo difícil que es vivir con ellos:**

| Rareza | Dónde | Cómo se manifiesta si se pierde |
|---|---|---|
| El hosting inyecta su `Cache-Control` **después** de `mod_headers` | [.htaccess:99-109](public/.htaccess:99) | Dos cabeceras en conflicto en cada respuesta. Ya está pasando |
| `[NC]` obligatorio en las reglas de `/r/` | [.htaccess:22-31](public/.htaccess:22) | 404 en todos los QR escaneados. Ya pasó una vez |
| `config.php` fuera de git, solo en el servidor | [.gitignore:32](.gitignore:32), [deploy.yml:56-60](.github/workflows/deploy.yml:56) | Un despliegue lo pisa con valores vacíos |
| PHP disponible en un sitio por lo demás estático | [r/index.php](public/r/index.php) | `/r/` deja de existir |

Sobre el primero, y aquí sí discrepo del enfoque del auditor anterior. Su T11 propone
"resolver el doble `Cache-Control` con el hosting". **Eso es negociar con un servidor
que no va a cambiar.** La causa es que la cabecera del hosting se añade en una fase
posterior a la que `mod_headers` puede tocar: `unset` no puede quitar lo que todavía no
existe. La salida arquitectónica no es pelear la cabecera, es **quitarle importancia**.
`design-system.css` y `main.js` están en `public/` con nombre fijo
([.htaccess:123-132](public/.htaccess:123)) precisamente por eso. Importarlos desde el
layout para que pasen por el pipeline de Astro les da nombre con hash, y entonces da
igual qué `max-age` ponga el hosting: la URL cambia cuando cambia el contenido. Son ~2 h
y elimina la categoría entera de problema en vez de mitigarla.

**Hallazgo nuevo sobre el despliegue, y no es menor:** `deploy.yml:38-45` no fija el
parámetro `protocol` de `SamKirkland/FTP-Deploy-Action`. **Alta confianza, verificar
contra la v4.3.5 fijada: el valor por defecto de esa acción es `ftp` en claro.** Si es
así, en cada push viajan sin cifrar el usuario, la contraseña de FTP y el contenido
completo del sitio. El arreglo es una línea —`protocol: ftps`— y confirmar en cPanel que
el servidor lo acepta en el puerto 21 con TLS explícito. **Compruébalo antes que
cualquier otra cosa de esta sección.**

---

## 4. Mantenibilidad y calidad

### 4.1 Los patrones de fuente única: dos se sostienen, dos no

**`src/lib/qr.ts` — se sostiene.** Verificado: un solo `import QRCode from 'qrcode'` en
todo el árbol, y `fb1cfc7` retiró la última librería rival (un `qrcodejs` por CDN dentro
de `admin.php`). La regla 7 de `CLAUDE.md` se cumple de verdad.

**`src/lib/supabase.ts` — se sostiene como instanciador, falla como fuente.** Es el
único que llama a `createClient()`. Pero su constante `TABLAS` está desactualizada
(§2.1) y `public/r/index.php:36-37` habla con Supabase sin pasar por él, con la URL y la
clave escritas a mano. El propio archivo lo admite: *"si cambia el proyecto de Supabase,
hay que actualizar estos dos valores también en `.env` y en los secrets de GitHub. Son
los tres sitios"* ([r/index.php:34-35](public/r/index.php:34)). Un comentario honesto no
es un mecanismo. **Arreglo barato (~1 h):** que el build escriba
`public/r/config.generado.php` desde `import.meta.env`, y que `index.php` lo incluya.
Tres sitios pasan a uno.

**`site` en `astro.config.mjs` — no se sostiene, y el comentario afirma lo contrario.**
`astro.config.mjs:21` dice: *"Este valor es la única fuente del dominio: nada más lo
escribe a mano."* Nueve sitios lo escriben a mano:

```
src/components/PageHero.astro:58         src/pages/panel/index.astro:265
src/layouts/BaseLayout.astro:27          src/pages/recursos/index.astro:11
src/lib/qr.ts:79                         public/r/index.php:38
src/pages/404.astro:6                    public/robots.txt:13
supabase/migrations/0001_esquema.sql:85  (configuracion.dominio_canonico)
```

Siete son fallbacks de la forma `Astro.site ?? 'https://…'`, que en la práctica nunca se
activan y son defendibles. Dos no lo son: el PHP y `robots.txt` lo llevan literal. Y
`configuracion.dominio_canonico` es una **décima** copia, esta vez en la base de datos,
que hoy no lee nadie —verificado: cero referencias fuera de la migración—.

El riesgo concreto: un cambio de dominio no es un cambio de una línea, es una búsqueda.
Y la columna muerta en la base es una trampa: el día que alguien la use, el dominio
tendrá dos fuentes vivas que pueden divergir.

**Acción (~1 h):** eliminar la afirmación falsa del comentario, o hacerla verdadera. Yo
haría las dos: quitar los fallbacks literales donde `Astro.site` está garantizado,
generar el valor del PHP en el build, y o bien borrar `dominio_canonico` o bien
documentar que es la fuente para el panel y nadie más.

### 4.2 Pruebas: no hay ninguna

Hecho verificado: `find` sobre `*test*` y `*spec*` devuelve cero archivos. No hay
`vitest`, ni `playwright`, ni script de pruebas en `package.json`. La única validación
automática del proyecto es el propio build, más una comprobación en tiempo de build que
sí me parece ejemplar: `recursos/index.astro:62` llama a `codigoExiste()` y rompe el
build si un `.md` declara un QR que no existe en la base, con degradación correcta si
Supabase no responde ([supabase.ts:86-91](src/lib/supabase.ts:86)). Ese es exactamente
el patrón correcto, y ojalá hubiera más.

Sobre lo que `CLAUDE.md` pide validar contra Postgres real: es un buen hábito pero es
**manual y de un solo uso**. Nada lo repite. Convertirlo en un workflow con
`services: postgres:16-alpine`, que cree los roles `anon`/`authenticated`, aplique los
diez archivos dos veces y corra al final la consulta de verificación de `0002:124-129`
cuesta ~3 h y convierte una disciplina en una garantía. **Es la única prueba que haría
si solo pudiera hacer una.**

**Puntos frágiles sin red, todos con el mismo perfil: fallan sin error.**

| Fallo | Qué lo delata hoy | Evidencia |
|---|---|---|
| El mapa no pinta pines | Nada. `.catch(function(){})` se traga cualquier fallo de red o parseo | [main.js:481](public/assets/js/main.js:481), y dos retornos mudos en [:448-449](public/assets/js/main.js:448) |
| Selector CSS que cruza frontera de componente | Un `grep` que hay que acordarse de correr | `CLAUDE.md` regla 1 |
| `[NC]` perdido en `mod_rewrite` | Nada hasta que alguien escanee papel | [.htaccess:22-31](public/.htaccess:22) |
| `TABLAS` sin una tabla nueva | Nada. El botón dice "todo bloqueado" igual | [supabase.ts:66](src/lib/supabase.ts:66) |
| Formulario de contacto | Nada. Muestra "¡Listo!" siempre | M1 del auditor anterior |

La regla 4 de `CLAUDE.md` —`#peruMapContainer` nunca en `display:none`— protege contra
**una** causa de que los pines desaparezcan. El `.catch` vacío de la línea 481 hace
invisibles **todas** las demás. Un `console.warn` de una línea ahí dentro no arregla
nada, pero convierte "los pines no están y nadie sabe por qué" en "los pines no están y
la consola dice por qué". Cinco minutos.

**Y una prueba que casi existe:** `jsqr` está en `devDependencies` y **nada lo importa**
—verificado—. Se usó para medir la tolerancia del logo sobre el QR, y esos números son
los que justifican `LOGO_ESCALA = 0.20` ([qr.ts:131-153](src/lib/qr.ts:131)). La
medición está escrita en un comentario y no se puede reproducir. La dependencia ya está
pagada; un script de ~60 líneas que regenere la tabla de "manchas que aguanta" volvería
auditable una decisión de parámetros que va directo a la imprenta. ~2 h.

### 4.3 Esquema que nadie escribe: el fallo que el diseño quería evitar

Tres columnas de `qr_codes` —`perfil_generacion`, `version_modulo_qr`, `generado_en`—
existen por una razón concreta y bien argumentada: *"Existe para que no se repita lo del
PNG de Expomina, que se genero con una herramienta externa y no dejo fuente: hoy nadie
puede regenerarlo igual"* ([0001:161-166](supabase/migrations/0001_esquema.sql:161)).

`qr.ts:403-409` exporta `metadatosGeneracion()` para llenarlas.

**Verificado: cero referencias a `metadatosGeneracion`, `VERSION_MODULO`,
`version_modulo_qr`, `perfil_generacion` o `generado_en` fuera de `qr.ts`.** El panel
genera y descarga PNG ([panel/index.astro:568-620](src/pages/panel/index.astro:568)) y
no escribe ninguna de las tres. Cada QR que salga del panel hacia una imprenta llega con
exactamente el mismo déficit de trazabilidad que el PNG de Expomina que motivó las
columnas.

No es un bug: es peor. Es una precaución que existe en el esquema, existe en la
librería, y no está conectada. Cuatro líneas en el `insert` del panel. **~30 min, y es
la corrección de mejor relación valor/esfuerzo del informe.**

### 4.4 Migraciones sin registro de aplicación

`supabase/` contiene solo `migrations/`. No hay `config.toml`, la CLI de Supabase no
está en `package.json`, y ninguna migración crea una tabla de control. El procedimiento
documentado es *"se ejecuta a mano en el SQL Editor, en orden, una sola vez"*
([deploy.md:79-82](docs/deploy.md:79)).

Consecuencia: **la respuesta a "¿está aplicada la 0009 en producción?" es el recuerdo de
una persona.** Con un solo desarrollador es manejable. Con dos, o con el mismo
desarrollador seis meses después, no lo es. Y el error que produce no es ruidoso:
aplicar dos veces está cubierto por la idempotencia, pero **saltarse una** deja
funciones que el frontend llama y la base no tiene, con un error de PostgREST que llega
al usuario como un mensaje genérico.

**Arreglo mínimo (~2 h), sin adoptar la CLI:** una tabla `public.migraciones (archivo
text primary key, aplicada_en timestamptz default now())` y dos líneas al final de cada
archivo — un `insert … on conflict do nothing` con su nombre. Cuesta casi nada y
convierte una pregunta sin respuesta en un `select`.

### 4.5 Observabilidad: no existe

Verificado por búsqueda: sin Sentry, sin Plausible, sin Google Analytics, sin sonda de
disponibilidad, sin agregación de logs. El PHP escribe en `error_log()`
([r/index.php:159](public/r/index.php:159)), que va al registro de errores de cPanel que
nadie lee.

**El único mecanismo de alerta que existe en todo el sistema es el correo de GitHub
cuando `latido.yml` falla** ([latido.yml:63-66](.github/workflows/latido.yml:63)). Y
avisa de una sola cosa: que el proyecto de Supabase no respondió. No avisa de que el
sitio esté caído, de que `/r/` devuelva 503, ni de que un formulario dejó de enviar.

Dicho de otro modo: **lo único vigilado es si la base está despierta, no si el sistema
funciona.**

Tres sondas cubren casi todo, y ninguna requiere infraestructura nueva:

1. **Un workflow cada 30 min** que haga `curl` a `/r/CANAL_ETICO` y verifique que
   devuelve `302` con `Location` hacia `/canal-etico/`. Falla → correo. Cubre Apache,
   `mod_rewrite`, el PHP, la red y Supabase, todo de una vez. **~1 h. Es la sonda de
   mayor cobertura por línea de código de todo el sistema.**
2. **El mismo workflow**, un `curl` al home comprobando `200` y que el HTML contenga una
   cadena conocida. Cubre "el despliegue rompió el sitio".
3. **Una consulta semanal** que cuente filas de `escaneos` por `resultado` y avise si los
   `desconocido` superan un umbral. Es la única detección posible del ataque de §2.3, y
   es la métrica que el panel hoy no muestra.

Y para el negocio, no para la operación: sin analítica no hay forma de saber si arreglar
`/servicios/` sirvió de algo. Una herramienta sin cookies (Plausible, Umami) evita
además tener que ampliar la política de privacidad que todavía no existe.

---

## 5. Mapa de riesgos

Probabilidad e impacto a 12 meses, asumiendo que el proyecto avanza a la Fase 4 y se
imprime material. **P** = probabilidad, **I** = impacto.

| # | Riesgo | P | I | Exposición | Detonante |
|---|---|:-:|:-:|---|---|
| R1 | Pérdida total de datos en Supabase sin respaldo | Media | Crítico | **Extrema** | Un `delete` sin `where`, o un proyecto pausado y olvidado |
| R2 | Inundación de `escaneos` → base en solo lectura → **todos los QR caídos** | Media | Crítico | **Extrema** | Un bucle de `curl` o un rastreador. §2.3 |
| R3 | Endpoint de amonestaciones abierto, con la URL en el repositorio | **Alta** | Alto | **Extrema** | Ya está expuesto. Solo falta que alguien mire |
| R4 | `service_role` sin rotar (plazo vencido) | Desconocida | Crítico | Alta | Depende de si se hizo. No verificable desde aquí |
| R5 | `.htaccess` roto por un push → 500 sitewide, sin staging ni rollback rápido | Media | Alto | Alta | Editar 164 líneas de reglas ordenadas sin poder probarlas |
| R6 | Credenciales FTP y sitio completo en claro (`protocol` sin fijar) | Media | Alto | Alta | Red hostil en cualquier push. Verificar primero |
| R7 | `config.php` / `setup.php` huérfanos en el servidor | **Alta** | Medio | Alta | Existen salvo prueba en contrario. §1.3 |
| R8 | Tabla nueva sin RLS, prueba del panel que no la cubre | Media | Alto | Media | La próxima migración. Ya ocurrió con `latidos` |
| R9 | `0004_datos_prueba.sql` reejecutado contra producción | Baja | Alto | Media | Un archivo entre diez, con el mismo aspecto |
| R10 | Migración omitida sin que nadie lo sepa | Media | Medio | Media | Segunda persona, o seis meses de distancia |
| R11 | QR impresos sin registro de con qué se generaron | **Alta** | Medio | Media | Cada QR que sale del panel hoy. §4.3 |
| R12 | Fallo silencioso no detectado (mapa, `[NC]`, formulario) | **Alta** | Medio | Media | Sin observabilidad, la señal es una queja |
| R13 | Cambio de dominio o de proyecto Supabase | Baja | Medio | Baja | Diez sitios que actualizar a mano |
| R14 | `pais_aprox` envenenado por cabecera del cliente | Baja | Bajo | Baja | Ya es posible; el daño es una decisión mal informada |

**Los tres que quitan el sueño son R1, R2 y R3, y ninguno es un problema de código.** R1
es una decisión de gasto. R2 es una decisión de diseño más un cron de limpieza. R3 es
entrar a un editor de Google y archivar una implementación.

---

## 6. Deuda técnica priorizada

Esfuerzo en horas de una persona que ya conoce el repositorio. El orden es el que yo
seguiría.

### Hoy — antes de tocar nada más

| # | Acción | Esfuerzo | Cierra |
|---|---|---|---|
| A1 | Archivar la implementación de amonestaciones en Apps Script | 15 min | R3 |
| A2 | Confirmar si `service_role` se rotó; rotarla si no | 15 min | R4 |
| A3 | Comprobar si `deploy.yml` usa FTP en claro; si sí, `protocol: ftps` | 30 min | R6 |
| A4 | Listar por FTP `/empresa/` y borrar todo `.php` que quede | 30 min | R7 |

Dos horas en total, y cierran tres de las cuatro exposiciones extremas.

### Esta semana — contención

| # | Acción | Esfuerzo | Cierra |
|---|---|---|---|
| B1 | `pg_cron` que purgue `escaneos` con más de 90 días | 1 h | R2, §2.5 |
| B2 | No guardar user-agent ni referrer cuando `resultado <> 'ok'` | 30 min | R2 |
| B3 | Workflow semanal de `pg_dump` cifrado como artefacto | 2 h | R1 (parcial) |
| B4 | `concurrency` en `deploy.yml` + subir `dist/` como artefacto | 30 min | R5 |
| B5 | Escribir `metadatosGeneracion()` desde el panel | 30 min | R11 |
| B6 | `console.warn` en el `.catch` vacío de `main.js:481` | 5 min | R12 |
| B7 | Sacar `0004_datos_prueba.sql` de `migrations/` | 20 min | R9 |
| B8 | `pais()`: solo `GEOIP_COUNTRY_CODE`, validado | 10 min | R14 |

Cinco horas. Es la tanda de mayor rendimiento del informe.

### Este mes — estructura

| # | Acción | Esfuerzo | Cierra |
|---|---|---|---|
| C1 | **Plan de pago de Supabase + una restauración probada y anotada** | Decisión + 2 h | R1 |
| C2 | Límite de tasa por IP en el PHP (30/min, 429) | 2-3 h | R2 |
| C3 | Sonda `/r/` + home cada 30 min, con alerta por correo | 1 h | R12 |
| C4 | CI: Postgres real, los 10 archivos dos veces, consulta de verificación | 3 h | R8, R10 |
| C5 | Validar `.htaccess` con `httpd -t` antes del FTP | 1 h | R5 |
| C6 | Tabla `migraciones` + dos líneas por archivo | 2 h | R10 |
| C7 | Event trigger que active RLS en toda tabla nueva; `TABLAS` desde `pg_class` | 1 h | R8 |
| C8 | Config de Supabase del PHP generada en el build | 1 h | R13 |

### Después — el orden correcto

| # | Acción | Esfuerzo | Por qué después |
|---|---|---|---|
| D1 | Subdominio de staging | 3 h | C5 cubre el 80% del riesgo por un tercio del coste |
| D2 | `design-system.css` y `main.js` al pipeline de Astro (nombre con hash) | 2 h | Elimina la pelea del `Cache-Control` en vez de mitigarla |
| D3 | Desacoplar registro de redirección en `resolver_qr()` | 2 h | Es la postura correcta; B1+B2+C2 quitan la urgencia |
| D4 | Script reproducible de tolerancia del QR con `jsqr` | 2 h | `jsqr` ya está instalado y sin usar |
| D5 | Retirar Apps Script y Sheets; formulario → `contactos` con política acotada | Fase 4 | Es la consolidación real del stack |
| D6 | Limpiar las diez copias del dominio y `dominio_canonico` | 1 h | Trampa dormida, no herida abierta |

---

## 7. Veredicto

Este repositorio está mejor razonado que la inmensa mayoría de lo que audito. Los
comentarios explican **por qué** y no **qué**; varias decisiones difíciles —el `revoke` a
`PUBLIC`, exponer funciones en vez de tablas, el latido fuera de la base, el `[NC]`, el
orden de las reglas de `/empresa/`— están tomadas correctamente y documentadas con el
fallo real que las motivó. Eso no se improvisa.

El problema es de otra naturaleza. **El sistema está diseñado con más cuidado del que se
puede operar.** Todas las garantías fuertes descansan en que una persona recuerde hacer
algo: correr un `grep`, agregar una tabla a una lista, ejecutar una migración en orden,
no reejecutar la cuarta, comprobar el `.htaccess` antes de empujar, no olvidar que los
QR llevan metadatos. Cada vez que esa memoria ha fallado —y ha fallado al menos tres
veces documentadas: el `[NC]`, `ticket-ti` contra `tickets_ti`, y ahora `latidos` fuera
de `TABLAS` junto con los metadatos de generación sin escribir— **el fallo ha sido
silencioso**. Ninguno dio un error. Todos se descubrieron mirando.

La brecha entre la calidad del diseño y la capacidad de operarlo se cierra con muy poco:
unas horas de CI, una purga programada, tres sondas de `curl` y una suscripción de 25
dólares. Nada de lo que propongo es arquitectura nueva. Casi todo es conectar cosas que
ya existen —`codigo_existe()` ya rompe el build, `escaneos_diarios` ya permite purgar,
`metadatosGeneracion()` ya está escrita, `jsqr` ya está instalado, la consulta de
verificación de RLS ya está al final de `0002`— y que hoy dependen de que alguien se
acuerde.

**Lo único que no admite demora es el respaldo.** Todo lo demás de este informe se puede
posponer y se recupera. Una base sin respaldo con datos de personas dentro, no.
