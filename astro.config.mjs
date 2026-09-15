// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Secciones que no deben aparecer en el sitemap: internas, de administracion o
// de campana terminada. Mantener en paralelo con public/robots.txt — una ruta
// nueva que no deba indexarse va en los dos sitios.
const SECCIONES_PRIVADAS = new Set([
  'panel',
  'sistema',
  'empresa',
  'recursos',
  'formulario',
  'expomina',
]);

// https://astro.build/config
export default defineConfig({
  // El sitio se sirve desde home.inacons.com.pe. El dominio corto solo
  // redirige la raiz: /servicios, /nosotros y el resto dan 404 ahi, asi que
  // declararlo como site llenaba el sitemap y los canonical de URLs muertas.
  // Este valor es la unica fuente del dominio: nada mas lo escribe a mano.
  site: 'https://home.inacons.com.pe',
  integrations: [
    sitemap({
      // Se compara el PRIMER segmento de la ruta, no la URL entera. La version
      // anterior buscaba la palabra en cualquier posicion, asi que una futura
      // /proyectos/recursos-hidricos/ habria quedado fuera del sitemap sin que
      // nadie lo notara: no hay error, solo una pagina que Google no encuentra.
      filter: (page) => !SECCIONES_PRIVADAS.has(new URL(page).pathname.split('/')[1]),
    }),
  ],
});
