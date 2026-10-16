# Contenido

Servicios, proyectos, recursos y certificaciones son **content collections**. Los schemas
están en `src/content.config.ts`: si el frontmatter no cumple, el build falla con el campo
exacto. No hay CMS — se edita el `.md` y se hace push.

Nada de esto se escribe a mano en el HTML de una página (regla 3 de CLAUDE.md).

## Imágenes de contenido

Las fotos van en `src/assets/imagenes/` y el `.md` las referencia con **ruta relativa al
propio archivo**:

```yaml
imagen: ../../assets/imagenes/image_obra_civiles.webp
```

Astro comprueba en el build que el archivo exista y genera las variantes (WebP, varios
anchos, `width`/`height` reales). No hace falta redimensionar a mano: basta subir una foto
de buena calidad, idealmente de 1920 px de ancho como máximo.

## Servicios

`src/content/servicios/<slug>.md` → `/servicios/<slug>/`.

```yaml
---
titulo: Obras Civiles
descripcion: Texto del hero y de la tarjeta en /servicios/
resumen: Frase corta para la tarjeta del home
imagen: ../../assets/imagenes/image_obra_civiles.webp
icono: edificio          # nombre del catálogo de src/lib/iconos.ts
orden: 1                 # orden en /servicios/ y en "otros servicios"
menu: 1                  # orden en el menú, el pie, el home y el formulario
especialidades:          # opcional
  - Movimiento de tierras
categoria: Obras Civiles # opcional: la ficha lista los proyectos de esa categoría
destacados:              # opcional, hasta 4: "Por qué INACONS"
  - titulo: Maquinaria propia
    descripcion: Una frase.
    icono: escudo        # opcional, del catálogo de iconos
faqs:                    # opcional: preguntas frecuentes
  - pregunta: ¿Trabajan fuera de Lima?
    respuesta: Sí.
galeria:                 # opcional
  - ../../assets/imagenes/algo.webp
---
```

Un servicio nuevo aparece solo en el menú, el pie, el home, `/servicios/` y el selector
del formulario.

Todo lo marcado *opcional* lo es de verdad: sin esos campos la ficha se publica completa y
la sección correspondiente no se emite. No se inventa contenido para llenarlos; entran
cuando la empresa los entrega. Un `icono` que no exista en el catálogo rompe el build.

## Proyectos

`src/content/proyectos/<slug>.md` → `/proyectos/<slug>/`.

```yaml
---
titulo: Habilitación Urbana Pucusana
ubicacion: Pucusana, Lima
categoria: Obras Civiles     # Obras Civiles | Infraestructura | Electromecánica | Paisajismo | Minería | Consultoría
año: 2023
imagen: ../../assets/imagenes/proyectos/pucusana.webp
galeria:                     # opcional
  - ../../assets/imagenes/proyectos/pucusana-2.webp
destacado: true              # aparece en el home (máximo 3)
orden: 1                     # opcional
resumen: Una frase            # opcional: hero de la ficha y descripción de la tarjeta
ficha:                       # opcional: se suma a ubicación, categoría y año
  cliente: Nombre
  plazo: 14 meses            # texto libre
  alcance: Una línea
  estado: Entregado          # En ejecución | Entregado
destacados:                  # opcional, hasta 4
  - titulo: Sin accidentes
    descripcion: Una frase.
---
```

La ficha técnica **no lleva monto de inversión**: es un dato comercial que la empresa no
publica. Los campos de `ficha` son texto libre, no cifras.

## Recursos

`src/content/recursos/<slug>.md`. Material interno de `/recursos/` (`noindex`).

```yaml
---
titulo: Logo INACONS — Principal
categoria: logo              # logo | flyer-impreso | flyer-digital | documento
archivo: /assets/imagenes/logos/logo_inacons.svg   # archivo en public/, se descarga tal cual
formato: SVG
dimensiones: 2480×3508px     # opcional
orden: 10
---
Descripción corta.
```

## Certificaciones

`src/content/certificaciones/<norma>.md`. Alimentan `/documentos/` y los sellos de
`/nosotros/`. Los campos y por qué cada uno es opcional u obligatorio están comentados en
`src/content.config.ts`.

## Cifras corporativas

Están en `src/data/empresa.ts` y se copian **tal cual del brochure**
(`public/assets/documentos/brochure_inacons.pdf`). Si el brochure cambia, se cambian ahí y
en ningún otro sitio.

## Formulario de contacto

`/contacto/` envía a la URL de `PUBLIC_CONTACT_ENDPOINT` (variable de build), que es el
Worker de `workers/contacto/`. Sin ella, abre el correo del visitante con el mensaje
armado y le ofrece copiarlo; nunca declara éxito sin confirmación.

El Worker comprueba Turnstile, limita a 3 envíos por hora por conexión o por correo,
guarda una copia en D1, avisa a `ventas@` por Zoho CPaaS con *Reply-To* al visitante y le
manda un acuse de recibo. El acuse no repite el mensaje: va a la dirección que teclea el
visitante, y con el texto dentro serviría para escribirle a un tercero desde el dominio. Las copias se borran solas a los 12 meses (`RETENCION_MESES`).

**Contrato del endpoint** — lo que acepta el Worker, y lo que tendría que aceptar
cualquier reemplazo:

```http
POST <PUBLIC_CONTACT_ENDPOINT>
Content-Type: application/json

{
  "nombre": "…", "correo": "…", "telefono": "…", "empresa": "…",
  "servicio": "Obras Civiles", "mensaje": "…",
  "origen": "https://home.inacons.com.pe/contacto/",
  "turnstile": "<token del widget>"
}
```

Cualquier respuesta 2xx se muestra como enviado; el Worker solo la da cuando CPaaS aceptó
el aviso a ventas. Un 429 se explica como límite por hora. Cualquier otra respuesta, o
más de 10 s sin respuesta, muestra el error y conserva lo escrito. El endpoint tiene que
permitir CORS desde `https://home.inacons.com.pe`. El campo trampa `company_url` se
filtra en el navegador y no se envía.

Respuestas de error que el Worker da a propósito: **400** datos inválidos o cuerpo que no
es un objeto JSON; **403** origen no permitido o token de Turnstile inválido; **413** cuerpo
mayor de 32 KB; **415** `Content-Type` distinto de `application/json`; **429** límite por
hora; **503** Cloudflare no respondió a Turnstile en 5 s (reintentar, no es culpa de quien
escribe). Todas salen con CORS, para que el navegador las lea como respuesta y no como
fallo de red.

Reglas de validación del Worker, además de los límites de longitud: `nombre` no puede
llevar `://`, `www.`, `@` ni saltos de línea (el acuse lo repite en el saludo), y
`servicio` tiene que ser uno de los títulos de `src/content/servicios/` o `Otro`. Esa lista
vive copiada en `SERVICIOS` de `workers/contacto/src/contacto.ts`: al crear, renombrar o
borrar un servicio hay que cambiarla también, y `npm test` en `workers/contacto/` avisa
si se olvidó.

Turnstile solo se carga si están definidas `PUBLIC_CONTACT_ENDPOINT` y
`PUBLIC_TURNSTILE_SITE_KEY`. Con el modo `mailto` no hay nada que proteger.

## Canal Ético

`/canal-etico/` envía al mismo Worker, en la ruta `/canal`. El formulario es un asistente de
**tres pasos que ocupan el mismo lugar**, sin crecer hacia abajo: 1) términos y condiciones
con su casilla, 2) tipo de reporte (seis opciones) y modalidad, 3) los datos y el relato. Cada
paso se valida antes de dejarlo, "Atrás" conserva lo elegido, y al enviar bien se vuelve al
primero con los términos sin aceptar. Es un solo `<form>` con tres paneles, así que el envío y
su contrato no cambian; sin JavaScript se ven los tres apilados y se avisa que enviar
necesita JavaScript. La casilla de términos no lleva `name`: no viaja al Worker. El widget de
Turnstile se pinta a mano al entrar al paso 3 (`render=explicit`), porque dentro de un panel
oculto mediría cero de ancho. Se puede reportar **con nombre** (nombre y
correo obligatorios, y recibe acuse) o **de forma anónima** (el navegador no manda nombre,
correo ni teléfono, y el Worker los descarta si llegan).

A quién llega cada tipo está en `TIPOS` de `workers/contacto/src/canal.ts`, no en el
sitio, para que esos correos no queden en el HTML público. Cambiar un responsable es
editar ahí y `npx wrangler deploy`; la web no se toca.

| `tipo` | Llega a |
|---|---|
| `consulta` | ventas@ |
| `denuncia`, `queja` | oficialdecumplimiento@ |
| `sugerencia` | sig@ |
| `buenas-practicas`, `acto-subestandar` | tbalbin@ |

```http
POST <PUBLIC_CONTACT_ENDPOINT>/canal
Content-Type: application/json

{
  "tipo": "denuncia", "modalidad": "nombre",
  "nombre": "…", "correo": "…", "telefono": "…",
  "relacion": "Colaborador", "fecha": "2026-10-01",
  "lugar": "…", "personas": "…", "descripcion": "…",
  "origen": "https://home.inacons.com.pe/canal-etico/",
  "turnstile": "<token del widget>"
}
```

Responde `{ "ok": true, "codigo": "CE-XXXX-XXXX" }` y la página muestra el código: en un
reporte anónimo es la única forma de volver a referirse a él. El asunto del aviso lleva
tipo y código, nunca el nombre. Los reportes se guardan en la tabla `reportes` de D1 y no
se purgan solos; ni la fila ni ninguna otra tabla guardan la IP o su hash: el límite de 5 envíos
por minuto por conexión se cuenta en memoria (Rate Limiting de Cloudflare) y la IP no se manda a
Turnstile. En `"modalidad": "anonimo"` no van `nombre`, `correo`
ni `telefono`; `relacion`, `fecha`, `lugar` y `personas` son opcionales.

Con nombre, `nombre` sigue la misma regla que en contacto (sin enlaces, arrobas ni saltos
de línea), y el acuse de recibo sale como máximo 3 veces por hora y por correo. Pasado el
tope el reporte **se guarda y se avisa a los responsables igual**: solo se omite el acuse.
Los `tipo` válidos son las claves de `TIPOS` en `canal.ts` y tienen que coincidir con
`CANALES` de `canal-etico.astro`; `npm test` lo comprueba.

## Vídeo y PDF

- Vídeo: H.264, sin audio, "optimizar para web". `public/assets/videos/hero.mp4`.
- PDF: `public/assets/documentos/`. El brochure pesa 4,7 MB: conviene una versión para web.
