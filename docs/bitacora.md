# Bitácora

Qué se hizo y por qué, sesión por sesión, y la **lista única de pendientes**. El cómo operar
cada cosa está en [deploy.md](deploy.md) y [contenido.md](contenido.md); aquí solo el
contexto que no se deduce del código.

## Pendientes abiertos

La única lista: las sesiones de abajo ya no llevan la suya. Al cerrar uno se borra de aquí y
se cuenta en la sesión que lo cerró. Los códigos (E-01, S-02…) son los de la auditoría
técnica del 2026-10-16, que se retiró el 2026-10-31: cada uno trae aquí lo necesario para
entenderlo sin ella.

### Infraestructura y cuentas (fuera del repositorio)

- [ ] **E-01, el más urgente.** `inacons.com.pe` y `www` dan 404 en toda ruta menos `/`
      (comprobado el 2026-10-22). Falta un 301 que conserve la ruta en el `.htaccess` del
      docroot del dominio raíz, que no está en este repositorio:
      `RewriteCond %{HTTP_HOST} ^(www\.)?inacons\.com\.pe$ [NC]` +
      `RewriteRule ^(.*)$ https://home.inacons.com.pe/$1 [R=301,L]`. Así `/R/CANAL_ETICO`
      en el dominio raíz llega a `home`, donde ya se resuelve.
- [ ] **SEG-01, repositorio público.** `InaconsSRL/inacons-web` es público en GitHub. No hay
      secretos, pero esta bitácora y `deploy.md` publican las debilidades abiertas, el usuario
      principal de cPanel y los correos que reciben cada tipo de denuncia. Decidir si debe
      serlo; si no, pasarlo a privado (el deploy y Dependabot siguen igual).
- [ ] **S-02, accesos.** La cuenta de Cloudflare (Worker, secrets y la base con los reportes
      del Canal) cuelga del Gmail `soporteinformatico.inacons@gmail.com`: agregar
      `administracion@inacons.com.pe` como miembro, 2FA en Cloudflare, Zoho, GitHub y cPanel,
      y un segundo propietario en Search Console.
- [ ] **Turnstile:** quitar `localhost` de los dominios del widget. Desde el 2026-10-31 el
      Worker ya rechaza los tokens resueltos fuera del sitio; esto es higiene.
- [ ] **D-03, monitorización.** Monitor externo gratuito sobre `/` y `/contacto/`. Los avisos
      fallidos ya se reintentan solos, pero lo que siga en `error` pasados 7 días, o el tope
      diario alcanzado, solo se ve en D1 o en Logs: falta que alguien reciba la alerta.
- [ ] **B-03, respaldo de D1.** Confirmar Time Travel o programar `wrangler d1 export`, y
      probar una restauración una vez.
- [ ] **S-01 y D-04, hosting.** El deploy va por FTP sin cifrar y no hay staging. O el
      proveedor habilita FTPS (variable `FTP_PROTOCOL = ftps`), o el sitio estático pasa a
      Cloudflare Pages con un CNAME para `home.`, sin mover la zona DNS: deploy por API,
      vista previa por rama y cabeceras propias (el `.htaccess` se traduce a `_redirects` y
      `_headers`). Conviene decidirlo antes de la v3.
- [ ] **D-02:** desplegar el Worker desde CI (hoy CI solo lo prueba; el deploy es a mano).
- [ ] **CSP a bloqueo:** dos semanas con la consola sin violaciones (ver
      [deploy.md](deploy.md#publichtaccess)).

### Cumplimiento y abogado

- [ ] **L-01, política de privacidad.** El abogado cierra lo marcado *pendiente* en
      `privacidad.astro`, que además tiene que nombrar a Cloudflare y a Zoho como proveedores
      y el plazo de 12 meses de las consultas. Después, `PRIVACIDAD_PUBLICADA = true`.
- [ ] **L-04:** declarar la transferencia de datos fuera del Perú (D1 en el este de EE. UU.,
      Zoho CPaaS, Cloudflare).
- [ ] **B-01:** plazo de conservación de los reportes del Canal Ético; hoy no se purgan.
- [ ] **B-02:** cada tipo de reporte llega a una sola persona y la página promete un comité.
      Destinatarios por rol y suplentes (se cambian en `TIPOS` de `canal.ts`).
- [ ] **L-02:** la cláusula de tratamiento de datos de los términos del Canal solo dice la
      finalidad; falta responsable, plazo, destinatarios y derechos.
- [ ] **Confirmar con cumplimiento** que aceptar los términos en el paso 1 del mismo
      formulario, y no en una página anterior, les basta.
- [ ] **L-03:** el mapa de Google de `/contacto/` y el vídeo de YouTube de `/nosotros/` cargan
      sin consentimiento previo (cargarlos tras un clic, o imagen estática con enlace).
- [ ] **Avisar a los responsables** que estos códigos del 2026-10-15 fueron pruebas:
      `CE-KMNV-6GUR` (ventas@), `CE-5SLA-9HZN` y `CE-TYJ8-WG85` (oficialdecumplimiento@),
      `CE-KTK2-7FAK` (sig@), `CE-KUSZ-6Q6S` y `CE-R22C-ED62` (tbalbin@).
- [ ] Decidir si se borra la consulta de prueba n.° 1 de `consultas`.

### Contenido que tiene que entregar la empresa

- [ ] **E-02:** los servicios tienen entre 105 y 149 palabras y hay 2 fichas de proyecto
      frente a los 94 que suma `PROYECTOS_POR_CIUDAD`. Ampliar servicios y publicar más fichas.
- [ ] `destacados`, `faqs`, `ficha` (cliente, plazo, alcance, estado) y `resumen` para
      servicios y proyectos: las secciones existen y no se ven hasta que el `.md` los traiga.
- [ ] **Fotos de obra reales.** Las dos fichas de proyecto reutilizan fotos genéricas.
- [ ] Año de fundación, código postal y coordenadas, para volver a ponerlos en el JSON-LD.
- [ ] Sellos de las normas ISO, con permiso y archivo del organismo, y su `vigencia`.

### Medición y pruebas

- [ ] **Lighthouse** en móvil sobre las cinco páginas clave, sobre todo el LCP del home.
- [ ] **C-01:** no se mide ninguna conversión. Mínimo, contar semanalmente las filas de
      `consultas`; si se quiere atribución, analítica con eventos y sin cookies.
- [ ] **Móvil real y lector de pantalla:** cambio de foco entre pasos del Canal y menú móvil.
- [ ] **Search Console:** confirmar que las URLs del sitemap están indexadas y mirar
      *Rendimiento*.

### Auditoría técnica del 2026-10-31

Lo que sigue abierto de esa auditoría; los códigos son los suyos. Lo ya resuelto está en
las sesiones del mismo día, abajo.

- [ ] **CI-01, PR de Dependabot.** Ya pasan por el CI (desde el 2026-10-31). Fusionar los 7
      abiertos cuando estén en verde; las acciones que suben de v4 a v7 (`checkout`,
      `setup-node`, `upload-artifact`), después de leer sus notas de versión.
- [ ] **SEG-06, CSP antes del bloqueo:** `report-to` hacia el Worker (sin él no se puede
      verificar "dos semanas sin violaciones"), el host exacto del Worker en `connect-src`
      en vez de `*.workers.dev`, y `form-action 'self'`.
- [ ] **A11Y-07, detalles:** el logo lleva dos `alt="INACONS"`, `aria-label="Breadcrumb"`
      está en inglés, hay un h3 dentro de un paso h3 en el Canal, el menú desplegable de
      escritorio no se cierra con Esc y, con movimiento reducido, los últimos logos del
      carrusel nunca se ven.
- [ ] **FE-01:** sin JS, el titular del home queda incompleto y `data-aos` deja contenido
      invisible; no hay `@media print`.
- [ ] **FE-04 y FE-05, reglas 2 y 3:** medidas fijas sin token (`--container-max`,
      `--header-h`), componentes propios de página, y datos escritos en las páginas
      (políticas de `/documentos/`, contactos de `/mineria/`, `hasCredential` del JSON-LD).
- [ ] **PERF-02:** el fondo de `/mineria/` (la página de los QR, que se abre en el móvil)
      se pide a 1920 px sin srcset.
- [ ] **SEO-01:** `site.webmanifest` sale sin `Content-Type`; el redirect genérico de
      `.html` capturaría archivos de verificación de buscadores.
- [ ] **Worker, restos:** el límite por hora de contacto cuenta y después inserta (carrera);
      `ip_hash` se guarda 12 meses aunque solo sirve una hora; pruebas con
      `@cloudflare/vitest-pool-workers` en vez de Node.
- [ ] **DOC-01:** afirmaciones desfasadas en `arquitectura.md` (hook de `initTabs`, sellos
      en `public/`), `contenido.md` (carpeta de proyectos de ejemplo) y `deploy.md` (salida
      del `curl` de analítica).

### Para más adelante

- [ ] **E-04:** servir el sitio desde el dominio raíz y dejar `home.` como redirección. Es
      decisión de negocio y depende del hosting.
- [ ] Adjuntar fotos en el Canal Ético: requiere almacenamiento (R2) y limpiar los metadatos
      antes de aceptarlas en reportes anónimos.
- [ ] La banda de cierre con foto solo se usa en las fichas; nosotros, sostenibilidad y
      documentos siguen con la lisa.

## 2026-10-31 — Accesibilidad de formularios, foco y diálogos; cifras desde `CIFRAS`

Pedido: la tanda de accesibilidad y front de la auditoría del mismo día (A11Y-02 a 06 y
FE-02).

| Qué | Por qué |
|---|---|
| `validarCampos()` en `formulario.ts`: cada campo inválido lleva un `.form-error` con el motivo, `aria-invalid` y `aria-describedby`, y el foco va al primero; el mensaje se va al corregir. Lo usan `/contacto/` y los tres pasos del Canal | Antes solo cambiaba el color del borde y salía la burbuja del navegador en el primer campo, que desaparece sola: sin ver el rojo, o con lector de pantalla, no se sabía qué faltaba (WCAG 1.4.1 y 3.3.1). |
| Tras un envío correcto el foco va al aviso de éxito | En el Canal iba al título del paso 1 justo cuando `role="status"` anunciaba el código: el cambio de foco suele pisar el anuncio, y en un reporte anónimo ese código es la única forma de seguir el caso. |
| El header y el top-bar ocultos vuelven si algo de adentro recibe foco; `scroll-padding-top` en `html` | Al volver con Shift+Tab el foco caía en enlaces que no se veían, o debajo del header fijo (WCAG 2.4.11). |
| El submenú móvil cerrado lleva `visibility: hidden` | Con solo `max-height: 0` los seis servicios seguían recibiendo foco sin verse. |
| `/mineria/`: `<dialog>` nativo con `command`/`commandfor`; un script solo para navegadores sin invocadores y para cerrar con un clic fuera; `autofocus` en Cerrar | Los `div[role=dialog]` no atrapaban el foco ni dejaban inerte el fondo, y sin JS el botón "Contacto" de la página de los QR no hacía nada. Ahora el navegador hace todo eso. El script en línea cambió: nuevo hash en la CSP (el verificador lo pidió). |
| "15 años" (11 frases) y "200 trabajadores" salen de `CIFRAS` vía `ANIOS_EXPERIENCIA`; `DESCRIPCION_EMPRESA` también | Regla 5: si el brochure cambia, las frases se quedaban con el número viejo. En `obras-civiles.md`, que no puede interpolar, la frase ya no cita la cifra ("maquinaria propia y obra ejecutada en los sectores…"). |

Probado en el navegador con un build con endpoint de prueba y `fetch` sustituido en la
página (sin envíos reales): mensajes y foco en `/contacto/` y en los tres pasos del Canal,
foco en el aviso con el código tras el envío, header de vuelta con el foco adentro,
submenú cerrado sin foco y abierto con foco, diálogos modales con foco en Cerrar, cierre
por clic fuera y foco devuelto al botón. Consola sin errores.

## 2026-10-31 — CI en pull requests y contratos del build

Pedido: la tanda de CI de la auditoría del mismo día.

| Qué | Por qué |
|---|---|
| El workflow ("CI y deploy") corre también en cada pull request; el FTP solo en `main`, en un job `desplegar` que espera a `sitio` | No corría nada en los PR: fusionar uno de Dependabot publicaba sin pasar ninguna prueba. Por eso había 7 sin fusionar. |
| `scripts/verificar-dist.mjs` (`npm run verificar`), en CI sobre el build sin variables y otra vez sobre el del deploy | Los contratos que fallan en silencio ahora cortan el CI: un script en línea sin su hash en la CSP, un selector de página que no encuentra ningún elemento (regla 1) y un enlace interno roto. |
| La regla 1 se comprueba contra el HTML generado, no con un grep | El grep de CLAUDE.md buscaba `] > [` con espacios y el CSS sale minificado: no detectaba nada. Corregir el patrón tampoco servía: `.contact-grid > *` es correcto y `.form-estado .btn` estaba muerto sin tener esa forma. El script distingue "el elemento existe pero lo pinta un componente hijo" (siempre error) de "no está en el HTML" (error, salvo que sea contenido condicional declarado en `CONDICIONALES`, como los sellos ISO). |
| Borrados `.form-estado .btn` (`contacto.astro`) y `.error-actions .btn svg` (`404.astro`) | Los dos primeros casos que encontró: el botón lo inyecta JS y el `svg` lo pinta `Icono`. Nunca se aplicaron, así que borrarlos no cambia nada visible. |
| La 404 sin canonical ni `og:url` (`canonical={false}` en `BaseLayout`) | Declaraba `/404/`, una URL que no existe; el verificador de enlaces lo marcó. |
| Job `auditoria` (`npm audit --audit-level=high`, sitio y Worker) y `timeout-minutes` en todos | Un aviso nuevo se ve en rojo sin frenar un cambio de contenido. Un FTP colgado retenía la cola hasta 6 h. |
| "Volver atrás" en [deploy.md](deploy.md) pasa a `git revert` + push | Subir el artefacto a mano dejaba desfasado `.ftp-deploy-sync-state.json` y el deploy siguiente mezclaba archivos. |

El verificador se probó con un error a propósito: un estilo en `sostenibilidad.astro`
sobre `.page-hero-content`, que pinta `PageHero`, cortó con el mensaje de componente hijo.
`npm audit` da 0 vulnerabilidades en los dos paquetes.

El primer run en GitHub dejó en rojo el job `worker`, aunque en local las 86 pruebas
pasaban. `contrato.test.ts` estaba excluido del `tsconfig` del Worker, así que Vite subió
hasta el del sitio, que extiende `astro/tsconfigs/strict`; el job solo instala el Worker y
no lo encontró. En local funcionaba porque `node_modules` del sitio estaba instalado.
Ahora todas las pruebas están en el `tsconfig` del Worker y `test/node.d.ts` declara lo
poco de Node que usan. Se reprodujo con una copia limpia y `npm ci --ignore-scripts`,
como en el CI.

## 2026-10-31 — Worker: avisos que no se pierden ni se duplican

Pedido: la tanda del Worker de la auditoría del mismo día, y desplegarlo. Commit `acdb0c8`;
desplegado como versión `f9f44fac`.

| Qué | Por qué |
|---|---|
| Tope de 4 s al enviar a CPaaS; marcar la fila y el acuse con `ctx.waitUntil`, después de responder | Un acuse lento llevaba al navegador a sus 10 s: el visitante veía error aunque el aviso había salido, reenviaba y, si era anónimo, perdía el código del primero. |
| Cron cada 15 min que reenvía con `[Reenvío]` lo que quedó en `error` o `recibido` (hasta 7 días, 20 por pasada) | Un reporte cuyo aviso fallaba quedaba guardado en D1 sin que nadie lo recibiera: solo dejaba un `console.error`. |
| `try/catch` global con CORS (500); falla si falta `IP_SALT`; sin purga si `RETENCION_MESES` no es válido | Un fallo de D1 salía sin CORS y el navegador lo mostraba como corte de red. Sin sal, el hash de la IP se revierte probando las IPv4; un valor negativo hacía que la purga no borrara nada en silencio. |
| Turnstile exige el host del sitio y una `action` por formulario (`contacto`, `canal`) y registra los errores del secret | Servía un token resuelto en `localhost` o en el otro formulario, y un secret mal puesto daba 403 a todos sin dejar rastro. |
| `origen` sin query (sitio y Worker), nombre sin dominios sueltos ni separadores Unicode, correo en minúsculas, fecha real, tope de 100 envíos por día y tabla | Una URL con UTM pasaba el límite y la consulta se perdía; la query podía acotar a quien reporta. "bit.ly/x" en el nombre llegaba como enlace desde nuestro dominio. `Ana@` y `ana@` esquivaban el tope. Sin tope global, con proxies se inundaba el buzón de cumplimiento. |

El sitio se publicó primero, con la `action` en los dos widgets, y el Worker después: al
revés, durante unos minutos el Worker habría rechazado los tokens de las páginas viejas.

Pruebas: de 34 a 86, con el router y el cron incluidos; `tsc` ahora también revisa las
pruebas. En producción: `OPTIONS` desde `localhost` da 403 (antes 204), desde el sitio
204 con CORS; GET 405, texto plano 415, datos inválidos y fecha imposible 400, token falso
403, ruta desconocida 404. No se envió ningún formulario real. En D1 no había nada que
reenviar (2 consultas, ambas avisadas; `reportes` vacía) y la tabla `limites` no existe:
se cierran los pendientes "Confirmar que el Worker publicado es el del repositorio" y
"Tabla `limites` en D1". Los hallazgos abiertos de la auditoría pasaron a la lista de
arriba.

## 2026-10-31 — Auditoría: tres arreglos rápidos

Pedido: corregir lo más barato de la auditoría técnica del mismo día.

| Qué | Por qué |
|---|---|
| `tabindex="-1"` en `<main>` y sin anillo de foco en él | "Saltar al contenido" no hacía nada: `initSmoothScroll` cancela la navegación nativa y `focus()` sobre un `<main>` no enfocable no mueve el foco, así que el siguiente Tab volvía al menú. |
| `method="post"` en `/contacto/` y `/canal-etico/`, y botón de envío apagado en el HTML | Sin el script, el formulario se enviaba por GET y la descripción de una denuncia quedaba en la URL, el historial y los logs del hosting. Ahora `conectarFormulario()` enciende el botón si hay endpoint (o, en contacto, el respaldo `mailto`). `/contacto/` ganó un `<noscript>` con el correo. |
| `data-astro-prefetch="false"` en los 14 enlaces a `/assets/` | El prefetch de Astro no distingue páginas de archivos: rozar "Descargar Brochure" bajaba 4,8 MB. La regla quedó escrita junto a `prefetch` en `astro.config.mjs`. |

Probado en el navegador: el foco llega a `<main>` y el siguiente Tab cae dentro del
contenido; los botones se encienden con endpoint y el del Canal sigue apagado sin él;
al pasar el cursor se precarga `/nosotros/` y no el PDF. `npm run check`, `npm run build`
y las 34 pruebas del Worker, en verde; los hashes de la CSP no cambian.

## 2026-10-31 — Unificación de la documentación y limpieza

Pedido: dejar el repositorio ordenado antes de los cambios grandes de la v3.

| Qué | Por qué |
|---|---|
| **Una sola lista de pendientes**, arriba de esta bitácora | Había listas en cada sesión, repetidas entre sí y con la auditoría; varias ya no decían si seguían abiertas. |
| Se borró `AUDITORIA.md` (local, fuera de git) | Lo abierto pasó a la lista con su código y una explicación que no depende de ella; lo cerrado ya estaba contado aquí. |
| Sección *Lo que un rediseño no puede romper* en [arquitectura.md](arquitectura.md) | Junta los contratos que cruzan archivos y que no rompen el build: URLs y QR, campos del Worker, CSP, `cf-turnstile` del CI. Es la lista a repasar en la v3. |
| El README ya no repite el árbol de carpetas | Vive en `arquitectura.md`. |
| Se quitó `public/assets/recursos/.gitkeep` | La carpeta ya tiene archivos. |

Revisado sin cambios: todos los archivos de `src/assets/` y `public/assets/` están en uso,
todos los iconos del catálogo y todos los componentes también. De `design-system.css`, los
avisos `notice--ok`, `--error` e `--info` los arma `formulario.ts` en tiempo de ejecución;
`.form-error`, `.panel--ghost`, `.panel-title`, `.panel-desc` y `.status-*` solo los usa hoy
`/sistema/`. Se dejaron: son piezas del sistema disponibles para la v3, no restos. `npm run check`, `npm run build` (20 páginas) y las 34
pruebas del Worker, en verde.

## 2026-10-28 — Revisión general y seguridad

### Qué se revisó

`npm run check` (0 errores), `npm run build` (20 páginas), `npm test` y `npm run check` del
Worker (34 pruebas), barrido de secretos en lo versionado, `.gitignore`, cabeceras de
`.htaccess` y los dos hashes de la CSP en modo informe contra los scripts en línea del
build: coinciden. Las únicas variables `PUBLIC_*` son el endpoint del Worker, la clave de
sitio de Turnstile y el token del beacon de analítica, públicos por diseño. No hay secretos
en el repositorio.

### Qué se corrigió

`npm audit` marcaba vulnerabilidades en `undici` y `zod` (raíz, dependencias transitivas de
`astro` y `@astrojs/sitemap`) y en `undici`/`miniflare`/`wrangler` (Worker, solo
herramientas de desarrollo). Se resolvió con `npm audit fix`, que solo tocó los lockfiles;
ahora marca 0 en ambos paquetes y check, build y pruebas siguen en verde.

## 2026-10-22 — Revisión de la documentación

### Punto de partida

Pedido: analizar toda la documentación y corregirla con lo que el repositorio dice hoy. Se
contrastó cada documento contra el código y la configuración (`deploy.yml`, `wrangler.jsonc`,
`schema.sql`, `.htaccess`, `astro.config.mjs`, `content.config.ts`, el Worker y las páginas),
y se corrió `npm test` en `workers/contacto/` (34 pruebas, todas en verde).

### Qué estaba desactualizado

| Dónde | Problema | Ahora |
|---|---|---|
| `deploy.md`, tabla de variables | Decía que `PUBLIC_CONTACT_ENDPOINT` y `PUBLIC_TURNSTILE_SITE_KEY` eran opcionales; el CI corta si están vacías desde `745ccff`. | Dice cuáles cortan y cuál solo avisa. |
| `deploy.md`, job `worker` | Hablaba solo de `tsc`; corre también `npm test`. | Corregido, con la nota de `concurrency` y `workflow_dispatch`. |
| `deploy.md`, indexación | Hablaba de los `Disallow` de `robots.txt`, que ya no tiene ninguno. | Explica por qué no hay y cuál es la lista que manda. |
| `deploy.md`, Worker | No mencionaba las variables de `wrangler.jsonc`, la purga diaria ni la tabla `limites` retirada. | Agregado. |
| `arquitectura.md`, árbol | Faltaban `Galeria`, `workers/contacto/`, `.github/` y los archivos sueltos de `public/`. | Agregados. |
| `arquitectura.md`, home | Describía las cifras como parte del hero sin la banda ni el `srcset`, y no había nada de las fichas. | Actualizado, con sección nueva de fichas. |
| `contenido.md` | Faltaba el ejemplo de certificaciones y qué hace `sello`; el tope de 3 destacados no es del schema; no decía que `consultas` guarda `ip_hash`. | Corregido. |
| `README.md` y `CLAUDE.md` | Sin `npm run check` ni los comandos del Worker; el README no listaba esta bitácora, `workers/` ni `Galeria`. | Corregido. |

### Comprobado en producción (solo lectura)

- `https://inacons.com.pe/` redirige con 301 a `home`, pero `/nosotros/` en `inacons.com.pe` y
  en `www` da **404**: **E-01 sigue abierto**.
- La cabecera `Content-Security-Policy-Report-Only` y el HSTS están publicados tal como los
  define el `.htaccess`.

### Decisiones

| Decisión | Por qué |
|---|---|
| No se creó ningún `.md` nuevo | La convención del repositorio lo prohíbe salvo petición; todo cabe en los cuatro de `docs/`. |
| `AUDITORIA.md` sigue fuera del repositorio | Describe riesgos abiertos de seguridad y de privacidad. Solo se cita por su ID desde aquí. (Se retiró el 2026-10-31.) |
| Lo no verificable se dejó como pendiente, no como hecho | Por ejemplo, si la tabla `limites` se borró de D1: el repositorio no lo dice. |

## 2026-10-16 — Canal Ético en tres pasos

### Punto de partida

La página apilaba cuatro bloques hacia abajo: garantías, términos, seis tarjetas de canal y el
formulario. Cada paso aparecía debajo del anterior y obligaba a bajar por la página. Además el
tipo de reporte se elegía dos veces: en una tarjeta, que solo rellenaba el selector, y en el
selector del propio formulario.

### Qué cambió

Un asistente de **tres pasos que ocupan el mismo lugar**, dentro de un solo panel: 1) términos y
casilla de aceptación, 2) tipo de reporte (seis opciones) y modalidad, 3) los datos y el relato.
Un indicador de pasos arriba, "Atrás" y "Continuar" abajo. Las garantías quedan encima, como
antes. Desaparecen las tarjetas aparte y el selector duplicado.

### Decisiones

| Decisión | Por qué |
|---|---|
| **Asistente y no formulario único con diálogo de términos** | Lo eligió la empresa. Conserva el orden actual, que es aceptar los términos **antes** de ver el formulario; con la casilla al final podría no valer si cumplimiento exige ese orden. |
| Un solo `<form>` con tres paneles | El envío y su contrato con el Worker no cambian. `scripts/formulario.ts` sigue siendo el mismo. |
| Cada paso se valida **antes de dejarlo**, y `was-validated` va en el panel y no en el formulario | Si fuera en el formulario, los campos del paso siguiente aparecerían en rojo antes de verlos. |
| La casilla de términos **no lleva `name`** | No viaja al Worker. Solo hace falta que sea obligatoria para avanzar. |
| Turnstile se pinta **a mano** al entrar al paso 3 (`render=explicit`) | El widget flexible toma su ancho del contenedor y dentro de un panel oculto mide cero. |
| Tras enviar bien se vuelve al paso 1 con los términos **sin aceptar** | Un reporte nuevo es una aceptación nueva. El código del reporte queda a la vista arriba. |
| Con **Enter** en un paso intermedio se avanza, no se envía | El `submit` se intercepta antes del de `formulario.ts`. |
| El aviso de un envío anterior se borra al moverse entre pasos, no en `ir()` | `ir()` también corre tras el éxito y se llevaría el código del reporte recién mostrado. |
| Sin JavaScript se ven los tres pasos **apilados**, sin indicador ni botones de avance | Es la mejora progresiva de la sesión anterior: el formulario no desaparece y se avisa que enviar necesita JavaScript. |
| Se retira el hash de la CSP de esta página | El script del asistente importa `formulario.ts` y Astro lo emite como archivo: la página ya no tiene scripts en línea salvo el de la clase `js`. |

### Componente nuevo

`.pasos` y `.pasos-acciones` en `design-system.css`, con demo en `/sistema/`: el indicador pinta
los estados `--hecho` y `--actual`; cambiar de paso lo hace la página. En móvil solo el paso
actual muestra su nombre.

### Commits

| Commit | Qué |
|---|---|
| `a043480` | Canal Ético: asistente de tres pasos en el mismo lugar, componente `.pasos` y su demo en `/sistema/`. |

### Pruebas hechas

- **En el navegador**, con `fetch` simulado: cada paso bloquea el avance si falta lo suyo; "Atrás" conserva lo elegido; el resumen del paso 3 refleja tipo y modalidad; los datos de identidad aparecen solo con "Con mi nombre"; 429 y 503 conservan el relato; el éxito muestra el código y reinicia el asistente. En modalidad anónima no viajan nombre, correo ni teléfono.
- **Turnstile:** emite token tras pintarse en el paso 3.
- **Móvil (375 px) y tablet:** sin desborde horizontal; los seis tipos en una columna.
- **Sin JavaScript** (simulado quitando la clase `js`): pasos apilados, sin indicador, solo el botón de enviar.
- **CSP en modo informe** sirviendo `dist/` con la cabecera real: sin violaciones al recorrer los tres pasos.
- **Pruebas del Worker:** 34, incluida la de contrato que lee los tipos de esta página.

## 2026-10-16 — Pequeño rediseño

### Punto de partida

Pedido: un rediseño pequeño —home, fichas de servicio y de proyecto, cabecera y pie, y
pulido de tokens—, aparte de las correcciones de la auditoría. Principio: **evolucionar, no
reemplazar**. Ninguna URL cambia, ningún `.md` existente deja de compilar, todo valor nuevo es
un token y todo componente nuevo se agregó primero a `/sistema/`. Referencia de diseño:
Bechtel (claro y oscuro alternados, tipografía grande, KPIs integrados en el layout).

### Qué cambió

| Área | Cambio |
|---|---|
| **Home** | Las cuatro cifras del brochure bajan de una columna junto al titular a una **banda debajo**. El titular tiene todo el ancho y sube de 50 a 56 px. El póster del hero es un `<img>` con `srcset`. "Ver todos" de servicios y proyectos va a la derecha del título. |
| **Fichas** | Servicio: destacados, galería, proyectos de su categoría y preguntas frecuentes (con `FAQPage`), todo **si el `.md` lo trae**. Proyecto: ficha técnica con cliente, plazo, alcance y estado, y el `resumen` como subtítulo. Las dos cierran con la banda de contacto sobre la foto de la ficha. |
| **Cabecera y pie** | Menú móvil con logo y teléfono y correo. Pie con las dos sedes, Intranet y Proveedores (antes solo en el top-bar, que no existe en móvil). Canal Ético con la balanza y no un pin de mapa. |
| **Tokens** | `--fs-section` y `--fs-display-lg` sustituyen dos `clamp()` escritos dentro de componentes. El rótulo de sección va en naranja sobre oscuro. |
| **Sistema** | Nuevos, con demo en `/sistema/`: `.sh--row`, `.stat-band`, `.cta-band` con foto, `.prosa--ficha`, `.faq`, `Galeria`. |

### Decisiones

| Decisión | Por qué |
|---|---|
| Cifras del hero en **banda inferior** | Lo eligió la empresa. Libera ancho para el titular y quita el punto de corte intermedio de tablet. |
| La ficha de proyecto **no lleva monto** | Es un dato comercial que la empresa no publica. Los campos de `ficha` son texto libre, no cifras que se animen. |
| **Sin total "+94"** en el home | La suma por ciudad incluye proyectos antiguos y la regla 5 prohíbe cifras que el brochure no declare. La lista por ciudad sigue como estaba. |
| **Sin banda de cifras en "Quiénes somos"** | El hero ya muestra las cuatro cifras del brochure; repetirlas, o poner "4 normas ISO" sola, no aporta. |
| **No se borra** `[data-aos] { transition-duration: 240ms !important }` | Parecía un bug (pisa `--aos-duration`), pero es el tope de movimiento del sistema: dos duraciones honestas. Las `data-aos-duration` de 600 a 800 ms de las páginas son las que lo violan, no al revés. |
| La sección de **proyectos de la ficha es clara**, no oscura | La banda de cierre es oscura; dos oscuras seguidas borran la alternancia. Las tarjetas traen su propio velo. |
| Con foto, el **rótulo de la banda de cierre va en `--c-on-dark-2`**, no naranja | Se midió con las siete fotos que pueden ir de fondo: el naranja da entre 3.4 y 4.2:1 sobre el velo (AA pide 4.5). El texto de apoyo queda por encima de 6.9:1 con el píxel más claro de cualquiera de ellas. |
| El hero **reserva `--sp-l4` arriba** a partir de 768 px | Con ventanas de 720 px de alto el eyebrow quedaba 31 px metido bajo la cabecera. Ahora queda 29 px por debajo de ella. |
| No se añadieron `seoTitulo` ni `seoDescripcion` al esquema | La descripción de cada servicio con la frase de respaldo que quepa ya cae entre 120 y 155 caracteres. |
| Se retiraron las reglas `.nav a.active` | Nada pone esa clase: el estado activo es `aria-current`. |

### Commits

| Commit | Qué |
|---|---|
| `c605b5d` | Sistema de diseño: tokens de título y componentes nuevos, con su demo. |
| `4431245` | Contenido: campos opcionales en servicios y proyectos. |
| `1eccd7f` | Cabecera y pie: menú móvil, sedes y accesos internos. |
| `82c068a` | Fichas de servicio y de proyecto. |
| `a578782` | Home. |

### Pruebas hechas

- **Opcionales:** con los `.md` actuales las fichas salen completas. Con campos de prueba (revertidos) aparecen todas las secciones, alternan gris y blanco, la ficha técnica suma sus filas y el `FAQPage` sale en el JSON-LD.
- **Hero**, medido en el navegador: 1366×768, 1280×720, 1024×768, 800×1000 y 375×812. Sin desborde horizontal, el titular no se parte y las cuatro cifras caben en una línea. A 800 px "+150 km²" se partía en dos; se arregló en `.stat-band`.
- **Regla 1:** `grep` sobre el CSS construido sin ningún `[cid] > [cid]`.
- **No se ejecutó Lighthouse**: el LCP y el peso del póster en móvil están razonados por el `srcset`, no medidos.

## 2026-10-16 — Correcciones de la auditoría técnica

### Punto de partida

Auditoría local (`AUDITORIA.md`, excluido de git y retirado el 2026-10-31; lo que seguía
abierto está en *Pendientes abiertos*) con 69/100 y 37 hallazgos. El código es
sano; lo débil era lo que lo rodea: sin pruebas, un deploy que salía en verde con las
variables vacías, el Canal Ético oculto sin JavaScript y la privacidad sin publicar. Esta
sesión resuelve **lo que se arregla dentro del repositorio**; lo que depende de cuentas
externas o del abogado queda abajo como pendiente. Los códigos entre paréntesis son los IDs
de la auditoría.

### Decisiones

| Decisión | Por qué |
|---|---|
| El job `worker` de CI va **sin `needs`** | El Worker se despliega a mano. Un error de tipos o una prueba rota dejan el workflow en rojo sin impedir que se publique un cambio de contenido del sitio. |
| El humo posterior al deploy **avisa, no revierte** | Revertir por FTP desde Actions es más riesgo que el que evita. Para volver atrás sigue el artefacto `dist-<sha>`. |
| Acuse del Canal con tope por correo: **se calla, no se rechaza** (S-04) | Un reporte nunca se pierde por un límite pensado contra el abuso del acuse. Se guarda y se avisa a los responsables igual. |
| `SERVICIOS` copiado en el Worker, con **prueba de contrato** (B-04) | El Worker no ve las colecciones de Astro. `contrato.test.ts` lee `src/content/servicios/` y `canal-etico.astro` y falla si las listas se separan. |
| `noindex, follow` en `/mineria/` y no `canonical` (E-03) | No es un duplicado de `/servicios/mineria/` (otro texto, otros contactos): Google ignora un canonical entre páginas distintas. Los QR impresos siguen funcionando. **Reversible**: si se quiere posicionar la landing, se quita de `SECCIONES_PRIVADAS` y de su `robots`. |
| Se retiran `foundingDate` y `postalCode` del JSON-LD (E-06) | Ningún dato del repositorio los respalda y la regla 5 prohíbe cifras que el brochure no declare. Se agregan a `empresa.ts` cuando la empresa los confirme. |
| `--c-text-placeholder` **no se toca** (A-02) | Está por debajo de AA a propósito y el CSS lo justifica: el placeholder nunca lleva información y ningún campo real lo usa. |
| `#000` del `mask-image` del home se queda | En una máscara solo cuenta el alfa; no es un color de marca. Quedó comentado. |
| Sin correo de cumplimiento en el `<noscript>` del Canal (A-01) | Los correos de los responsables no van en el HTML público (`canal.ts`). Se avisa que hace falta JavaScript. |
| CSP **en modo informe**, con hashes (S-03) | Externalizar todos los scripts (`assetsInlineLimit: 0`) también saca los CSS pequeños a archivos aparte, con una petición bloqueante más en varias páginas: demasiado coste de rendimiento para una política que todavía no bloquea. |

### Commits

| Commit | Qué |
|---|---|
| `745ccff` | CI: exigir variables del formulario, comprobar Turnstile en `dist/`, humo posterior, job `worker`, acciones por SHA y Dependabot (D-01, S-05, D-05). |
| `d65c791` | Worker: Turnstile con tiempo límite y 503, tope de cuerpo de 32 KB, `ORIGENES` sin `localhost` (S-07, S-06). |
| `31315bc` | Worker: `nombre` sin enlaces, `servicio` validado, tope de acuses del Canal y las primeras pruebas del repositorio (S-04, B-04, T-01). |
| `951eab5` | Canal Ético visible sin JavaScript (A-01). |
| `787031e` | Envío compartido en `src/scripts/formulario.ts` (K-01). |
| `d6ca95e` | `inert` con el menú abierto, foco que entra al menú, mapa perezoso, colores del mapa desde tokens (A-03, R-02). |
| `9391bb3` | WhatsApp con mensaje y JSON-LD derivado de `CONTACTO` (C-02, E-06). |
| `1307f3f` | Títulos y descripciones; `/mineria/` fuera del índice (E-05, E-03). |
| `f008cb0` | Interruptor único `PRIVACIDAD_PUBLICADA` (L-01, preparación). |
| `79a647f` | `/sistema/` solo con `npm run dev` (K-02). |
| `6ad7b02` | Content-Security-Policy en modo informe (S-03). |

### Pruebas hechas

- **Worker:** `npm run check` y 34 pruebas (Vitest), también con `npm ci --ignore-scripts`, que es la instalación de CI.
- **Formularios, en el navegador, con `fetch` simulado:** éxito, 429, 502, 503 y corte de red en contacto y en Canal; la trampa y la validación no llaman a la red; el anónimo no manda nombre ni correo.
- **Menú móvil:** el fondo queda `inert`, el foco entra al botón de cerrar, la trampa de tabulación cierra el círculo y todo vuelve al cerrar con Escape o con el botón.
- **Mapa:** 0 peticiones del SVG al cargar y al estar arriba; 1 al acercarse; 28 elementos de pin y el naranja sale del token.
- **Privacidad:** con el flag en `false` ningún HTML enlaza `/privacidad/` y no está en el sitemap; con `true` (probado y revertido) el pie, `/contacto/` y los términos enlazan, entra al sitemap y se indexa.
- **CSP:** se sirvió `dist/` con la cabecera exacta del `.htaccess` y se recorrieron inicio, contacto (Turnstile y Maps), nosotros (YouTube), canal-etico y mineria: sin violaciones. Un control con un script y una imagen no permitidos sí quedó registrado.
- **SEO:** título ≤ 60 y descripción 120–155 en todas las páginas indexables (las dos fichas de proyecto generadas quedan en 117 y 118).

### Problemas encontrados

- **Había un `wrangler dev` de la sesión de formularios corriendo desde el día anterior** (puerto 8787, con un Zoho falso). Bloqueaba `workers/contacto/node_modules` y se detuvo para reinstalar. Las dependencias del Worker quedaron instaladas con `--ignore-scripts`: si `wrangler dev` se queja de un binario, `npm rebuild` en esa carpeta.
- **`focus()` sobre el botón de cerrar del menú móvil fallaba siempre**, ya antes de esta sesión: `visibility` se animaba desde `hidden` y el elemento no era enfocable en ese instante. Con `inert` además dejaba el foco en `body`. Se arregló en el CSS del menú (visible al abrir, se oculta al terminar el fundido).
- **Astro inlina los scripts pequeños** (los de `/canal-etico/` y `/mineria/`): su hash cambia con cada edición y la CSP los permite por hash.

### Lo que quedó fuera

Dentro del repositorio no quedó nada de la auditoría salvo el rediseño y el contenido; lo de
fuera está en *Pendientes abiertos*. Se decidió no tocar A-02 (placeholder) ni R-01 (doble
`Cache-Control` del proxy).

## 2026-10-15 — Alta en Google Search Console

### Punto de partida

`robots.txt` y el sitemap ya funcionaban en producción (200, `application/xml`, sin
bloqueos para Googlebot); no hizo falta tocar código.

### Hecho (fuera del repositorio)

- Propiedad de dominio `inacons.com.pe` verificada con un TXT agregado en el *Editor de
  zona* del cPanel. No se tocó el SPF ni ningún otro registro.
- Sitemap enviado con la URL completa; quedó en *Correcto*.
- Inspección de URLs: `/`, `/nosotros/`, `/proyectos/` y `/servicios/` ya estaban indexadas,
  con HTTPS y rutas de exploración válidas (las migas del JSON-LD).

### Problemas encontrados

- **«Dirección de sitemap no válida»** al enviar `sitemap-index.xml`: la propiedad de
  dominio no completa rutas relativas. Se resolvió con la URL completa.
- **«No se ha podido obtener»** justo después de enviarlo: era el primer rastreo pendiente,
  no un fallo del sitio. Pasó a *Correcto* solo.

## 2026-10-15 — Formularios de contacto y Canal Ético con receptor propio

### Punto de partida

- **`/contacto/`** no tenía endpoint en producción: al enviar, abría el programa de correo
  del visitante (`mailto:`). Quien usaba webmail o un móvil sin app de correo no veía nada,
  y no quedaba registro de ninguna consulta.
- **`/canal-etico/`** enlazaba seis formularios de `formularios-inacons.bitrix24.site` que
  daban 404. Hay QR impresos (`/R/CANAL_ETICO`) que llevan a esa página.

### Decisiones

| Decisión | Por qué |
|---|---|
| Receptor en un **Cloudflare Worker** (`workers/contacto/`) | El sitio es estático y no puede guardar una clave sin publicarla. El Worker es gratis, trae Turnstile y D1, y no ata los formularios al cPanel, que se mantiene solo porque está pagado. Se descartaron PHP en el hosting y los servicios de formularios de terceros. |
| Envío por **Zoho CPaaS** (ex ZeptoMail), no por el SMTP de Zoho Mail | Es una API HTTP que el Worker puede llamar, y es el mismo proveedor que el correo de la empresa. Firma con DKIM del dominio, así que pasa el DMARC `p=quarantine` existente. |
| **Canal Ético propio** en vez de Zoho Forms | Permite repartir cada tipo de reporte a sus responsables, mantener el diseño del sitio y Turnstile, y no publicar en el HTML los correos de los responsables (el reparto vive en `workers/contacto/src/canal.ts`). |
| Canal Ético **con nombre o anónimo**, en los seis tipos | Lo pidió la empresa. En anónimo no viaja ni se guarda nada que identifique a quien reporta, y cada reporte recibe un código `CE-XXXX-XXXX` para poder citarlo. |
| Anonimato también en la infraestructura | Primero el límite por conexión se llevaba en una tabla con hash de IP y hora. Se retiró en `3e78a2f` porque permitía cruzar un reporte anónimo con su conexión. Ahora el límite se cuenta en memoria (Rate Limiting de Cloudflare, 5 por minuto), la IP no se manda a Turnstile y el registro automático de cada petición está apagado. |
| El límite no puede ser bajo | En una oficina o una obra todos salen por la misma IP. Con 5 por hora, las propias pruebas lo agotaron: un trabajador podría quedar sin poder denunciar porque otros reportaron antes. |
| Retención | Las consultas comerciales se borran solas a los 12 meses (`RETENCION_MESES`). Los reportes del Canal Ético no se purgan: son registro de cumplimiento y su plazo lo decide quien los gestiona. |
| Acuse de contacto sin el mensaje (`3e78a2f`) | Va a la dirección que teclea el visitante: si repitiera el texto, serviría para escribirle a un tercero desde el dominio de INACONS. |

### Configurado fuera del repositorio

**Zoho CPaaS** (`cpaas.zoho.com`, entrando con `administracion@inacons.com.pe`)
- Organización *INACONS S.R.L.*, dominio `inacons.com.pe` verificado.
- Agent `web-contacto`: su clave API es el secret `CPAAS_TOKEN` del Worker.

**DNS** (Editor de zona del cPanel, `inacons.com.pe`): se **agregaron** solo dos registros.
No se tocaron MX, SPF, `_dmarc` ni `zoho._domainkey` de Zoho Mail.

| Nombre | Tipo | Valor |
|---|---|---|
| `15103649._domainkey` | TXT | clave DKIM de CPaaS (`k=rsa; p=…`) |
| `bounce-zem` | CNAME | `cluster89.zeptomail.com` |

**Cloudflare** (cuenta de `soporteinformatico.inacons@gmail.com`; el dominio **no** está en
Cloudflare y no debe moverse)
- Worker `inacons-contacto` → `https://inacons-contacto.inacons-contacto.workers.dev`
  (rutas `/` para contacto y `/canal` para el Canal Ético).
- Base D1 `inacons-contacto` (región ENAM), con las tablas `consultas` y `reportes`.
- Turnstile: widget *Formulario contacto*, para `home.inacons.com.pe` y `localhost`. Su
  clave secreta se rotó porque la original quedó visible en una captura.
- Secrets del Worker: `CPAAS_TOKEN`, `TURNSTILE_SECRET` e `IP_SALT`. Este último es un
  aleatorio generado al desplegar; no está anotado en ningún sitio ni hace falta.

**GitHub** → *Settings → Secrets and variables → Actions → **Variables** → Repository
variables*: `PUBLIC_CONTACT_ENDPOINT` y `PUBLIC_TURNSTILE_SITE_KEY`.

### Commits

| Commit | Qué |
|---|---|
| `e2bb019` | Worker de contacto, Turnstile en `/contacto/` y documentación de puesta en marcha. |
| `be48be5` | Canal Ético propio: formulario único con nombre o anónimo, ruta `/canal`, componente `.form-opcion` en el sistema de diseño y texto de privacidad actualizado. |
| `18e5ffc` | Tope del Canal Ético de 5 a 30 por hora por conexión. |
| `3e78a2f` | Límite en memoria en vez de tabla, sin logs por petición y acuse de contacto sin el mensaje. |

### Pruebas hechas

- **En local**, con un Zoho falso: validaciones, CORS, límite, escapado del HTML, reparto de
  los seis tipos y descarte de datos personales en los anónimos.
- **En producción:**
  - Contacto: la consulta n.° 1 llegó a `ventas@` con *Responder a* el visitante, y el
    acuse llegó a la bandeja principal de Gmail (no a spam).
  - Canal Ético: un reporte de cada tipo llegó a su responsable. Esos seis reportes de
    prueba se borraron después de la base.

### Problemas encontrados

- **La URL de la API no era la de ZeptoMail.** Es `https://cpaas.zoho.com/v1.1/email`, la que
  muestra el Agent en *SMTP/API*.
- **`wrangler login` falló la primera vez:** la autorización se aprobó en otro navegador.
  Hay que aprobarla en el navegador que abre wrangler, sin cerrar la terminal.
- **Dos deploys salieron sin endpoint:** las variables no estaban creadas como *Repository
  variables*. Se crearon ahí y se lanzó *Re-run all jobs*. Con `vars.*` vacías el build
  sale en verde igual, así que hay que mirar la página publicada.
- **`d1 execute --remote --file` dio *Authentication error* una vez;** al repetirlo funcionó.
