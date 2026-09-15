# Especificación del proyecto

Documento canónico. Contiene decisiones ya tomadas con sus razones, el orden de
ejecución y los criterios de aceptación de cada fase.

## 0. Cómo usar este documento

Vive en el repositorio y se mantiene actualizado. No es un prompt de una sola vez: es
la referencia que se abre al empezar cada sesión de trabajo, para no reexplicar el
contexto.

Reglas de trabajo:

- **Ejecutar por fases, en orden.** No adelantar fases posteriores porque parezcan más
  entretenidas. La Fase 0 va completa antes de empezar la 1.
- **Lo que está en "Decisiones congeladas" y en "Qué no se toca" no se rediscute**
  durante la implementación. Si algo de ahí parece equivocado mientras se programa, se
  para y se consulta, no se cambia sobre la marcha.
- **Cada decisión tiene una razón escrita.** Si una razón no está, es que falta y hay
  que preguntarla, no suponerla.
- **No inventar requisitos.** Ante ambigüedad, preguntar. Es preferible una pregunta a
  una funcionalidad que nadie pidió.
- Al terminar una fase, verificar contra su criterio de aceptación antes de seguir.

---

## 1. Contexto

Sitio en Astro desplegado por FTP a cPanel (Apache + PHP + MySQL, sin Node en el
servidor). Node se usa solo en local para el build. Dominio real:
`home.inacons.com.pe`. DNS en cPanel, no en Cloudflare.

Una sola empresa. Un solo administrador.

### Estado de los módulos existentes

| Módulo | Estado actual | Destino |
|---|---|---|
| `/empresa/` — redirector + `admin.php` | Funciona, buen código | Se divide: redirector a `/r/`, panel a `/panel/` |
| `/recursos/` — hub de recursos | Funciona, noindex | Se mantiene, consume el módulo QR nuevo |
| `/expomina/` — landing de feria | Campaña terminada el 11-sep | Migra a evento archivado |
| `/formulario/amonestaciones/` | Prueba descartada | **Despublicado y archivado (Fase 0)** |
| `/admin/` — Decap CMS | Roto, parqueado | Se elimina, lo reemplaza `/panel/` |
| Apps Script | Backends por-proyecto | Se retiran tras exportar datos |

---

## 2. Mapa de URLs

| Ruta | Qué es | Acceso |
|---|---|---|
| `/` | Inicio | Público |
| `/r/CODIGO` | Redirector de QR dinámicos | Público |
| `/panel/` | Administración: QRs, empleados, eventos, contactos | Login |
| `/empleados` | Directorio del equipo | Público |
| `/empleados/juan-perez` | Tarjeta digital | Público |
| `/eventos` | Listado de eventos | Público |
| `/eventos/expomina-2026` | Página de evento con formulario | Público |
| `/recursos/` | Hub de materiales internos | noindex |
| `/privacidad` | Política de privacidad versionada | Público |

Plural en ambos casos, porque da gratis la página de listado y mantiene la simetría
entre las dos secciones.

### Compatibilidad obligatoria

Aunque los QRs empiecen de cero, `/recursos/` ya venía generando códigos con la forma
larga y alguno puede estar en un flyer o una presentación:

- `/empresa/?c=X` → 301 a `/r/X`
- `/empresa/admin.php` → 301 a `/panel/`
- `/empresa/` sin parámetros → 301 a `/panel/`

Estas reglas se quedan indefinidamente. Cuestan tres líneas de `.htaccess` y evitan
papel muerto.

> **Aviso de implementación (Fase 2).** Hoy el `.htaccess` ya tiene la regla inversa:
> `^r/(...)$ → /empresa/?c=$1`. Poner las tres reglas de arriba **sin quitar esa**
> produce un bucle infinito de redirecciones. Al construir `/r/` hay que borrar la
> regla vieja en el mismo commit.

---

## 3. Decisiones congeladas

- **Sin multi-tenant.** Branding en tabla `configuracion` de fila única.
- **Dos niveles de acceso:** público y admin. Sin sistema de roles.
- **Astro estático.** Un HTML real por empleado y por evento, para tener previews
  correctos al compartir y carga inmediata tras escanear. Publicar dispara rebuild por
  GitHub Actions (60–120 s).
- **Supabase** para datos, auth, storage y Edge Functions.
- **El redirector queda en PHP**, archivo único de ~20 líneas en `/r/`. Es la única
  forma de tener 302 real del servidor con dominio propio sin Cloudflare. No contiene
  lógica de negocio: resuelve, registra y redirige.
- **La ruta corta es `/r/CODIGO`.** Ya existe en `.htaccess`.
- **Los QR se generan en SVG.** El PNG es export secundario, rasterizado desde el SVG
  a 1200 px mínimo.
- **Formulario único para todos los eventos.** Ver sección 7.

---

## 4. Módulo QR compartido

Este es el refactor central del proyecto.

Hoy el conocimiento sobre cómo producir un QR que sobreviva a un códec de video o a
una impresora está bien razonado, pero vive solo en `admin.php`. `/recursos/` no lo
heredó y descarga el preview de 220 px. El QR de Expomina se hizo con una herramienta
externa y no dejó fuente.

Crear `src/lib/qr.ts` como única fuente de generación. Todo consumidor —panel, hub de
recursos, páginas de evento, tarjetas— pasa por ahí. Ningún otro archivo del
repositorio puede instanciar una librería de QR.

### Librería

Reemplazar `qrcodejs 1.0.0` por el paquete npm `qrcode`:

- `qrcodejs` solo implementa modo byte. `qrcode` soporta **modo alfanumérico**, que
  produce un símbolo más chico cuando la URL va en mayúsculas.
- `qrcode` emite **SVG nativo**. Sin SVG, el bug de los 220 px puede repetirse.
- Se ejecuta en build y en navegador, sin CDN externo ni SRI que mantener.

### Perfiles

Portar tal cual la distinción ya razonada en `admin.php:444-447`:

| Perfil | Color | ECC | Uso |
|---|---|---|---|
| `pantalla` | `#000000` negro puro | M | Video, proyección, slides |
| `impresion` | `#1a3a5c` azul corporativo | H | Papel, credenciales, flyers |

El azul recorta margen de lectura y por eso lleva ECC H, que agrega ~30% de módulos
redundantes. En pantalla no hay suciedad ni desgaste contra los que proteger, así que
negro puro con ECC M basta y da un símbolo menos denso.

### Reglas

- La URL se codifica en mayúsculas: `HTTPS://HOME.INACONS.COM.PE/R/E5K2`. Esquema y
  host son insensibles a mayúsculas por estándar; el path lo hacemos insensible en el
  redirector. Esto habilita modo alfanumérico.
- **Nunca escalar un preview.** Para PNG, rasterizar desde el SVG al tamaño pedido.
- Zona de silencio de 4 módulos, no negociable.
- Cada QR generado registra con qué parámetros se produjo: perfil, versión del módulo,
  fecha. Que no vuelva a pasar lo del PNG sin fuente.

### Hoja de impresión

El panel genera una hoja lista para imprimir con el QR y, debajo, la URL en texto
legible.

Esto sistematiza el razonamiento correcto que ya estaba en `expomina.astro:6-11`: si
el QR no escanea por reflejo, distancia o mala posición, la persona todavía puede
teclear la URL. Con la hoja generada desde el panel, el plan B deja de depender de que
alguien se acuerde de agregarlo al diseño.

### Criterio de aceptación

Buscar imports de librería QR fuera de `src/lib/qr.ts` devuelve cero resultados.

---

## 5. Códigos y URLs

### Dos clases de código, una sola tabla

| Clase | Ejemplo | Cuándo |
|---|---|---|
| Legible | `/r/EXPOMINA` | Video, stand, pantalla a distancia, cualquier material donde alguien podría teclear la URL |
| Opaco | `/r/A7F3K` | Credenciales, impresión chica, todo lo que deba reasignarse sin que el código revele el destino |

Un código legible dentro del acortador conserva el plan B de una URL tecleable y
agrega la posibilidad de cambiar el destino después. No hay que elegir entre las dos
cosas.

### Reglas del ciclo de vida

**Nunca se borra un código, solo se desactiva.** Un código borrado cuyo QR está impreso
deja papel muerto que nadie puede arreglar. El panel no tiene botón de borrar: solo
activar, desactivar y reasignar.

**Nunca se imprime un QR que codifique la URL final.** Ni para empleados. Si se imprime
`/empleados/juan-perez` en una credencial y mañana hay que corregir el slug, la
credencial muere. Todo lo impreso pasa por `/r/`. Las URLs bonitas son para compartir
por chat o correo, donde no hay nada físico que actualizar.

**Cada código marca si está en material impreso.** Casilla en el panel. Antes de
reasignar, el administrador necesita saber si eso afecta papel circulando o solo un
enlace en un correo.

### Reglas técnicas

- Códigos opacos: 5 caracteres, alfabeto sin ambigüedades visuales (sin `0`, `O`, `1`,
  `I`, `L`). Aleatorios, nunca secuenciales: con códigos correlativos cualquiera
  recorre el catálogo completo de destinos.
- Resolución insensible a mayúsculas: `/r/a7f3k` y `/r/A7F3K` son el mismo.
- Código inexistente o dado de baja: página sobria con logo y enlace al inicio, y se
  registra el intento. Nunca un 404 crudo ni error de servidor.
- Se conserva la allowlist de hosts de destino de `index.php`. Es protección real
  contra open redirect y se porta sin cambios.
- El redirector propaga el origen. Al redirigir a un evento agrega el código como
  parámetro, y el formulario lo guarda. Así se conectan escaneos con inscripciones y se
  puede ver qué QR del stand funcionó. Hoy eso existe a medias en Expomina con el
  parámetro `o`, pero manual.

---

## 6. Esquema de datos (Supabase / Postgres)

```
configuracion        fila única: logo, colores, tipografía, datos de empresa,
                     dominio canónico

qr_codes             codigo (PK, texto corto)
                     tipo: empleado | evento | url | recurso | wifi
                     destino_url, destino_id
                     activo, en_material_impreso (bool)
                     perfil_generacion, version_modulo_qr
                     creado_en, notas

qr_cambios           qr_codigo, destino_anterior, destino_nuevo,
                     fecha, motivo
                     registro de auditoría de reasignaciones

escaneos             qr_codigo (FK), fecha, user_agent, referrer,
                     dispositivo, pais_aprox
                     solo INSERT, índice compuesto (qr_codigo, fecha)

escaneos_diarios     agregado por pg_cron cada madrugada
                     el panel lee de aquí, nunca cuenta filas en vivo

empleados            nombre, cargo, area, telefono, whatsapp, email,
                     foto, redes, slug, estado, orden

eventos              slug, nombre, fecha_inicio, fecha_fin, sede,
                     portada, contenido, plantilla_visual,
                     estado, cierre_inscripciones,
                     campos_opcionales (qué campos muestra su formulario)

contactos            nombre, empresa, cargo, email, telefono
                     un contacto = una persona, no una inscripción

inscripciones        contacto_id, evento_id, fecha,
                     consentimiento_aceptado, version_consentimiento,
                     origen (código QR o 'directo'),
                     extras (JSONB)

leads                contactos capturados desde tarjetas de empleado
```

### Notas

- `escaneos_diarios` no es optimización prematura: es la diferencia entre un panel que
  responde igual con mil o con dos millones de escaneos.
- Separar `contactos` de `inscripciones` es lo que convierte esto en una base de
  contactos de la empresa. Ver sección 7.
- Guardar `version_consentimiento` en cada inscripción es lo único que permite demostrar
  después a qué texto exacto dijo que sí una persona.
- **RLS obligatoria en todas las tablas.** La clave anónima es pública por diseño; sin
  RLS cualquiera lee y escribe. La `service_role` jamás aparece en el frontend.
- `escaneos` e `inscripciones`: política de solo inserción para el rol anónimo.

---

## 7. Eventos y formulario

Reemplaza el patrón de "una página + un Apps Script por evento", que es lo que produjo
tres backends distintos con tres conjuntos de problemas.

### Un solo formulario, muchos diseños

El diseño visual y la estructura de datos son capas separadas. Cada evento puede tener
su plantilla visual propia; el formulario es siempre el mismo.

Campos fijos: nombre, empresa, cargo, email, teléfono, consentimiento. Más `extras` en
JSONB para los dos o tres campos que algún evento pida. Cada evento marca con casillas
qué campos opcionales muestra.

Por qué formulario único, más allá de ahorrar trabajo: permite **una sola tabla de
contactos**. La misma persona que se registró en tres ferias es un contacto con tres
inscripciones, no tres filas sueltas que nadie va a cruzar. Con formularios distintos
por evento eso es imposible: tres estructuras, tres exports que no se pueden unir.

Un constructor de formularios genérico sería sobreingeniería para un solo
administrador, y además rompería esta propiedad.

### Ciclo de vida

Estados: `borrador`, `activo`, `cerrado`, `archivado`, con fecha de cierre automático.
Un evento que termina deja de aceptar respuestas solo, sin que nadie tenga que
acordarse de despublicar nada. Esto resuelve estructuralmente lo que pasó con Expomina.

### Consentimiento

Una sola política de privacidad, versionada, enlazada desde todos los formularios.
Tiene que existir **antes** de publicar el primer formulario activo. Hoy Expomina tiene
una casilla de consentimiento que no enlaza a ninguna política porque no existe.

### Corrección heredada de Expomina

`origenQR()` cae a `'video'` cuando no hay parámetro, así que alguien que teclea la URL
a mano queda registrado como si hubiera escaneado el QR del video. El default correcto
es `'directo'`. Portar la sanitización tal cual (alfanumérico y guiones, corte a 40
caracteres); cambiar solo el default.

### Anti-spam

Campo trampa oculto más límite de envíos por IP en el Edge Function de inserción. Un
formulario público sin esto se llena de basura en semanas.

---

## 8. Empleados

- `/empleados/[slug]` con tarjeta, descarga `.vcf` generada en el navegador, botones de
  llamada, WhatsApp y correo.
- `/empleados` como directorio, con orden configurable.
- Captura de leads desde la tarjeta.
- Generador de firmas de correo desde los mismos datos.

### Baja de empleado

Estado activo / inactivo. Al pasar a inactivo, la tarjeta deja de estar publicada y su
QR impreso en la credencial lleva al directorio con un mensaje sobrio. Definirlo ahora
y no el día que alguien renuncie.

---

## 9. Notificaciones

`expomina-avisos.js` está separado porque tocar el script del formulario obligaba a
republicar el Web App, y un clic equivocado cambiaba la URL `/exec` y mataba la captura
en plena feria. El razonamiento era correcto para Apps Script.

En Supabase el problema desaparece: un trigger sobre `inscripciones` dispara un Edge
Function que envía el correo. Cambiar el aviso ya no toca el camino de captura. El
patrón de `LockService` no hace falta; Postgres maneja la concurrencia.

---

## 10. Respaldos

El punto que menos se ve y más duele. Hoy los datos están en Google Sheets, que hace
copias solo sin que nadie piense en eso. Al mover todo a Supabase esa red desaparece
sin que se note.

Requisito, no opcional: respaldo programado con retención, o plan de pago con
recuperación por punto en el tiempo. Idealmente ambos. Verificar al menos una vez que
una restauración funciona de verdad.

---

## 11. Fases

### Fase 0 — Limpieza y cierre

1. Archivar la implementación del Web App de `amonestacion.js` desde Implementar →
   Administrar implementaciones. Mover el código fuera de `src/pages/`, porque Astro
   publica todo lo que esté ahí. **Mover archivos no cierra el endpoint:** vive en
   Google, no en el repositorio.
2. Exportar las respuestas históricas de Expomina antes de tocar nada. Se recolectaron
   bajo un texto de consentimiento concreto y son la única copia. Archivar el proyecto
   de Apps Script, no eliminarlo, hasta confirmar que la migración quedó completa. No
   borrar la hoja de cálculo.
3. Cerrar el `doPost` de Expomina.
4. `.unlighthouse/` a `.gitignore` + `git rm -r --cached .unlighthouse`.
5. Borrar `dist/empresa/config.php` del disco local, para que un FTP manual no pise el
   config real del servidor con uno vacío.
6. Corregir el fallback de `index.php:13`, que manda a `inacons.com.pe` cuando el sitio
   vive en `home.inacons.com.pe`.
7. Unificar el dominio en `import.meta.env.SITE`. Hoy solo `/recursos/` lo hace bien;
   hay otros cinco lugares que lo repiten a mano.
8. `/panel/` y `/recursos/` en `robots.txt`.
9. Corregir `expomina.js:3,18`, que apunta a una ruta que ya no existe.

**Aceptación:** el repositorio no tiene artefactos generados rastreados, ningún
endpoint de Apps Script responde con datos, y el dominio aparece escrito a mano en cero
archivos.

### Fase 1 — Base Supabase

- Proyecto, esquema completo, RLS en todas las tablas, datos de prueba.
- Auth con usuario y contraseña.
- Deploy de `/panel/` vacío pero autenticado, subiendo por el pipeline real de GitHub
  Actions.

Esto va primero porque si el despliegue no está resuelto, todo lo demás se atasca
después.

**Aceptación:** con la clave anónima, desde el navegador, no se puede leer ni escribir
ninguna tabla sin sesión. Probarlo explícitamente.

### Fase 2 — Módulo QR y redirector

- `src/lib/qr.ts` con los dos perfiles, SVG y modo alfanumérico.
- Redirector PHP en `/r/`: allowlist, registro de escaneo, 302, insensible a mayúsculas,
  propagación de origen, página sobria para código desconocido.
- Reglas de compatibilidad de la sección 2 en `.htaccess`, **borrando la regla `^r/`
  actual en el mismo commit** para no crear un bucle.
- Migrar `qr_links` de MySQL a Postgres conservando los códigos existentes.
- Reapuntar `/recursos/` al módulo nuevo, lo que cierra el bug de los 220 px.

**Aceptación:** un QR generado en perfil impresión, impreso en A4, escanea
correctamente. Un código desactivado muestra la página sobria y queda registrado.

### Fase 3 — Panel

- CRUD de códigos, asignación, generación individual y masiva.
- Export SVG y PNG 1200 px, y hoja de impresión con URL legible.
- Registro de auditoría de reasignaciones.
- Tablero leyendo de `escaneos_diarios`.

`admin.php` se mantiene en pie hasta que `/panel/` haga lo mismo. El 301 de
`/empresa/admin.php` se activa al final de esta fase, no antes.

### Fase 4 — Eventos

- `/eventos/[slug]`, plantillas visuales, formulario fijo con campos opcionales,
  estados, export CSV.
- Política de privacidad publicada antes del primer formulario activo.
- Migrar Expomina 2026 como evento archivado, con sus inscripciones históricas
  importadas.

### Fase 5 — Empleados

Tarjetas, directorio, `.vcf`, leads, generador de firmas, baja de empleado.

---

## 12. Qué no se toca

Lo primero que se pierde en una migración es lo que estaba bien resuelto y nadie
recuerda por qué:

- **La allowlist anti open-redirect de `index.php`.** Se porta igual.
- **La distinción pantalla/impresión de `admin.php`.** Se porta igual.
- **La regla `/r/` del `.htaccess`.** Ya existe y funciona.
- **El re-render fuera de pantalla para descarga** en vez de escalar el preview. Con SVG
  deja de hacer falta, pero el principio se mantiene para el export PNG.
- **El endurecimiento de sesión de `admin.php`:** cookie `secure`/`httponly`/
  `SameSite=Strict`, CSRF con `hash_equals`, rate limiting de 5 intentos por IP en 10
  minutos, bcrypt, `session_regenerate_id` tras login. Supabase Auth cubre lo
  equivalente, pero verificar que nada de esto se pierde, no darlo por sentado.

---

## 13. Advertencia operativa

El plan gratuito de Supabase pausa el proyecto tras una semana de inactividad. Con QRs
impresos circulando, eso es un fallo en producción sin aviso previo. **Contratar plan de
pago antes de imprimir el primer lote.**

---

## 14. Registro de ejecución

### Fase 0 — parcialmente completa (set 2026)

Hecho en el repositorio:

| # | Qué | Dónde |
|---|---|---|
| 1 | Formulario de amonestaciones despublicado y archivado | `_archivo/formulario-amonestaciones/` |
| 3 | Interruptor `CAPTURA_ABIERTA = false` en el backend de Expomina | `src/appscripts/expomina.js` |
| 4 | `.unlighthouse/` ignorado y sacado del índice (219 archivos, 32 MB) | `.gitignore` |
| 5 | `dist/empresa/config.php` borrado del disco local | — |
| 6 | Fallback del redirector derivado de `BASE_URL` | `public/empresa/index.php` |
| 7 | Dominio unificado: `site` es la única fuente | `astro.config.mjs`, `BaseLayout.astro`, `PageHero.astro`, `recursos/index.astro`, `404.astro`, `expomina.astro` |
| 8 | `robots.txt` bloquea `/panel/`, `/empresa/`, `/admin/`, `/recursos/`, `/formulario/` | `public/robots.txt` |
| 9 | Rutas obsoletas corregidas en el encabezado | `src/appscripts/expomina.js` |

Verificado tras el build: canonical, `og:image`, JSON-LD y sitemap apuntan a
`home.inacons.com.pe`; el dominio corto aparece en cero archivos del build;
`/formulario/` no existe en `dist/`.

**Pendiente, requiere acción en Google:** pasos 1 (archivar la implementación), 2
(exportar el histórico) y 3 (desplegar el interruptor). Hasta que eso ocurra, el
criterio de aceptación de la Fase 0 **no se cumple**: el endpoint de amonestaciones
sigue respondiendo con datos.

### Fase 1 — preparada en el repositorio, pendiente de crear el proyecto (set 2026)

Hecho en el repositorio:

| Qué | Dónde |
|---|---|
| Esquema completo de la sección 6: 11 tablas, tipos, triggers y funciones | `supabase/migrations/0001_esquema.sql` |
| RLS en todas las tablas, con verificación incluida | `supabase/migrations/0002_rls.sql` |
| `escaneos_diarios` + tarea de `pg_cron` a las 03:00 de Lima | `supabase/migrations/0003_agregados.sql` |
| Datos de prueba, con su bloque de borrado | `supabase/migrations/0004_datos_prueba.sql` |
| Cliente único de Supabase | `src/lib/supabase.ts` |
| `/panel/` con login, sesión persistente y prueba de aislamiento | `src/pages/panel/index.astro` |
| Variables de entorno del build en el pipeline real | `.github/workflows/deploy.yml`, `.env.example` |
| `/panel/` fuera del sitemap; filtro corregido a primer segmento | `astro.config.mjs` |

#### Comprobado contra el proyecto real (set 2026)

Proyecto creado, las cuatro migraciones ejecutadas, registro de usuarios
desactivado, usuario administrador creado y presente en `administradores`.

| Prueba | Resultado |
|---|---|
| Lectura anónima sobre las 11 tablas | `401 / 42501` en todas |
| Escritura anónima en `escaneos` | `401 / 42501` |
| `resolver_qr()` con la clave pública | `401` — sin permiso, como quedó por diseño |
| Login y sesión persistente en `/panel/` | Funciona |
| `es_admin()` para el usuario administrador | `true` |

El criterio de aceptación —"con la clave anónima, desde el navegador, no se puede
leer ni escribir ninguna tabla sin sesión"— **se cumple**, verificado contra el
proyecto real y no solo en local.

Una nota sobre cómo se comprobó: el SQL Editor de Supabase responde `Success`
igual cuando un `insert` inserta una fila que cuando no inserta ninguna, y hasta
esta fase el panel no leía ninguna tabla, así que daba la bienvenida a cualquier
usuario con sesión estuviera o no en la allowlist. Las dos señales que parecían
confirmar el alta eran compatibles con que el `insert` no hubiera hecho nada. Por
eso el panel ahora consulta `es_admin()` y lo dice explícitamente.

**Pendiente para cerrar la fase:** el despliegue de `/panel/` por el pipeline real
de GitHub Actions, que es parte del criterio y no está hecho. Requiere los secrets
`PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_ANON_KEY` en el repositorio, y el merge a
`main`.

**Pendiente, con fecha límite:** rotar la clave `service_role` / `sb_secret_` del
proyecto. Quedó expuesta durante la puesta en marcha. Hoy el riesgo es bajo porque
la base solo tiene datos de prueba inventados; tiene que estar rotada **antes de la
Fase 4**, que es cuando entran contactos de personas reales.

#### Dos decisiones que se apartan de lo escrito arriba

**1. Tabla `administradores`, que la sección 6 no contempla.**

La alternativa era que las políticas dijeran "cualquier usuario autenticado". Eso
deja la base entera colgando de un interruptor del panel de Supabase
(Authentication → Sign Ups). Si alguien lo activa por error, cualquier persona se
registra sola, queda autenticada y con ello lee `contactos`: nombres, correos y
teléfonos de personas reales. Bajo la Ley 29733 eso es una brecha con
consecuencias, y el costo de evitarla es una tabla y una función.

No contradice "sin sistema de roles" de la sección 3: no hay roles, hay una lista
de quién entra. Sigue habiendo exactamente dos niveles.

**2. Las políticas de inserción anónima sobre `escaneos` e `inscripciones` no se
crean todavía.**

La sección 6 las menciona, pero crearlas ahora choca de frente con el criterio de
aceptación de esta fase —"sin sesión no se puede leer ni escribir ninguna tabla"—
y dejaría dos puertas abiertas durante semanas sin nada detrás que las use.

Se otorgan en la fase que trae el código que las necesita: `escaneos` en la Fase 2
junto con el redirector, `inscripciones` en la Fase 4 junto con el formulario. Es
un aplazamiento, no una eliminación.

Por la misma razón, `resolver_qr()` ya existe en el esquema pero sin permiso para
el rol anónimo.

### Fase 2 — completa en código, pendiente la prueba física (set 2026)

| Qué | Dónde |
|---|---|
| Módulo único de QR: dos perfiles, SVG, modo alfanumérico | `src/lib/qr.ts` |
| Logo opcional al centro, solo con ECC H | `src/lib/qr.ts` |
| Redirector: allowlist, registro, 302, insensible a mayúsculas, origen | `public/r/index.php` |
| Permiso de `resolver_qr()` al rol anónimo + validación de host | `supabase/migrations/0005_redirector.sql` |
| Los cuatro códigos de MySQL, migrados con su nombre exacto | `supabase/migrations/0006_migrar_codigos.sql` |
| `.htaccess`: regla nueva y borrado de la vieja, mismo commit | `public/.htaccess` |
| `/recursos/` apuntado al módulo — cierra el bug de los 220 px | `src/pages/recursos/index.astro` |

Verificado en producción: los cuatro códigos resuelven por `/r/CODIGO` y por la
forma larga; la cadena es `301 → 302 → 200`, sin bucle; un código inexistente
devuelve la página sobria con 404.

#### Decisiones que se apartan de lo escrito

**La allowlist anti open-redirect se movió de PHP a la base.** La sección 12
decía portarla igual. Se conserva la protección, pero la lista pasó a
`configuracion.hosts_permitidos`. Con la lista en PHP habría dos —la del
servidor y la que el panel use al guardar— y el día que alguien agregue un
dominio desde el panel, el redirector seguiría rechazándolo, con el síntoma
"guardé el destino y no funciona" y ningún error que lo explique.

Esa decisión ya evitó un fallo: `tickets_ti` apunta a `materen-ti.vercel.app`,
que **no estaba** en la lista copiada de la plantilla del repositorio. El
`config.php` real del servidor —ignorado por git, nunca visto— tenía una entrada
más. Se detectó probando los cuatro códigos contra producción antes de migrar.

**El redirector consulta en vivo, sin caché.** Medido desde el propio servidor:
69–87 ms contra Supabase, la tercera parte del umbral que se había fijado. Una
sola fuente de verdad y ninguna ventana en la que un destino recién cambiado
siga mandando al sitio viejo.

**El 301 de `/empresa/admin.php` a `/panel/` NO entró.** Se activa al final de la
Fase 3, como dice la sección 11: desviarlo antes deja al administrador sin
herramienta.

#### Hallazgos que corrigieron el módulo

- **El PNG exportado tenía módulos de ancho desigual.** 1200 px sobre un lienzo
  de 41 módulos da 29,2683 px por módulo, así que el rasterizador reparte 29 a
  unos y 30 a otros. El lado se ajusta ahora al múltiplo exacto.
- **El logo consume la mitad del margen de corrección.** Medido pintando manchas
  solo sobre datos y decodificando hasta el fallo: sin logo aguanta 12, con logo
  al 0.20 aguanta 6. Por eso es opt-in y por defecto no se usa.
- **Los códigos heredados llevan guión bajo**, que no está en el alfabeto
  alfanumérico. Medido: a estas longitudes no cambia el tamaño del símbolo, así
  que se conservan tal cual.

#### Pendiente para cerrar la fase

El criterio pide que **un QR en perfil impresión, impreso en A4, escanee
correctamente**. Eso solo se comprueba imprimiendo y escaneando.

### Fase 3 — a mitad (set 2026)

Hecho:

| Qué | Dónde |
|---|---|
| Listado de códigos con estado y escaneos acumulados | `src/pages/panel/index.astro` |
| Alta, edición, baja y reactivación. **Sin borrar** | idem |
| Reasignación de destino con motivo, vía `reasignar_qr()` | `supabase/migrations/0009_panel.sql` |
| Generación del QR en los dos perfiles, export SVG y PNG | `src/lib/qr.ts` |
| Hoja de impresión con la URL legible debajo | `src/pages/panel/index.astro` |
| Recálculo del agregado a demanda | `agregar_escaneos_diarios()` |
| `.tabla` y `.dialogo` en el sistema de diseño | `design-system.css` |

Falta: generación **masiva**, pantalla que muestre el **registro de auditoría**
(hoy se escribe pero no se lee desde ningún sitio), **tablero** de escaneos por
día, y el 301 de `/empresa/admin.php` a `/panel/`, que se activa al final de
esta fase.

#### Cinco fallos que aparecieron probando, no revisando

Todos los encontró el usuario usando el panel. Ninguno lo encontró una lectura
del código, incluida la mía.

**`/R/` en mayúscula devolvía 404, y eso rompía TODOS los QR generados.** El
módulo codifica la URL entera en mayúsculas para habilitar el modo
alfanumérico, así que un escaneo real llega como `/R/CODIGO`; la regla de
Apache era `^r/`, sensible a mayúsculas. El código existía, la base estaba
bien, `resolver_qr()` respondía, y el enlace tecleado en minúsculas funcionaba:
solo fallaba lo que salía de un escaneo. Se hizo insensible el CÓDIGO, dentro
de Postgres, y se olvidó el SEGMENTO de la ruta, que lo resuelve Apache. La
especificación pedía las dos cosas en la misma frase.

**`display: flex` en `.dialogo` anulaba el atributo `hidden`.** Los dos
diálogos del panel se pintaban apilados sobre la página y no se podía usar
nada. La protección `[hidden] { display: none !important }` existía en el
`<style>` del panel y se perdió al mover los componentes al sistema de diseño.
Ahora vive en el reset, donde protege a todo componente futuro.

**Cuatro reglas CSS dimensionaban un SVG inyectado en tiempo de ejecución**, en
`/recursos/`, `/sistema/` y el panel. Astro las compila como
`.contenedor[cid] svg[cid]` y el SVG inyectado no lleva ese `cid`: no
enganchaban con nada. Es exactamente la trampa que CLAUDE.md documenta en su
primera regla dura, escrita tres veces seguidas sin verla.

**La URL se mostraba en mayúsculas.** Correcto para el símbolo, incorrecto para
una persona: parece un error y es incómoda de teclear en la hoja impresa. Ahora
se codifica en mayúsculas y se muestra en minúsculas.

**El código de origen se añadía también a destinos ajenos.** `?o=` sirve para
conectar un escaneo con lo que la persona hizo después, y eso requiere que la
página de destino lo lea. Un sitio de terceros no lo lee: solo se le
modificaba la URL sin motivo.

#### Y uno de infraestructura

**El HTML se cacheaba una hora.** El `.htaccess` pedía cero segundos y
`mod_expires` lo aplicaba, pero el hosting inyecta su propio `Cache-Control`, y
`max-age` le gana a `Expires`. Cada despliegue tardaba hasta una hora en
llegarle a quien ya había visitado el sitio; el síntoma parecía un fallo de la
aplicación y era una cabecera. Se corrige con `mod_headers`, que el hosting sí
respeta.

De paso: `text/css` estaba declarado a un año y `design-system.css` tiene
nombre fijo. Si esa regla hubiera llegado a aplicarse, un arreglo de estilos no
habría llegado durante un año a quien ya visitó el sitio. Los que sí se cachean
para siempre son los de `/_astro/`, que llevan hash en el nombre.
