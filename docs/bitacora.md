# Bitácora

Qué se hizo, por qué y qué quedó pendiente, sesión por sesión. El cómo operar cada cosa
está en [deploy.md](deploy.md) y [contenido.md](contenido.md); aquí solo el contexto que
no se deduce del código.

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
