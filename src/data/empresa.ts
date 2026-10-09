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

export const CONTACTO = {
  correoVentas: 'ventas@inacons.com.pe',
  correoGerencia: 'gerencia.proyectos@inacons.com.pe',
  telefono: { texto: '+51 064 654 736', href: 'tel:+5164654736' },
  whatsapp: { texto: '+51 948 888 070', href: 'https://wa.me/51948888070' },
  redes: {
    facebook: 'https://www.facebook.com/www.inacons.com.pe',
    linkedin: 'https://pe.linkedin.com/company/inacons',
  },
  intranet: 'https://kapo.com.pe',
  proveedores: 'https://kapo-proveedores-portal.vercel.app/proveedor/login',
  sedes: [
    { nombre: 'Oficina Principal — Lima', direccion: 'Av. Las Casuarinas 256', zona: 'Pucusana, Lima — Perú' },
    { nombre: 'Oficina Regional — Huancayo', direccion: 'Calle Casuarinas 106', zona: 'El Tambo, Huancayo — Perú' },
  ],
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
