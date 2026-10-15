/**
 * Receptor del formulario de /contacto/.
 *
 * El sitio es estático: no puede guardar la clave de Zoho CPaaS sin
 * publicarla. Este Worker la guarda como secret y hace el trabajo que
 * necesita servidor: comprobar Turnstile, limitar abusos, guardar una copia
 * en D1 y pedir a Zoho CPaaS (ex ZeptoMail) que mande el correo.
 *
 * Contrato con el sitio: docs/contenido.md. Solo responde 2xx cuando CPaaS
 * aceptó el aviso a ventas; con cualquier otra cosa el formulario conserva
 * lo escrito y ofrece el correo directo, así que nunca se finge un envío.
 */

interface Env {
  DB: D1Database;
  // Secrets (wrangler secret put …). CPAAS_TOKEN se acepta con o sin el
  // prefijo "Zoho-enczapikey": el botón de copiar de la consola lo incluye.
  CPAAS_TOKEN: string;
  TURNSTILE_SECRET: string;
  IP_SALT: string;
  // Variables (wrangler.jsonc)
  ORIGENES: string;
  CPAAS_URL: string;
  CORREO_DESTINO: string;
  CORREO_REMITENTE: string;
  ENVIAR_ACUSE: string;
  RETENCION_MESES: string;
}

type Consulta = {
  nombre: string;
  correo: string;
  telefono: string;
  empresa: string;
  servicio: string;
  mensaje: string;
  origen: string;
};

// Los mismos maxlength que el formulario: el servidor no puede rechazar algo
// que el navegador dio por bueno, o el visitante ve un error sin explicación.
const LIMITES: Record<keyof Consulta, number> = {
  nombre: 120,
  correo: 160,
  telefono: 30,
  empresa: 160,
  servicio: 120,
  mensaje: 3000,
  origen: 300,
};
const OBLIGATORIOS: (keyof Consulta)[] = ['nombre', 'correo', 'telefono', 'servicio', 'mensaje'];
const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Por hora. Turnstile frena a los bots; esto frena a una persona usando el
// acuse de recibo para inundar el buzón de un tercero, o el de ventas.
const MAXIMO_POR_HORA = 3;

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

    const consulta = validar(cuerpo);
    if (!consulta) return json({ ok: false, error: 'datos' }, 400, cors);

    const ip = request.headers.get('CF-Connecting-IP') ?? '';
    if (!(await turnstileValido(String(cuerpo.turnstile ?? ''), ip, env.TURNSTILE_SECRET))) {
      return json({ ok: false, error: 'verificacion' }, 403, cors);
    }

    const ipHash = await sha256(`${env.IP_SALT}:${ip}`);
    const { recientes } = (await env.DB.prepare(
      `SELECT COUNT(*) AS recientes FROM consultas
       WHERE creado > datetime('now', '-1 hour') AND (ip_hash = ?1 OR correo = ?2)`,
    ).bind(ipHash, consulta.correo).first<{ recientes: number }>())!;
    if (recientes >= MAXIMO_POR_HORA) return json({ ok: false, error: 'limite' }, 429, cors);

    // Se guarda antes de enviar: si CPaaS falla, la consulta no se pierde.
    const { id } = (await env.DB.prepare(
      `INSERT INTO consultas (nombre, correo, telefono, empresa, servicio, mensaje, origen, ip_hash)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) RETURNING id`,
    ).bind(
      consulta.nombre, consulta.correo, consulta.telefono, consulta.empresa,
      consulta.servicio, consulta.mensaje, consulta.origen, ipHash,
    ).first<{ id: number }>())!;

    try {
      await enviar(env, {
        para: env.CORREO_DESTINO,
        responderA: { address: consulta.correo, name: consulta.nombre },
        asunto: `Consulta web — ${consulta.servicio} — ${consulta.nombre}`,
        ...avisoAVentas(consulta, id),
      });
    } catch (e) {
      await marcar(env, id, 'error', String(e));
      return json({ ok: false, error: 'envio' }, 502, cors);
    }
    await marcar(env, id, 'notificado');

    // El acuse es cortesía: si falla, la consulta ya llegó a ventas y el
    // visitante no tiene por qué ver un error.
    if (env.ENVIAR_ACUSE === 'si') {
      try {
        await enviar(env, {
          para: consulta.correo,
          responderA: { address: env.CORREO_DESTINO, name: 'INACONS' },
          asunto: 'Recibimos tu consulta — INACONS',
          ...acuse(consulta),
        });
      } catch (e) {
        await marcar(env, id, 'notificado', `acuse: ${e}`);
      }
    }

    return json({ ok: true }, 200, cors);
  },

  // Las consultas no se guardan para siempre: el plazo lo fija RETENCION_MESES
  // y es el que tiene que declarar la política de privacidad.
  async scheduled(_evento, env): Promise<void> {
    const meses = Number.parseInt(env.RETENCION_MESES, 10) || 12;
    await env.DB.prepare(`DELETE FROM consultas WHERE creado < datetime('now', ?1)`)
      .bind(`-${meses} months`)
      .run();
  },
} satisfies ExportedHandler<Env>;

function validar(cuerpo: Record<string, unknown>): Consulta | null {
  const c = {} as Consulta;
  for (const campo of Object.keys(LIMITES) as (keyof Consulta)[]) {
    const valor = typeof cuerpo[campo] === 'string' ? (cuerpo[campo] as string).trim() : '';
    if (valor.length > LIMITES[campo]) return null;
    c[campo] = valor;
  }
  if (OBLIGATORIOS.some((campo) => !c[campo])) return null;
  if (!CORREO_VALIDO.test(c.correo)) return null;
  return c;
}

async function turnstileValido(token: string, ip: string, secreto: string): Promise<boolean> {
  if (!token) return false;
  const datos = new FormData();
  datos.append('secret', secreto);
  datos.append('response', token);
  if (ip) datos.append('remoteip', ip);
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: datos });
  const resultado = await r.json<{ success: boolean }>();
  return resultado.success === true;
}

type Correo = {
  para: string;
  responderA: { address: string; name: string };
  asunto: string;
  texto: string;
  html: string;
};

async function enviar(env: Env, c: Correo): Promise<void> {
  const r = await fetch(env.CPAAS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Zoho-enczapikey ${env.CPAAS_TOKEN.replace(/^Zoho-enczapikey\s+/, '')}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      from: { address: env.CORREO_REMITENTE, name: 'Web INACONS' },
      to: [{ email_address: { address: c.para } }],
      reply_to: [c.responderA],
      subject: c.asunto,
      textbody: c.texto,
      htmlbody: c.html,
    }),
  });
  if (!r.ok) throw new Error(`CPaaS ${r.status}: ${(await r.text()).slice(0, 500)}`);
}

function avisoAVentas(c: Consulta, id: number) {
  const filas: [string, string][] = [
    ['Nombre', c.nombre],
    ['Correo', c.correo],
    ['Teléfono', c.telefono],
    ['Empresa', c.empresa || '—'],
    ['Servicio de interés', c.servicio],
  ];
  const texto = [
    `Consulta n.° ${id} desde el formulario web de INACONS`,
    '',
    ...filas.map(([k, v]) => `${k}: ${v}`),
    '',
    c.mensaje,
    '',
    `Enviado desde ${c.origen || 'el sitio web'}. Responde a este correo para contestarle directamente.`,
  ].join('\n');
  const html = `
    <p><strong>Consulta n.° ${id}</strong> desde el formulario web de INACONS.</p>
    <table cellpadding="6" style="border-collapse:collapse">
      ${filas.map(([k, v]) => `<tr><td style="color:#555">${k}</td><td><strong>${escapar(v)}</strong></td></tr>`).join('')}
    </table>
    <p style="white-space:pre-wrap">${escapar(c.mensaje)}</p>
    <p style="color:#777;font-size:12px">Enviado desde ${escapar(c.origen || 'el sitio web')}.
    Responde a este correo para contestarle directamente.</p>`;
  return { texto, html };
}

function acuse(c: Consulta) {
  const texto = [
    `Hola, ${c.nombre}:`,
    '',
    `Recibimos tu consulta sobre ${c.servicio}. Nuestro equipo la revisará y te responderá a la brevedad.`,
    '',
    'Tu mensaje:',
    c.mensaje,
    '',
    'INACONS S.R.L.',
  ].join('\n');
  const html = `
    <p>Hola, ${escapar(c.nombre)}:</p>
    <p>Recibimos tu consulta sobre <strong>${escapar(c.servicio)}</strong>.
    Nuestro equipo la revisará y te responderá a la brevedad.</p>
    <p style="color:#555">Tu mensaje:</p>
    <blockquote style="white-space:pre-wrap;border-left:3px solid #ccc;margin:0;padding-left:12px">${escapar(c.mensaje)}</blockquote>
    <p>INACONS S.R.L.</p>`;
  return { texto, html };
}

async function marcar(env: Env, id: number, estado: string, error: string | null = null) {
  await env.DB.prepare('UPDATE consultas SET estado = ?1, error = ?2 WHERE id = ?3').bind(estado, error, id).run();
}

async function sha256(texto: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function escapar(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

function json(datos: unknown, status: number, cabeceras: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(datos), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cabeceras },
  });
}
