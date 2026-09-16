import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const servicios = defineCollection({
  loader: glob({ pattern: '**/*.md', base: 'src/content/servicios' }),
  schema: z.object({
    titulo:         z.string(),
    descripcion:    z.string(),
    imagen:         z.string(),
    orden:          z.number().optional(),
    especialidades: z.array(z.string()).optional(),
  }),
});

const proyectos = defineCollection({
  loader: glob({ pattern: '**/*.md', base: 'src/content/proyectos' }),
  schema: z.object({
    titulo:    z.string(),
    ubicacion: z.string(),
    categoria: z.enum(['Obras Civiles', 'Infraestructura', 'Electromecánica', 'Paisajismo', 'Minería', 'Consultoría']),
    año:       z.number(),
    imagen:    z.string(),               // foto principal
    galeria:   z.array(z.string()).optional(), // fotos adicionales
    destacado: z.boolean().default(false),    // ¿aparece en el home?
    orden:     z.number().optional(),
  }),
});

const recursos = defineCollection({
  loader: glob({ pattern: '**/*.md', base: 'src/content/recursos' }),
  schema: z.object({
    titulo:      z.string(),
    categoria:   z.enum(['logo', 'flyer-impreso', 'flyer-digital', 'documento']),
    imagen:      z.string(),                  // URL pública del archivo o preview (p. ej. /assets/recursos/…)
    formato:     z.string().default('PNG'),
    dimensiones: z.string().optional(),
    qr:          z.string().optional(),
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