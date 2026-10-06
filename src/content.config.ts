import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { ICONOS, type NombreIcono } from './lib/iconos';

// `image()` hace que la ruta del frontmatter sea relativa al .md y la resuelve
// en el build: una foto que no existe rompe el build en vez de publicar un
// hueco, y la que existe sale optimizada, con srcset y dimensiones reales.

const nombreIcono = z.enum(Object.keys(ICONOS) as [NombreIcono, ...NombreIcono[]]);

const servicios = defineCollection({
  loader: glob({ pattern: '**/*.md', base: 'src/content/servicios' }),
  schema: ({ image }) => z.object({
    titulo:         z.string(),
    descripcion:    z.string(),
    /** Frase corta para la tarjeta del home. */
    resumen:        z.string(),
    imagen:         image(),
    icono:          nombreIcono,
    /** Orden en /servicios/ y en "otros servicios". */
    orden:          z.number(),
    /**
     * Orden en el menú, el pie, el home y el formulario de contacto. Es una
     * decisión de presentación distinta de `orden`: que no coincidan es a
     * propósito, no un descuido que haya que igualar.
     */
    menu:           z.number(),
    especialidades: z.array(z.string()).optional(),
  }),
});

const proyectos = defineCollection({
  loader: glob({ pattern: '**/*.md', base: 'src/content/proyectos' }),
  schema: ({ image }) => z.object({
    titulo:    z.string(),
    ubicacion: z.string(),
    categoria: z.enum(['Obras Civiles', 'Infraestructura', 'Electromecánica', 'Paisajismo', 'Minería', 'Consultoría']),
    año:       z.number(),
    imagen:    image(),
    galeria:   z.array(image()).optional(),
    destacado: z.boolean().default(false),
    orden:     z.number().optional(),
  }),
});

const recursos = defineCollection({
  loader: glob({ pattern: '**/*.md', base: 'src/content/recursos' }),
  schema: z.object({
    titulo:      z.string(),
    categoria:   z.enum(['logo', 'flyer-impreso', 'flyer-digital', 'documento']),
    /** Archivo descargable en public/ (p. ej. /assets/recursos/…). Se sirve tal cual, sin optimizar. */
    archivo:     z.string().startsWith('/'),
    formato:     z.string().default('PNG'),
    dimensiones: z.string().optional(),
    orden:       z.number().optional(),
  }),
});

const certificaciones = defineCollection({
  loader: glob({ pattern: '**/*.md', base: 'src/content/certificaciones' }),
  schema: z.object({
    norma:       z.string(),            // ISO 9001
    titulo:      z.string(),            // que gestiona la norma
    organismo:   z.string(),            // quien certifica
    certificado: z.string(),            // el mismo PDF que enlaza /documentos/
    orden:       z.number().optional(),

    // Tres longitudes del mismo nombre. No es redundancia: el diseno las usa en
    // tres sitios y ninguna cabe en el lugar de la otra.
    //
    //   etiqueta   -> franja de /documentos/        "Calidad"
    //   titulo     -> debajo del sello              "Gestion de la Calidad"
    //   encabezado -> h3 de la tarjeta              "Sistema de Gestion de Calidad"
    //
    // Opcionales a proposito: una norma nueva entra con lo minimo y se pinta
    // cayendo a `titulo`, en vez de romper el build por una copia que todavia
    // nadie escribio.
    etiqueta:    z.string().optional(),
    encabezado:  z.string().optional(),
    descripcion: z.string().optional(),

    // Estos dos son la puerta: sin `sello` la norma no se pinta en ningun
    // sitio. El sello es marca del organismo certificador y solo entra si el
    // organismo lo autoriza, asi que ausente es el estado por defecto y no un
    // error. Opcionales y no nullable a proposito: z.coerce.date() convierte
    // null en 1970-01-01 sin quejarse, y una vigencia falsa es peor que ninguna.
    sello:       z.string().optional(),
    vigencia:    z.coerce.date().optional(),
  }),
});

export const collections = { servicios, proyectos, recursos, certificaciones };
