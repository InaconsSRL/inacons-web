/**
 * Generación de códigos QR. Única fuente del repositorio.
 *
 * Ningún otro archivo instancia una librería de QR. Se verifica con:
 *   grep -rn "from 'qrcode'" src/ --include=*.ts --include=*.astro
 * y tiene que devolver solo este archivo.
 *
 * La regla existe porque ya se rompió tres veces. `admin.php` razonó bien los
 * parámetros y se los quedó para sí; `/recursos/` no heredó nada y descarga el
 * preview de 220 px escalado; y el QR de Expomina se hizo con una herramienta
 * externa que no dejó fuente, así que hoy nadie puede regenerarlo igual.
 */
import QRCode from 'qrcode';

/**
 * Versión del módulo. Se guarda junto a cada QR generado, en
 * `qr_codes.version_modulo_qr`.
 *
 * Sirve para una pregunta concreta que aparece cuando algo no escanea: "este
 * código impreso hace ocho meses, ¿con qué reglas se produjo?". Sin esto la
 * respuesta es una conjetura. Subirla cuando cambie el color, el ECC, la zona
 * de silencio o el modo de codificación — no por arreglos que no alteren el
 * símbolo.
 */
export const VERSION_MODULO = '1.0.0';

export type PerfilQR = 'pantalla' | 'impresion';

/**
 * Los dos perfiles, portados de `admin.php` sin cambios.
 *
 * El azul recorta margen de lectura respecto del negro puro, y por eso lleva
 * ECC H, que agrega ~30% de módulos redundantes. En pantalla no hay suciedad
 * ni desgaste contra los que proteger, así que negro puro con ECC M basta y da
 * un símbolo bastante menos denso.
 *
 * El color de impresión NO sale de un token del sistema de diseño, y es a
 * propósito: no es un color de interfaz sino un parámetro de legibilidad
 * mecánica. `--c-secondary` (#1b5278) es más claro y recorta todavía más el
 * margen del escáner. Si alguna vez hay que tocarlo, se decide midiendo
 * lecturas, no mirando la paleta.
 */
export const PERFILES: Record<PerfilQR, {
  color: string;
  ecc: 'M' | 'H';
  titulo: string;
  consejo: string;
}> = {
  pantalla: {
    color: '#000000',
    ecc: 'M',
    titulo: 'Pantalla / video',
    consejo:
      'Negro puro y ECC M: la máxima legibilidad tras la compresión de video. ' +
      'Colócalo sobre fondo blanco sólido, sin nada en movimiento detrás, y ' +
      'déjalo fijo al menos 8 segundos.',
  },
  impresion: {
    color: '#1a3a5c',
    ecc: 'H',
    titulo: 'Impresión',
    consejo:
      'Azul corporativo y ECC H: tolera manchas y desgaste del papel. ' +
      'No lo uses para video.',
  },
};

/**
 * Zona de silencio, en módulos. No negociable.
 *
 * Es el marco blanco alrededor del símbolo. Sin él, el escáner no encuentra
 * dónde termina el código y el fallo se ve como "el QR no sirve" cuando el
 * problema está en el diseño que lo rodea.
 */
const ZONA_SILENCIO = 4;

// `import.meta.env` solo existe dentro de Vite. El encadenamiento opcional deja
// que este modulo tambien corra en Node suelto, que es como se prueba.
const DOMINIO = import.meta.env?.SITE ?? 'https://home.inacons.com.pe';

/**
 * URL corta de un código, lista para codificar.
 *
 * En MAYÚSCULAS, y no por estética. El modo alfanumérico del estándar QR solo
 * admite `0-9 A-Z espacio $ % * + - . / :`; con una sola minúscula el
 * codificador cae a modo byte, que gasta 8 bits por carácter en vez de 5,5.
 *
 * Medido sobre `/r/A7F3K` con este mismo módulo:
 *
 *            minúsculas        MAYÚSCULAS
 *   ECC M    29x29 (v3)        25x25 (v2)
 *   ECC H    37x37 (v5)        29x29 (v3)
 *
 * En ECC H son 22% menos módulos por lado. A igual tamaño impreso, cada módulo
 * es más grande, y el tamaño del módulo es lo que decide si un teléfono lo lee
 * de lejos o hay que acercarse.
 *
 * El esquema y el host son insensibles a mayúsculas por estándar. El path lo
 * hacemos insensible en el redirector: `resolver_qr()` aplica upper() al
 * código antes de buscarlo.
 */
export function urlDeCodigo(codigo: string): string {
  return `${DOMINIO}/r/${codigo}`.toUpperCase();
}

/* ── Logo al centro ─────────────────────────────────────────────────────────
 *
 * Funciona por una sola razon: el estandar QR guarda informacion redundante
 * para sobrevivir a la suciedad y el desgaste. Tapar el centro consume parte
 * de ese margen; no lo crea. Cuanto mas grande el logo, menos tolerancia le
 * queda al codigo para lo que venga despues -- un doblez, un reflejo, tinta
 * corrida.
 *
 * Por eso solo se permite con ECC H, que reserva ~30% de redundancia. Con ECC
 * M (~15%) un logo deja el simbolo sin margen util: escanea en el monitor,
 * donde nadie lo prueba, y falla sobre papel.
 *
 * La geometria del logo va escrita aqui y no se lee de /favicon.svg. Tiene que
 * ser asi: el SVG resultante se convierte a PNG dibujandolo en un lienzo desde
 * un data URI, y ahi una referencia a un archivo externo no carga. El logo
 * desapareceria solo en el PNG -- justo en el formato que va a la imprenta.
 */
const LOGO_LADO = 85.41; // viewBox de public/favicon.svg

const LOGO_FORMAS =
  '<rect x="0" y="0" width="85.41" height="85.41" rx="6.01" ry="6.01" fill="#FEFEFE"/>' +
  '<polygon points="44.03,46.26 77.89,46.26 77.89,78.6 12,78.6" fill="#295276"/>' +
  '<polygon points="45.9,39.86 45.9,7.52 77.89,7.52 77.89,39.86" fill="#031B30"/>' +
  '<polygon points="39.51,7.52 39.51,41.76 7.52,74.07 7.52,7.52" fill="#295276"/>';

/**
 * Fraccion del lado del simbolo que ocupa el logo.
 *
 * Los valores salen de medir, no de estimar. Se genero el codigo, se le
 * pintaron manchas de 2x2 modulos solo sobre datos -- evitando los patrones de
 * localizacion y las lineas de sincronismo, que ninguna correccion recupera --
 * y se decodifico con jsQR hasta encontrar el punto de fallo:
 *
 *     sin logo    aguanta 12 manchas
 *     0.20        aguanta  6 manchas
 *     0.28        aguanta  4 manchas
 *     0.34+       aguanta  4 manchas
 *
 * O sea que el logo se come la mitad del margen de correccion antes de que
 * pase nada en el mundo real. Por eso 0.20 por defecto: deja tolerancia de
 * sobra para un doblez, un reflejo o tinta corrida, que es para lo que ECC H
 * estaba ahi en primer lugar.
 *
 * El tope de 0.28 no es donde deja de leerse -- a 0.40 todavia se lee limpio.
 * Es donde deja de quedar margen para lo que venga despues. Un QR que solo
 * escanea en condiciones perfectas es un QR que falla en el stand.
 */
const LOGO_ESCALA = 0.20;
const LOGO_ESCALA_MAX = 0.28;

export interface OpcionesQR {
  perfil?: PerfilQR;
  /** Marca de INACONS al centro. Solo con perfil de impresion (ECC H). */
  logo?: boolean;
  /** Fraccion del lado que ocupa el logo. Por defecto 0.20, tope 0.28. */
  escalaLogo?: number;
}

export interface ResultadoQR {
  svg: string;
  /** Modulos por lado, sin contar la zona de silencio. */
  modulos: number;
  perfil: PerfilQR;
  ecc: 'M' | 'H';
  conLogo: boolean;
  /** Lado minimo recomendado al imprimir, en milimetros. */
  mmMinimos: number;
}

/**
 * Genera el QR y devuelve tambien con que quedo hecho.
 *
 * El panel necesita esos datos, no solo el dibujo: cuantos modulos tiene
 * decide el tamano fisico minimo al que se puede imprimir.
 */
export async function generarQR(url: string, opciones: OpcionesQR = {}): Promise<ResultadoQR> {
  const perfil = opciones.perfil ?? 'pantalla';
  const { color, ecc } = PERFILES[perfil];
  const conLogo = opciones.logo === true;

  if (conLogo && ecc !== 'H') {
    throw new Error(
      `El logo necesita ECC H y el perfil "${perfil}" usa ECC ${ecc}. ` +
      'Usa el perfil "impresion", o genera sin logo. ' +
      'Un logo sobre ECC M escanea en pantalla y falla sobre papel.'
    );
  }

  const escala = Math.min(opciones.escalaLogo ?? LOGO_ESCALA, LOGO_ESCALA_MAX);

  let svg = await QRCode.toString(url, {
    type: 'svg',
    errorCorrectionLevel: ecc,
    margin: ZONA_SILENCIO,
    color: { dark: color, light: '#ffffff' },
  });

  const modulos = QRCode.create(url, { errorCorrectionLevel: ecc }).modules.size;

  if (conLogo) {
    const lienzo = modulos + ZONA_SILENCIO * 2;   // lado del viewBox
    const lado   = modulos * escala;              // lado del logo
    const aire   = 1;                             // un modulo de aire alrededor
    const placa  = lado + aire * 2;

    const logoXY  = (lienzo - lado) / 2;
    const placaXY = (lienzo - placa) / 2;
    const factor  = lado / LOGO_LADO;

    // La placa blanca separa el logo de los modulos vecinos. Sin ella el
    // borde del logo se confunde con un modulo oscuro y el lector pierde la
    // cuadricula justo en el centro.
    const capa =
      `<rect x="${placaXY.toFixed(3)}" y="${placaXY.toFixed(3)}" ` +
      `width="${placa.toFixed(3)}" height="${placa.toFixed(3)}" ` +
      `rx="${(placa * 0.08).toFixed(3)}" fill="#ffffff"/>` +
      `<g transform="translate(${logoXY.toFixed(3)} ${logoXY.toFixed(3)}) scale(${factor.toFixed(6)})">` +
      LOGO_FORMAS +
      '</g>';

    svg = svg.replace('</svg>', capa + '</svg>');
  }

  return {
    svg,
    modulos,
    perfil,
    ecc,
    conLogo,
    // ~0,5 mm por modulo es la regla de campo para lectura comoda a distancia
    // de brazo. Redondeado hacia arriba al milimetro.
    mmMinimos: Math.ceil(modulos * 0.5),
  };
}

/**
 * La misma URL, para que la lea y la teclee una persona.
 *
 * `urlDeCodigo` devuelve MAYÚSCULAS porque es lo que se codifica dentro del
 * símbolo: habilita el modo alfanumérico y produce un QR más chico. Pero esa
 * forma no se le enseña a nadie. En una pantalla parece un error, y en la hoja
 * impresa es más incómoda de teclear justo cuando alguien recurre a ella
 * porque el QR no escaneó.
 *
 * Las dos formas llevan al mismo sitio: el esquema y el host son insensibles a
 * mayúsculas por estándar, y el código lo normaliza `resolver_qr()`.
 *
 * O sea: se codifica en mayúsculas, se muestra en minúsculas.
 */
export function urlLegible(codigo: string): string {
  return `${DOMINIO}/r/${codigo}`.toLowerCase();
}

/**
 * SVG del código, como cadena.
 *
 * SVG y no PNG porque es la única forma de que el mismo QR sirva para una
 * miniatura en el panel y para un pliego A3 sin regenerarlo: no tiene
 * resolución propia.
 */
export async function svgDeUrl(url: string, perfil: PerfilQR = 'pantalla'): Promise<string> {
  return (await generarQR(url, { perfil })).svg;
}

/** SVG a partir de un código corto. Atajo sobre `urlDeCodigo` + `svgDeUrl`. */
export async function svgDeCodigo(codigo: string, perfil: PerfilQR = 'pantalla'): Promise<string> {
  return svgDeUrl(urlDeCodigo(codigo), perfil);
}

/**
 * Cuántos módulos por lado tiene el símbolo, sin la zona de silencio.
 *
 * Es el dato que decide el tamaño físico mínimo: la regla de campo es ~0,5 mm
 * por módulo para lectura cómoda a distancia de brazo. Un símbolo de 29
 * módulos quiere al menos ~15 mm de lado.
 */
export function modulosDeUrl(url: string, perfil: PerfilQR = 'pantalla'): number {
  return QRCode.create(url, { errorCorrectionLevel: PERFILES[perfil].ecc }).modules.size;
}

/**
 * Mínimo de píxeles por módulo, por perfil.
 *
 * No es el lado del PNG: es cuántos píxeles mide UNA celda. Es lo que decide
 * si el borde entre módulos sale neto, y no cambia porque la imagen sea más
 * grande — un PNG enorme con 3 px por módulo sigue siendo papilla.
 *
 * 4 px por módulo es el piso absoluto por debajo del cual el borde se
 * emborrona al imprimir. Impresión pide 20 porque tiene que sobrevivir a una
 * reducción en maquetación que nadie avisa: si alguien coloca el PNG al 50%
 * en un flyer, a 20 quedan 10 y sigue sirviendo; partiendo de 6 quedan 3 y no.
 */
const PX_POR_MODULO_MIN: Record<PerfilQR, number> = {
  pantalla: 8,
  impresion: 20,
};

export interface ResultadoPNG {
  blob: Blob;
  /** Lado real del PNG. Puede no ser el pedido: se ajusta al múltiplo exacto. */
  lado: number;
  pixelesPorModulo: number;
  /** Lado en mm hasta el que este PNG imprime a 300 dpi o más. */
  mmHasta300dpi: number;
}

/**
 * PNG del código, rasterizado DESDE EL SVG. Solo navegador.
 *
 * Nunca se escala un preview. Es el error que hoy tiene `/recursos/`: descarga
 * el `<canvas>` de 220 px del panel estirado al tamaño final, y un QR
 * interpolado pierde el borde neto entre módulos — que es justo lo que el
 * escáner busca. Se ve bien en la pantalla y falla sobre papel.
 *
 * El lado final se ajusta al múltiplo exacto del número de módulos, y por eso
 * puede no coincidir con `tamano`. No es un detalle: pedir 1200 px sobre un
 * lienzo de 41 módulos da 29,2683 px por módulo, así que el rasterizador le
 * reparte 29 px a unos y 30 a otros. Medido sobre la salida real: a 1200 px
 * aparecen anchos de 29 y de 30 mezclados; a 1189 (29 × 41) todos miden 29.
 *
 * Un módulo que se corre un píxel respecto del vecino desplaza la cuadrícula
 * que el lector reconstruye, y eso se paga justo en el caso difícil: lejos,
 * torcido, con poca luz.
 */
export async function pngDeUrl(
  url: string,
  opciones: OpcionesQR = {},
  tamano = 1200,
): Promise<ResultadoPNG> {
  if (typeof document === 'undefined') {
    throw new Error('pngDeUrl necesita un navegador: rasteriza sobre un <canvas>.');
  }

  const { svg, modulos, perfil } = await generarQR(url, opciones);

  // Lienzo = simbolo + las dos zonas de silencio. Es lo que hay que dividir.
  const lienzo = modulos + ZONA_SILENCIO * 2;

  const pixelesPorModulo = Math.max(
    PX_POR_MODULO_MIN[perfil],
    Math.round(tamano / lienzo),
  );
  const lado = pixelesPorModulo * lienzo;

  // El SVG viaja como data URI en base64. `encodeURIComponent` sobre el XML
  // crudo también funciona, pero base64 evita que un carácter del marcado
  // rompa la URI.
  const fuente = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;

  const imagen = new Image();
  imagen.width = lado;
  imagen.height = lado;

  await new Promise<void>((listo, falla) => {
    imagen.onload = () => listo();
    imagen.onerror = () => falla(new Error('No se pudo rasterizar el SVG del QR.'));
    imagen.src = fuente;
  });

  const canvas = document.createElement('canvas');
  canvas.width = lado;
  canvas.height = lado;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('El navegador no dio contexto 2D.');

  // Fondo blanco explícito: un PNG con fondo transparente colocado sobre un
  // color oscuro invierte el contraste y deja de leerse.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, lado, lado);

  // imageSmoothing apagado: el suavizado es exactamente lo que hay que evitar.
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(imagen, 0, 0, lado, lado);

  const blob = await new Promise<Blob>((listo, falla) => {
    canvas.toBlob(
      (b) => (b ? listo(b) : falla(new Error('El lienzo no produjo un PNG.'))),
      'image/png',
    );
  });

  return {
    blob,
    lado,
    pixelesPorModulo,
    // 25.4 mm por pulgada. Hasta este tamano el PNG sigue dando 300 dpi.
    mmHasta300dpi: Math.floor((lado / 300) * 25.4),
  };
}

/**
 * Con qué parámetros se produjo un QR. Se guarda en la fila de `qr_codes`.
 *
 * Existe para que no se repita lo del PNG de Expomina, generado con una
 * herramienta externa que no dejó rastro de su configuración.
 */
export function metadatosGeneracion(perfil: PerfilQR) {
  return {
    perfil_generacion: perfil,
    version_modulo_qr: VERSION_MODULO,
    generado_en: new Date().toISOString(),
  };
}
