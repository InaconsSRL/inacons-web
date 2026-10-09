// @ts-check
import { defineConfig, envField, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Secciones fuera del sitemap. Se compara el PRIMER segmento de la ruta: una
// futura /proyectos/recursos-hidricos/ no debe caer aquí por contener la palabra.
//   sistema  → referencia interna; también va en public/robots.txt.
//   recursos → material interno con `noindex`. No va en robots.txt: una URL
//              bloqueada ahí no se rastrea y nadie llega a leer su noindex.
//   privacidad → borrador hasta que lo apruebe el abogado. Al aprobarlo se
//              quita de aquí y se pone BORRADOR = false en la página.
const SECCIONES_PRIVADAS = new Set(['sistema', 'recursos', 'privacidad']);

export default defineConfig({
  // Única fuente del dominio: canonical, sitemap, Open Graph y JSON-LD salen
  // de aquí. El dominio corto solo redirige la raíz, por eso no es este.
  site: 'https://home.inacons.com.pe',

  // Apache sirve /ruta/index.html y responde 301 a /ruta. Con 'always' el
  // servidor de desarrollo avisa de cualquier enlace interno sin barra final.
  trailingSlash: 'always',

  // Precarga la página de destino al pasar el cursor sobre un enlace interno.
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },

  // Montserrat se descarga en el build y se sirve desde /_astro/: el visitante
  // no conecta con Google (su IP no sale del sitio) y la fuente se cachea con
  // el resto de activos con hash.
  fonts: [{
    provider: fontProviders.google(),
    name: 'Montserrat',
    cssVariable: '--font-montserrat',
    weights: [400, 500, 600, 700, 800],
    styles: ['normal'],
    subsets: ['latin'],
    fallbacks: ['sans-serif'],
  }],

  // Variables validadas en el build y tipadas en `astro:env/client`.
  env: {
    schema: {
      // Destino del formulario de /contacto/ (POST, JSON). Vacía → mailto.
      PUBLIC_CONTACT_ENDPOINT: envField.string({ context: 'client', access: 'public', optional: true }),
      // Token de Cloudflare Web Analytics (sin cookies). Vacía → sin analítica.
      PUBLIC_ANALYTICS_TOKEN: envField.string({ context: 'client', access: 'public', optional: true }),
    },
  },

  integrations: [
    sitemap({
      filter: (page) => !SECCIONES_PRIVADAS.has(new URL(page).pathname.split('/')[1]),
    }),
  ],
});
