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
---
```

Un servicio nuevo aparece solo en el menú, el pie, el home, `/servicios/` y el selector
del formulario.

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
---
```

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

`/contacto/` envía a la URL de `PUBLIC_CONTACT_ENDPOINT` (variable de build). Sin ella,
abre el correo del visitante con el mensaje armado y le ofrece copiarlo; nunca declara
éxito sin confirmación.

**Contrato del endpoint** — lo que tiene que aceptar el sistema nuevo:

```http
POST <PUBLIC_CONTACT_ENDPOINT>
Content-Type: application/json

{
  "nombre": "…", "correo": "…", "telefono": "…", "empresa": "…",
  "servicio": "Obras Civiles", "mensaje": "…",
  "origen": "https://home.inacons.com.pe/contacto/"
}
```

Cualquier respuesta 2xx se muestra como enviado. Otra respuesta, o más de 10 s sin
respuesta, muestra el error y conserva lo escrito. El endpoint tiene que permitir CORS
desde `https://home.inacons.com.pe`. El campo trampa `company_url` se filtra en el
navegador y no se envía.

## Vídeo y PDF

- Vídeo: H.264, sin audio, "optimizar para web". `public/assets/videos/hero.mp4`.
- PDF: `public/assets/documentos/`. El brochure pesa 4,7 MB: conviene una versión para web.
