/** Ruta "/": el formulario de /contacto/. Avisa a ventas y acusa recibo. */

import { CORREO_VALIDO, enviar, escapar, leerCampos, tablaHtml, type Env, type Respuesta } from './comun';

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

export const IP_A_TURNSTILE = true;

// Por hora. Turnstile frena a los bots; esto frena a una persona usando el
// acuse de recibo para inundar el buzón de un tercero, o el de ventas.
const MAXIMO_POR_HORA = 3;

export function validar(cuerpo: Record<string, unknown>): Consulta | null {
  const c = leerCampos(cuerpo, LIMITES);
  if (!c || OBLIGATORIOS.some((campo) => !c[campo])) return null;
  if (!CORREO_VALIDO.test(c.correo)) return null;
  return c;
}

export async function procesar(consulta: Consulta, env: Env, ipHash: string): Promise<Respuesta> {
  const { recientes } = (await env.DB.prepare(
    `SELECT COUNT(*) AS recientes FROM consultas
     WHERE creado > datetime('now', '-1 hour') AND (ip_hash = ?1 OR correo = ?2)`,
  ).bind(ipHash, consulta.correo).first<{ recientes: number }>())!;
  if (recientes >= MAXIMO_POR_HORA) return { status: 429, datos: { ok: false, error: 'limite' } };

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
      para: [env.CORREO_DESTINO],
      responderA: { address: consulta.correo, name: consulta.nombre },
      asunto: `Consulta web — ${consulta.servicio} — ${consulta.nombre}`,
      ...avisoAVentas(consulta, id),
    });
  } catch (e) {
    await marcar(env, id, 'error', String(e));
    console.error(`contacto: falló el aviso de la consulta ${id}`);
    return { status: 502, datos: { ok: false, error: 'envio' } };
  }
  await marcar(env, id, 'notificado');

  // El acuse es cortesía: si falla, la consulta ya llegó a ventas y el
  // visitante no tiene por qué ver un error.
  if (env.ENVIAR_ACUSE === 'si') {
    try {
      await enviar(env, {
        para: [consulta.correo],
        responderA: { address: env.CORREO_DESTINO, name: 'INACONS' },
        asunto: 'Recibimos tu consulta — INACONS',
        ...acuse(consulta),
      });
    } catch (e) {
      await marcar(env, id, 'notificado', `acuse: ${e}`);
    }
  }

  return { status: 200, datos: { ok: true } };
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
    ${tablaHtml(filas)}
    <p style="white-space:pre-wrap">${escapar(c.mensaje)}</p>
    <p style="color:#777;font-size:12px">Enviado desde ${escapar(c.origen || 'el sitio web')}.
    Responde a este correo para contestarle directamente.</p>`;
  return { texto, html };
}

// No repite el mensaje ni nada que escriba el visitante salvo su nombre: el
// acuse va a la dirección que él teclea, y con el mensaje dentro serviría
// para mandar cualquier texto a un tercero desde el dominio de INACONS.
function acuse(c: Consulta) {
  const texto = [
    `Hola, ${c.nombre}:`,
    '',
    'Recibimos tu consulta en la web de INACONS. Nuestro equipo la revisará y te responderá a la brevedad.',
    '',
    'Si no enviaste esta consulta, ignora este correo.',
    '',
    'INACONS S.R.L.',
  ].join('\n');
  const html = `
    <p>Hola, ${escapar(c.nombre)}:</p>
    <p>Recibimos tu consulta en la web de INACONS. Nuestro equipo la revisará y te responderá a la brevedad.</p>
    <p style="color:#777;font-size:12px">Si no enviaste esta consulta, ignora este correo.</p>
    <p>INACONS S.R.L.</p>`;
  return { texto, html };
}

async function marcar(env: Env, id: number, estado: string, error: string | null = null) {
  await env.DB.prepare('UPDATE consultas SET estado = ?1, error = ?2 WHERE id = ?3').bind(estado, error, id).run();
}
