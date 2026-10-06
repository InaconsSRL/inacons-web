/**
 * iconos.ts
 * ─────────────────────────────────────────────────────────────
 * Catálogo de los símbolos que aparecen más de una vez en el sitio.
 *
 * Existe por algo medible: antes había 98 copias literales de 24 dibujos
 * repartidas por el repositorio. Cambiar el icono de descarga obligaba a
 * encontrar sus once copias, y la que se olvidara quedaba distinta sin que
 * nada fallara.
 *
 * Solo entra aquí lo que se repite. Un símbolo usado una sola vez sigue
 * escrito donde se usa: sacarlo de su sitio para dejarlo en una lista común
 * no ahorra nada y aleja el dibujo de donde se lee.
 *
 * `tipo` decide cómo se pinta, y no es decorativo:
 *   trazo   → contorno con `stroke`, `fill: none`   (la mayoría)
 *   relleno → silueta con `fill`, sin `stroke`      (whatsapp, facebook, linkedin, pausa, reproducir)
 * Pintar una silueta con contorno la deja invisible; al revés, queda una mancha.
 *
 * ── CUIDADO AL AGREGAR UNO ──────────────────────────────────────────────
 * Los cuatro escudos del sitio comparten el mismo contorno y se distinguen
 * solo por lo que llevan dentro: `escudo` va vacío, `escudo-check` lleva un
 * visto, `escudo-alerta` una exclamación y `escudo-aspa` una equis. Son
 * cuatro iconos, no uno con variantes, y confundirlos cambia el significado
 * de una página sin romper el build.
 *
 * Este archivo se genera a partir de los SVG que ya estaban en el repositorio:
 * ningún trazado se tecleó a mano.
 *
 * Uso: <Icono nombre="descarga" tam={14} /> — ver src/components/Icono.astro.
 */

export interface Icono {
  /** El interior del <svg>: los paths, rects y circles que dibujan el símbolo. */
  d: string;
  tipo: 'trazo' | 'relleno';
}

export const ICONOS = {
  // Algunas entradas aparecen una sola vez y están aquí a propósito: el icono
  // se elige a partir de un dato, así que tiene que poder nombrarse. Es el caso
  // de las normas ISO en /documentos/ (balanza) y del campo `icono` de cada
  // servicio en src/content/servicios/ (edificio, servidor, diamante, grafico).
  'balanza': {
    d: '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
    tipo: 'trazo',
  },
  'bombilla': {
    d: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
    tipo: 'trazo',
  },
  'cerrar': {
    d: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    tipo: 'trazo',
  },
  'chat': {
    d: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    tipo: 'trazo',
  },
  'chevron-abajo': {
    d: '<path d="m6 9 6 6 6-6"/>',
    tipo: 'trazo',
  },
  'compartir': {
    d: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="10.51" y2="6.49"/><line x1="8.59" x2="15.42" y1="13.49" y2="17.51"/>',
    tipo: 'trazo',
  },
  'correo': {
    d: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    tipo: 'trazo',
  },
  'descarga': {
    d: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="3" y2="15"/>',
    tipo: 'trazo',
  },
  'diamante': {
    d: '<path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/>',
    tipo: 'trazo',
  },
  'edificio': {
    d: '<path d="M3 21h18M9 21V7l3-4 3 4v14"/><path d="M15 11h3v10"/><path d="M3 11h5v10H3z"/>',
    tipo: 'trazo',
  },
  'enlace-externo': {
    d: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    tipo: 'trazo',
  },
  'enviar': {
    d: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    tipo: 'trazo',
  },
  'equipo': {
    d: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    tipo: 'trazo',
  },
  'escudo': {
    d: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    tipo: 'trazo',
  },
  'escudo-check': {
    d: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    tipo: 'trazo',
  },
  'facebook': {
    d: '<path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>',
    tipo: 'relleno',
  },
  'flecha-derecha': {
    d: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    tipo: 'trazo',
  },
  'grafico': {
    d: '<line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/>',
    tipo: 'trazo',
  },
  'hoja': {
    d: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
    tipo: 'trazo',
  },
  'linkedin': {
    d: '<path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>',
    tipo: 'relleno',
  },
  'pausa': {
    d: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
    tipo: 'relleno',
  },
  'premio': {
    d: '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>',
    tipo: 'trazo',
  },
  'rayo': {
    d: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
    tipo: 'trazo',
  },
  'reproducir': {
    d: '<polygon points="5 3 19 12 5 21 5 3"/>',
    tipo: 'relleno',
  },
  'servidor': {
    d: '<rect width="20" height="8" x="2" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/>',
    tipo: 'trazo',
  },
  'telefono': {
    d: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.5a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.64 2.84h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.09a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>',
    tipo: 'trazo',
  },
  'ubicacion': {
    d: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    tipo: 'trazo',
  },
  'whatsapp': {
    d: '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>',
    tipo: 'relleno',
  },
} as const satisfies Record<string, Icono>;

export type NombreIcono = keyof typeof ICONOS;
