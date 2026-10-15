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
import { sha256, turnstileValido, type Env, type Respuesta } from './comun';

type Ruta<T> = {
  /** Si la IP del visitante se manda a Turnstile. Es opcional para Cloudflare. */
  IP_A_TURNSTILE: boolean;
  validar(cuerpo: Record<string, unknown>): T | null;
  procesar(datos: T, env: Env, ipHash: string): Promise<Respuesta>;
};

export default {
  async fetch(request, env): Promise<Response> {
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

    let cuerpo: Record<string, unknown>;
    try {
      cuerpo = await request.json();
    } catch {
      return json({ ok: false, error: 'json' }, 400, cors);
    }

    const ip = request.headers.get('CF-Connecting-IP') ?? '';
    const ruta = new URL(request.url).pathname.replace(/\/+$/, '');
    const { status, datos } =
      ruta === '' ? await atender(contacto, cuerpo, env, ip)
      : ruta === '/canal' ? await atender(canal, cuerpo, env, ip)
      : { status: 404, datos: { ok: false, error: 'ruta' } };
    return json(datos, status, cors);
  },

  async scheduled(_evento, env): Promise<void> {
    // Las consultas comerciales no se guardan para siempre: el plazo lo fija
    // RETENCION_MESES y es el que declara la política de privacidad. Los
    // reportes del Canal Ético no se purgan aquí: son registros de
    // cumplimiento y su plazo lo decide quien los gestiona.
    const meses = Number.parseInt(env.RETENCION_MESES, 10) || 12;
    await env.DB.prepare(`DELETE FROM consultas WHERE creado < datetime('now', ?1)`).bind(`-${meses} months`).run();
  },
} satisfies ExportedHandler<Env>;

// Turnstile va después de validar: si los datos no sirven, no se gasta el
// token, y el visitante puede corregir y reenviar sin volver a resolverlo.
async function atender<T>(ruta: Ruta<T>, cuerpo: Record<string, unknown>, env: Env, ip: string): Promise<Respuesta> {
  const datos = ruta.validar(cuerpo);
  if (!datos) return { status: 400, datos: { ok: false, error: 'datos' } };
  const ipTurnstile = ruta.IP_A_TURNSTILE ? ip : '';
  if (!(await turnstileValido(String(cuerpo.turnstile ?? ''), ipTurnstile, env.TURNSTILE_SECRET))) {
    return { status: 403, datos: { ok: false, error: 'verificacion' } };
  }
  return ruta.procesar(datos, env, await sha256(`${env.IP_SALT}:${ip}`));
}

function json(datos: unknown, status: number, cabeceras: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(datos), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cabeceras },
  });
}
