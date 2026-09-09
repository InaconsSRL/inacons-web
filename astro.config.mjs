// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://inacons.com.pe',
  integrations: [
    sitemap({
      // /recursos, /formulario y /expomina son internos o de campaña (noindex)
      // — no deben aparecer en el sitemap público.
      filter: (page) => !/\/(recursos|formulario|expomina)\/?/i.test(page),
    }),
  ],
});
