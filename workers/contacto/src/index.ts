/**
 * Receptor de los formularios del sitio: /contacto/ ("/") y el Canal Ético
 * ("/canal").
 *
 * El sitio es estático: no puede guardar la clave de Zoho CPaaS sin
 * publicarla. Este Worker la guarda como secret y hace el trabajo que
 * necesita servidor: comprobar Turnstile, limitar abusos, guardar una copia
 * en D1 y pedir a Zoho CPaaS (ex ZeptoMail) que mande el correo.
 *
 * Contrato con el sitio: docs/contenido.md. Solo responde 2xx cuando CPaaS
 * aceptó el aviso a los responsables; con cualquier otra cosa el formulario
 * conserva lo escrito, así que nunca se finge un envío.
 */

import * as canal from './canal';
import * as contacto from './contacto';
import * as csp from './csp';
import { VerificacionNoDisponible, sha256, turnstileValido, type Env, type Respuesta } from './comun';

// El envío más grande es el del Canal Ético: la descripción (5000 caracteres)
// más los demás campos son unos 12 KB en UTF-8 con tildes, y el token de
// Turnstile suma hasta 2 KB. 32 KB deja margen y sigue cortando cualquier abuso.
const LIMITE_CUERPO = 32 * 1024;

type Ruta<T> = {
  /** Si la IP del visitante se manda a Turnstile. Es opcional para Cloudflare. */
  IP_A_TURNSTILE: boolean;
  /** La `action` con que el sitio pinta el widget de este formulario. */
  ACCION_TURNSTILE: string;
  validar(cuerpo: Record<string, unknown>): T | null;
  procesar(datos: T, env: Env, ipHash: string, ctx: ExecutionContext): Promise<Respuesta>;
};

export default {
  async fetch(request, env, ctx): Promise<Response> {
    // Los informes de la CSP los manda el navegador sin un Origin de fiar: van
    // antes del control de origen y no tocan nada más (ver csp.ts).
    if (new URL(request.url).pathname.replace(/\/+$/, '') === '/csp') return csp.recibir(request);

    const origen = request.headers.get('Origin') ?? '';
    const permitidos = env.ORIGENES.split(',').map((o) => o.trim());
    if (!permitidos.includes(origen)) return json({ ok: false, error: 'origen' }, 403);

    const cors = {
      'Access-Control-Allow-Origin': origen,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ ok: false, error: 'metodo' }, 405, cors);

    if (!(request.headers.get('Content-Type') ?? '').startsWith('application/json')) {
      return json({ ok: false, error: 'tipo' }, 415, cors);
    }
    if (Number(request.headers.get('Content-Length') ?? 0) > LIMITE_CUERPO) {
      return json({ ok: false, error: 'tamano' }, 413, cors);
    }

    // Se lee como texto y no con request.json(): Content-Length puede faltar,
    // y así el tope también vale con un cuerpo sin ese encabezado.
    let cuerpo: Record<string, unknown>;
    try {
      const texto = await request.text();
      if (texto.length > LIMITE_CUERPO) return json({ ok: false, error: 'tamano' }, 413, cors);
      const leido: unknown = JSON.parse(texto);
      // null, un número o un arreglo son JSON válido pero no un formulario.
      if (typeof leido !== 'object' || leido === null || Array.isArray(leido)) throw new Error('forma');
      cuerpo = leido as Record<string, unknown>;
    } catch {
      return json({ ok: false, error: 'json' }, 400, cors);
    }

    const ip = request.headers.get('CF-Connecting-IP') ?? '';
    const ruta = new URL(request.url).pathname.replace(/\/+$/, '');
    const hosts = permitidos.map((o) => new URL(o).hostname);
    // Un fallo de D1, del límite o del código de reporte salía como excepción
    // sin CORS, y el navegador lo mostraba como corte de red. Ahora es un 500
    // que el formulario lee y explica. Sin datos del envío en el log: este
    // Worker recibe reportes anónimos.
    try {
      const { status, datos } =
        ruta === '' ? await atender(contacto, cuerpo, env, ip, hosts, ctx)
        : ruta === '/canal' ? await atender(canal, cuerpo, env, ip, hosts, ctx)
        : { status: 404, datos: { ok: false, error: 'ruta' } };
      return json(datos, status, cors);
    } catch (e) {
      console.error(`Error no controlado en ${ruta || '/'}: ${e instanceof Error ? e.message.slice(0, 200) : 'desconocido'}`);
      return json({ ok: false, error: 'interno' }, 500, cors);
    }
  },

  // Cada 15 minutos (wrangler.jsonc): reenvía los avisos que no salieron,
  // borra los hash de IP de más de una hora y purga las consultas vencidas.
  // Todo es barato y no necesita un cron propio.
  async scheduled(_evento, env): Promise<void> {
    // Cada tarea por su lado: un fallo de D1 en una no deja sin correr a las otras.
    const tareas = [['contacto', contacto.reintentarPendientes], ['canal', canal.reintentarPendientes]] as const;
    for (const [nombre, tarea] of tareas) {
      await tarea(env).catch((e: unknown) => console.error(`${nombre}: falló el reintento: ${e instanceof Error ? e.message.slice(0, 200) : e}`));
    }

    // El hash de la IP solo sirve para el límite de 3 consultas por hora:
    // pasada la hora se borra. Guardado 12 meses, con la sal se podía volver a
    // la IP probando todas las IPv4.
    await env.DB.prepare(`UPDATE consultas SET ip_hash = '' WHERE ip_hash != '' AND creado < datetime('now', '-1 hour')`).run();

    // Las consultas comerciales no se guardan para siempre: el plazo lo fija
    // RETENCION_MESES y es el que declara la política de privacidad. Los
    // reportes del Canal Ético no se purgan aquí: son registros de
    // cumplimiento y su plazo lo decide quien los gestiona.
    const meses = Number.parseInt(env.RETENCION_MESES, 10);
    if (!(meses > 0)) {
      // Un valor negativo armaba '--3 months', datetime() daba NULL y no se
      // borraba nada sin que nadie se enterara.
      console.error(`RETENCION_MESES no es un número de meses válido: no se purga`);
      return;
    }
    await env.DB.prepare(`DELETE FROM consultas WHERE creado < datetime('now', ?1)`).bind(`-${meses} months`).run();
  },
} satisfies ExportedHandler<Env>;

// Turnstile va después de validar: si los datos no sirven, no se gasta el
// token, y el visitante puede corregir y reenviar sin volver a resolverlo.
async function atender<T>(
  ruta: Ruta<T>, cuerpo: Record<string, unknown>, env: Env, ip: string, hosts: string[], ctx: ExecutionContext,
): Promise<Respuesta> {
  const datos = ruta.validar(cuerpo);
  if (!datos) return { status: 400, datos: { ok: false, error: 'datos' } };
  // Sin sal, el hash de "undefined:<ip>" se revierte probando las IPv4 en minutos.
  if (!env.IP_SALT) throw new Error('falta el secret IP_SALT');
  const ipTurnstile = ruta.IP_A_TURNSTILE ? ip : '';
  try {
    const esperado = { hosts, accion: ruta.ACCION_TURNSTILE };
    if (!(await turnstileValido(String(cuerpo.turnstile ?? ''), ipTurnstile, env.TURNSTILE_SECRET, esperado))) {
      return { status: 403, datos: { ok: false, error: 'verificacion' } };
    }
  } catch (e) {
    if (!(e instanceof VerificacionNoDisponible)) throw e;
    // Sin datos del visitante en el log: este Worker recibe reportes anónimos.
    console.error('Turnstile no respondió');
    // Va por json(datos, status, cors) como cualquier otra respuesta; sin CORS
    // el navegador lo mostraría como un fallo de red y no como un 503.
    return { status: 503, datos: { ok: false, error: 'verificacion-no-disponible' } };
  }
  return ruta.procesar(datos, env, await sha256(`${env.IP_SALT}:${ip}`), ctx);
}

function json(datos: unknown, status: number, cabeceras: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(datos), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cabeceras },
  });
}
