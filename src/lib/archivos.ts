import { statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * "PDF, 4.8 MB": formato y peso de un archivo de public/, para el texto del
 * enlace que lo descarga. Quien abre el sitio por un QR en el celular tiene que
 * saber antes de tocar que el brochure pesa casi 5 MB.
 *
 * Se lee en el build: si el archivo cambia, el texto cambia solo. La ruta es la
 * pública ("/assets/documentos/…"); un archivo que no existe rompe el build en
 * vez de publicar un peso falso. Los números van como en es-PE (punto decimal),
 * igual que las cifras de las fichas.
 */
export function formatoYPeso(ruta: string): string {
  const bytes = statSync(join(process.cwd(), 'public', ruta)).size;
  const formato = (ruta.split('.').pop() ?? '').toUpperCase();
  const numero = (n: number) => new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 }).format(n);
  // Espacio duro entre número y unidad: en un botón angosto "4.6" y "MB"
  // quedaban en líneas distintas.
  const peso = bytes >= 1024 * 1024 ? `${numero(bytes / 1024 / 1024)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${formato}, ${peso}`;
}
