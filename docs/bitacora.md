# Bitácora

Qué se hizo, por qué y qué quedó pendiente, sesión por sesión. El cómo operar cada cosa
está en [deploy.md](deploy.md) y [contenido.md](contenido.md); aquí solo el contexto que
no se deduce del código.

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

### Pendiente

- [ ] **Contenido para llenar las secciones nuevas.** Las fichas no inventan nada: cuando la empresa entregue `destacados`, `faqs`, `ficha` (cliente, plazo, alcance, estado) y `resumen`, se agregan al `.md`. Hoy esas secciones no se ven.
- [ ] **Fotos de obra reales** para las galerías. Las dos fichas reutilizan fotos genéricas del sitio.
- [ ] **Medir** con Lighthouse en móvil las cinco páginas clave, sobre todo el LCP del home.
- [ ] La banda de cierre con foto solo se usa en las fichas; las demás páginas (nosotros, sostenibilidad, documentos) siguen con la banda lisa.

## 2026-10-16 — Correcciones de la auditoría técnica

### Punto de partida

Auditoría local (`AUDITORIA.md`, excluido de git) con 69/100 y 37 hallazgos. El código es
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

### Pendiente

Dentro del repositorio ya no queda nada de la auditoría salvo el rediseño y el contenido. **Fuera:**

- [ ] **Desplegar el Worker** (`npx wrangler deploy` en `workers/contacto/`): sus cambios no están en producción hasta entonces. Después, un `OPTIONS` al Worker con `Origin: http://localhost:4321` debe dar 403.
- [ ] **E-01 (la más urgente):** `inacons.com.pe` y `www` dan 404 en toda ruta menos `/`. Falta un 301 que conserve la ruta en el `.htaccess` del docroot del dominio raíz (no está en este repositorio).
- [ ] **S-02:** segundo administrador corporativo y 2FA en Cloudflare, Zoho, GitHub y cPanel.
- [ ] **D-03:** monitor externo gratuito sobre `/` y `/contacto/`, y alerta si hay consultas con `estado = 'error'`.
- [ ] **S-01:** FTPS o SFTP con el proveedor, o servir el sitio estático desde otro hosting.
- [ ] **Turnstile:** quitar `localhost` de los dominios del widget.
- [ ] **Cumplimiento y abogado:** plazo de conservación de los reportes (B-01), destinatarios por rol y suplentes (B-02), términos del Canal (L-02), transferencia de datos fuera del Perú (L-04), cierre de la política y luego `PRIVACIDAD_PUBLICADA = true`.
- [ ] **Mapa de Google sin consentimiento previo (L-03)** y **respaldo de D1 (B-03)**: no se tocaron.
- [ ] **Confirmar con la empresa** año de fundación, código postal y coordenadas (hoy no están en el JSON-LD, salvo las coordenadas del mapa).
- [ ] **CSP a bloqueo:** dos semanas con la consola sin violaciones (ver `docs/deploy.md`).
- [ ] **Contenido (E-02):** ampliar los servicios y publicar más fichas de proyecto.

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

### Pendiente

- [ ] **Agregar un segundo propietario** en *Configuración → Usuarios y permisos*, para que
      el acceso no dependa de una sola cuenta de Google.
- [ ] En 3 a 7 días, revisar *Páginas* y confirmar que las 17 URLs del sitemap están
      indexadas y que *Páginas descubiertas* dejó de estar en 0.
- [ ] En 1 a 2 semanas, mirar *Rendimiento* (consultas, clics, impresiones).

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

### Pendiente

- [ ] **Avisar a los responsables** que estos códigos fueron pruebas: `CE-KMNV-6GUR` (ventas@),
      `CE-5SLA-9HZN` y `CE-TYJ8-WG85` (oficialdecumplimiento@), `CE-KTK2-7FAK` (sig@),
      `CE-KUSZ-6Q6S` y `CE-R22C-ED62` (tbalbin@).
- [ ] **Política de privacidad** (borrador, la revisa el abogado): nombrar a Cloudflare y a
      Zoho como proveedores, y el plazo de 12 meses de las consultas.
- [ ] **Plazo de conservación de los reportes** del Canal Ético: lo define cumplimiento.
- [ ] **Agregar `administracion@inacons.com.pe` como miembro** de la cuenta de Cloudflare,
      para que el acceso no dependa solo del Gmail de soporte.
- [ ] Decidir si se borra la consulta de prueba n.° 1 de `consultas`.
- [ ] Opcional: adjuntar fotos en el Canal Ético. Requiere almacenamiento (R2) y revisar qué
      metadatos traen las fotos antes de aceptarlas en reportes anónimos.
