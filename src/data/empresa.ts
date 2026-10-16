/**
 * empresa.ts
 * ─────────────────────────────────────────────────────────────
 * Datos de la empresa que aparecen en más de una página: contacto,
 * cifras corporativas y orden del menú. Un dato, un sitio.
 *
 * ── LAS CIFRAS SALEN DEL BROCHURE ───────────────────────────────
 * Fuente: public/assets/documentos/brochure_inacons.pdf (Brochure
 * Corporativo 2026, página "Dónde construimos"). Se copian tal cual:
 * valor, prefijo y rótulo. Si el brochure cambia, se cambia aquí y en
 * ningún otro sitio. No se agregan cifras que el brochure no declare
 * —antes el sitio decía 96, 150 y 40 en distintas páginas para cosas
 * que el brochure no afirma—.
 */

/**
 * Texto con que se abre el chat desde el botón de WhatsApp. Quien llega ya trae
 * el mensaje escrito (menos fricción) y ventas sabe que el contacto salió de la
 * web. Los números de personas concretas de /mineria/ no llevan texto.
 */
const MENSAJE_WHATSAPP = 'Hola INACONS, quiero cotizar un proyecto. Les escribo desde la web.';

/** Descripción corta de la empresa: meta description por defecto y JSON-LD. */
export const DESCRIPCION_EMPRESA =
  'Empresa peruana de ingeniería y construcción con más de 15 años de experiencia en obras civiles, infraestructura, electromecánica, minería y consultoría.';

export interface Sede {
  nombre: string;
  direccion: string;
  distrito: string;
  ciudad: string;
  /** Solo donde se haya confirmado; alimenta el JSON-LD. */
  coordenadas?: { lat: number; lng: number };
}

/** "Pucusana, Lima — Perú": cómo se escribe la zona de una sede en pantalla. */
export const zonaDeSede = (s: Pick<Sede, 'distrito' | 'ciudad'>) => `${s.distrito}, ${s.ciudad} — Perú`;

const SEDES: readonly Sede[] = [
  {
    nombre: 'Oficina Principal — Lima',
    direccion: 'Av. Las Casuarinas 256',
    distrito: 'Pucusana',
    ciudad: 'Lima',
    // Las mismas del mapa de /contacto/. Falta confirmarlas con el perfil de
    // Google Business de la empresa.
    coordenadas: { lat: -12.4762, lng: -76.7344 },
  },
  { nombre: 'Oficina Regional — Huancayo', direccion: 'Calle Casuarinas 106', distrito: 'El Tambo', ciudad: 'Huancayo' },
];

export const CONTACTO = {
  correoVentas: 'ventas@inacons.com.pe',
  correoGerencia: 'gerencia.proyectos@inacons.com.pe',
  telefono: { texto: '+51 064 654 736', href: 'tel:+5164654736' },
  whatsapp: { texto: '+51 948 888 070', href: `https://wa.me/51948888070?text=${encodeURIComponent(MENSAJE_WHATSAPP)}` },
  redes: {
    facebook: 'https://www.facebook.com/www.inacons.com.pe',
    linkedin: 'https://pe.linkedin.com/company/inacons',
  },
  intranet: 'https://kapo.com.pe',
  proveedores: 'https://kapo-proveedores-portal.vercel.app/proveedor/login',
  sedes: SEDES,
} as const;

export const BROCHURE = '/assets/documentos/brochure_inacons.pdf';

export interface Cifra {
  valor: number;
  prefijo?: string;
  sufijo?: string;
  rotulo: string;
}

/** Las cuatro cifras de escala del brochure, en su orden. */
export const CIFRAS: Record<'experiencia' | 'inversion' | 'trabajadores' | 'superficie', Cifra> = {
  experiencia:  { valor: 15,  prefijo: '+', rotulo: 'Años de experiencia' },
  inversion:    { valor: 100, prefijo: '+', sufijo: 'MM', rotulo: 'De soles en proyectos' },
  trabajadores: { valor: 200, prefijo: '+', rotulo: 'Trabajadores por obra' },
  superficie:   { valor: 150, prefijo: '+', sufijo: ' km²', rotulo: 'Construidos' },
};

/** Normas ISO certificadas. El brochure dice "las cuatro normas ISO". */
export const NORMAS_ISO: Cifra = { valor: 4, rotulo: 'Normas ISO certificadas' };

/**
 * Proyectos por ciudad, en el orden en que se listan en el home.
 * `idMapa` es el id del departamento dentro de public/assets/imagenes/peru-depts.svg
 * —lo usa initCoverageMap() para el pin— y `peso` la intensidad del relleno.
 */
export const PROYECTOS_POR_CIUDAD = [
  { ciudad: 'Huancayo',     proyectos: 50, idMapa: 'Junín',             peso: 4 },
  { ciudad: 'Lima',         proyectos: 25, idMapa: 'path2641',          peso: 3 },
  { ciudad: 'Ica',          proyectos: 5,  idMapa: 'Ica',               peso: 2 },
  { ciudad: 'Huancavelica', proyectos: 5,  idMapa: 'Huancavelica',      peso: 2 },
  { ciudad: 'Pasco',        proyectos: 4,  idMapa: 'Pasco',             peso: 2 },
  { ciudad: 'Piura',        proyectos: 3,  idMapa: 'Piura',             peso: 1 },
  { ciudad: 'Trujillo',     proyectos: 2,  idMapa: 'La_x0020_Libertad', peso: 1 },
] as const;
