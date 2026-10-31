/**
 * Ruta "/csp": informes de violación de la Content-Security-Policy del sitio
 * (`report-to` y `report-uri` en public/.htaccess). Sin ellos, el paso de la
 * CSP de modo informe a bloqueo dependía de que alguien mirara la consola de
 * su navegador; ahora cada violación deja una línea en los Logs del Worker.
 *
 * Los manda el navegador por su cuenta, sin un Origin en el que confiar, así
 * que esta ruta va antes del control de origen de index.ts. No guarda nada ni
 * toca D1: registra la directiva, el host de lo bloqueado y la ruta de la
 * página, sin query, IP ni user agent (el Canal Ético es una de esas páginas).
 */

// Un informe real pesa menos de 2 KB; varios juntos, pocos más.
const LIMITE_CUERPO = 16 * 1024;

// Cualquier página puede mandar informes y no hay credenciales en juego: el
// navegador hace preflight porque application/reports+json no es un tipo simple.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export type Violacion = { directiva: string; bloqueado: string; pagina: string };

export async function recibir(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: CORS });
  if (Number(request.headers.get('Content-Length') ?? 0) > LIMITE_CUERPO) {
    return new Response(null, { status: 413, headers: CORS });
  }
  const texto = await request.text();
  if (texto.length > LIMITE_CUERPO) return new Response(null, { status: 413, headers: CORS });
  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch {
    return new Response(null, { status: 400, headers: CORS });
  }
  for (const v of violaciones(datos)) console.log(`CSP: ${v.directiva} bloqueó ${v.bloqueado} en ${v.pagina}`);
  return new Response(null, { status: 204, headers: CORS });
}

/**
 * Los dos formatos que mandan los navegadores: la Reporting API (`report-to`,
 * un arreglo de informes de tipo "csp-violation") y el antiguo `report-uri`
 * (un objeto con "csp-report"). Lo que no encaja se ignora.
 */
export function violaciones(datos: unknown): Violacion[] {
  const lista: Violacion[] = [];
  const texto = (x: unknown) => (typeof x === 'string' ? x : '');
  if (Array.isArray(datos)) {
    for (const informe of datos.slice(0, 20)) {
      if (informe?.type !== 'csp-violation' || typeof informe.body !== 'object' || !informe.body) continue;
      const b = informe.body as Record<string, unknown>;
      lista.push(resumir(texto(b.effectiveDirective), texto(b.blockedURL), texto(b.documentURL)));
    }
  } else if (datos && typeof datos === 'object' && 'csp-report' in datos) {
    const r = (datos as Record<string, Record<string, unknown>>)['csp-report'] ?? {};
    lista.push(resumir(texto(r['effective-directive'] || r['violated-directive']), texto(r['blocked-uri']), texto(r['document-uri'])));
  }
  return lista;
}

// De lo bloqueado solo el origen ("inline", "eval" o https://host), y de la
// página solo host y ruta: una URL completa puede llevar datos en la query.
function resumir(directiva: string, bloqueado: string, pagina: string): Violacion {
  const sinQuery = (u: string) => {
    try {
      const url = new URL(u);
      return { origen: url.origin, ruta: url.host + url.pathname };
    } catch {
      return { origen: u.split(/[?#]/)[0], ruta: u.split(/[?#]/)[0] };
    }
  };
  return {
    directiva: (directiva.split(' ')[0] || 'desconocida').slice(0, 40),
    bloqueado: (sinQuery(bloqueado).origen || 'desconocido').slice(0, 120),
    pagina: (sinQuery(pagina).ruta || 'desconocida').slice(0, 120),
  };
}
