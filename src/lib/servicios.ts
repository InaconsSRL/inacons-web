import { getCollection, type CollectionEntry } from 'astro:content';

export type Servicio = CollectionEntry<'servicios'>;

/** Servicios en el orden del menú: navegación, pie, home y formulario. */
export async function serviciosPorMenu(): Promise<Servicio[]> {
  return (await getCollection('servicios')).sort((a, b) => a.data.menu - b.data.menu);
}

/** Servicios en el orden de listado: /servicios/ y "otros servicios". */
export async function serviciosPorOrden(): Promise<Servicio[]> {
  return (await getCollection('servicios')).sort((a, b) => a.data.orden - b.data.orden);
}
