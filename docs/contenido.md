# Contenido

Proyectos, servicios y recursos son **content collections** de Astro. Los schemas están
en `src/content.config.ts`, validados con Zod: si el frontmatter no cumple, el build
falla con el campo exacto. No hay CMS — se editan los `.md` y se hace push.

Regla general: nada de esto se escribe a mano en el HTML de una página.

## Proyectos

`src/content/proyectos/<slug>.md`. El nombre del archivo es la URL: `mi-proyecto.md`
queda en `/proyectos/mi-proyecto/`.

```yaml
---
titulo: Habilitación urbana Pucusana        # requerido
ubicacion: Pucusana, Lima                   # requerido
categoria: Obras Civiles                    # requerido — enum, ver abajo
año: 2025                                   # requerido — número
imagen: /assets/imagenes/proyectos/foo.webp # requerido — ruta pública
destacado: true                             # opcional, default false
galeria:                                    # opcional
  - /assets/imagenes/proyectos/foo-2.webp
orden: 3                                    # opcional — menor va primero
---
```

`categoria` tiene que coincidir **exactamente** con uno de estos valores:
`Obras Civiles`, `Infraestructura`, `Electromecánica`, `Paisajismo`, `Minería`,
`Consultoría`.

`destacado: true` lo hace aparecer en la sección ⑤ del home. El grid se adapta a 1, 2 o
3 proyectos, y la sección entera **se oculta sola** si no hay ninguno destacado.

## Servicios

`src/content/servicios/<slug>.md` → `/servicios/<slug>/`. Hay 6 y alimentan la sección
③ del home.

```yaml
---
titulo: Obras civiles                       # requerido
descripcion: Texto corto para la tarjeta    # requerido
imagen: /assets/imagenes/image_obra_civiles.webp  # requerido
orden: 1                                    # opcional
especialidades:                             # opcional — lista en el detalle
  - Movimiento de tierras
  - Pavimentos
---
```

## Recursos

`src/content/recursos/<slug>.md`. Hub interno en `/recursos/`, **noindex**: no entra al
sitemap ni a `robots.txt`. Son materiales descargables para uso interno.

```yaml
---
titulo: Logo principal                      # requerido
categoria: logo                             # requerido — logo | flyer-impreso | flyer-digital | documento
imagen: /assets/recursos/logo.png           # requerido — archivo o preview
formato: SVG                                # opcional, default "PNG"
dimensiones: 1200x400                       # opcional
qr: https://…                               # opcional
orden: 1                                    # opcional
---
```

## Imágenes

- Formato **WebP**, calidad ~82 (squoosh.app o squoosh CLI).
- Objetivo de peso: < 200 KB para imágenes de sección, < 150 KB para la del hero.
- Siempre con `width` y `height` explícitos en el `<img>`, para no generar layout shift.
- Van en `public/assets/imagenes/` y se referencian por ruta pública absoluta
  (`/assets/imagenes/…`), no con import.

Hay imágenes que hoy exceden el objetivo — ver [performance.md](performance.md).

## Video

Comprimir con HandBrake: H.264, RF 32, sin pista de audio, "Optimizar para Web". El
video del hero pasó de 10.6 MB a 4.6 MB con esa receta.

## Documentos PDF

`public/assets/documentos/` — certificados ISO (9001, 14001, 45001, 37001), políticas
(SIG, antisoborno, alcohol y drogas, negativa a trabajo inseguro), alcance SIG y el
brochure. Se listan desde `src/pages/documentos.astro`.
