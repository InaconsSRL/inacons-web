/**
 * Identificador de la empresa en el JSON-LD. Lo declara BaseLayout una vez por
 * página y los demás nodos (WebSite, el Service de cada ficha) lo citan con
 * { "@id": ID_ORGANIZACION } en vez de repetir nombre, dirección y teléfono.
 */
export const ID_ORGANIZACION = new URL('/#organizacion', import.meta.env.SITE).href;
