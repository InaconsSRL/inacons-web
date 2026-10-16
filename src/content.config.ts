import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { ICONOS, type NombreIcono } from './lib/iconos';

// `image()` hace que la ruta del frontmatter sea relativa al .md y la resuelve
// en el build: una foto que no existe rompe el build en vez de publicar un
// hueco, y la que existe sale optimizada, con srcset y dimensiones reales.

const nombreIcono = z.enum(Object.keys(ICONOS) as [NombreIcono, ...NombreIcono[]]);

// Las mismas seis categorías sirven a los dos lados: un proyecto se clasifica
// con ella y un servicio la nombra para listar "sus" proyectos sin una tabla a
// mano que mantener.
const categoriaProyecto = z.enum(['Obras Civiles', 'Infraestructura', 'Electromecánica', 'Paisajismo', 'Minería', 'Consultoría']);

// Todo lo de abajo que dice "opcional" lo es de verdad: una ficha sin esos
// campos se publica completa y la sección correspondiente no se emite. Nada de
// esto se inventa; entra cuando la empresa lo entrega.
const destacado = z.object({
  titulo:      z.string(),
  descripcion: z.string(),
  // Un icono que no está en el catálogo rompe el build en vez de pintar un hueco.
  icono:       nombreIcono.optional(),
});

const faq = z.object({
  pregunta:  z.string(),
  respuesta: z.string(),
});

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
    /** Con ella la ficha lista los proyectos de esa categoría. */
    categoria:      categoriaProyecto.optional(),
    /** Hasta cuatro razones para elegirlo ("Por qué INACONS"). */
    destacados:     z.array(destacado).max(4).optional(),
    faqs:           z.array(faq).optional(),
    galeria:        z.array(image()).optional(),
  }),
});

const proyectos = defineCollection({
  loader: glob({ pattern: '**/*.md', base: 'src/content/proyectos' }),
  schema: ({ image }) => z.object({
    titulo:    z.string(),
    ubicacion: z.string(),
    categoria: categoriaProyecto,
    año:       z.number(),
    imagen:    image(),
    galeria:   z.array(image()).optional(),
    destacado: z.boolean().default(false),
    orden:     z.number().optional(),
    /** Una frase para el hero de la ficha y la tarjeta. Sin ella el hero dice "Ubicación — año". */
    resumen:   z.string().optional(),
    /**
     * Datos de la ficha técnica, además de ubicación, categoría y año. Son texto
     * libre a propósito ("14 meses", "2024–2025"): no son cifras que se animen ni
     * se calculen. No hay monto: es un dato comercial que la empresa decidió no
     * publicar.
     */
    ficha: z.object({
      cliente: z.string().optional(),
      plazo:   z.string().optional(),
      alcance: z.string().optional(),
      estado:  z.enum(['En ejecución', 'Entregado']).optional(),
    }).optional(),
    destacados: z.array(destacado).max(4).optional(),
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
