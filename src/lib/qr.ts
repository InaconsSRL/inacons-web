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

/**
 * SVG del código, como cadena.
 *
 * SVG y no PNG porque es la única forma de que el mismo QR sirva para una
 * miniatura en el panel y para un pliego A3 sin regenerarlo: no tiene
 * resolución propia.
 */
export async function svgDeUrl(url: string, perfil: PerfilQR = 'pantalla'): Promise<string> {
  const { color, ecc } = PERFILES[perfil];

  return QRCode.toString(url, {
    type: 'svg',
    errorCorrectionLevel: ecc,
    margin: ZONA_SILENCIO,
    color: { dark: color, light: '#ffffff' },
  });
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
 * PNG del código, rasterizado DESDE EL SVG al tamaño pedido. Solo navegador.
 *
 * Nunca se escala un preview. Es el error que hoy tiene `/recursos/`: descarga
 * el `<canvas>` de 220 px del panel estirado al tamaño final, y un QR
 * interpolado pierde el borde neto entre módulos — que es justo lo que el
 * escáner busca. Se ve bien en la pantalla y falla sobre papel.
 *
 * `tamano` es el lado en píxeles. 1200 es el mínimo para material impreso.
 */
export async function pngDeUrl(
  url: string,
  perfil: PerfilQR = 'pantalla',
  tamano = 1200,
): Promise<Blob> {
  if (typeof document === 'undefined') {
    throw new Error('pngDeUrl necesita un navegador: rasteriza sobre un <canvas>.');
  }

  const svg = await svgDeUrl(url, perfil);

  // El SVG viaja como data URI en base64. `encodeURIComponent` sobre el XML
  // crudo también funciona, pero base64 evita que un carácter del marcado
  // rompa la URI.
  const fuente = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;

  const imagen = new Image();
  imagen.width = tamano;
  imagen.height = tamano;

  await new Promise<void>((listo, falla) => {
    imagen.onload = () => listo();
    imagen.onerror = () => falla(new Error('No se pudo rasterizar el SVG del QR.'));
    imagen.src = fuente;
  });

  const lienzo = document.createElement('canvas');
  lienzo.width = tamano;
  lienzo.height = tamano;

  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('El navegador no dio contexto 2D.');

  // Fondo blanco explícito: un PNG con fondo transparente colocado sobre un
  // color oscuro invierte el contraste y deja de leerse.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, tamano, tamano);

  // imageSmoothing apagado: el suavizado es exactamente lo que hay que evitar.
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(imagen, 0, 0, tamano, tamano);

  return new Promise<Blob>((listo, falla) => {
    lienzo.toBlob(
      (blob) => (blob ? listo(blob) : falla(new Error('El lienzo no produjo un PNG.'))),
      'image/png',
    );
  });
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
