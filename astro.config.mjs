// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // El sitio se sirve desde home.inacons.com.pe. El dominio corto solo
  // redirige la raiz: /servicios, /nosotros y el resto dan 404 ahi, asi que
  // declararlo como site llenaba el sitemap y los canonical de URLs muertas.
  // Este valor es la unica fuente del dominio: nada mas lo escribe a mano.
  site: 'https://home.inacons.com.pe',
  integrations: [
    sitemap({
      // /recursos, /formulario y /expomina son internos o de campaña (noindex)
      // — no deben aparecer en el sitemap público.
      filter: (page) => !/\/(recursos|formulario|expomina)\/?/i.test(page),
    }),
  ],
});
