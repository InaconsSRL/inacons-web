/** Ruta "/": el formulario de /contacto/. Avisa a ventas y acusa recibo. */

import {
  CONDICION_PENDIENTES, CORREO_VALIDO, enviar, escapar, leerCampos, limpiarOrigen, nombreValido, saturado, tablaHtml,
  type Env, type Respuesta,
} from './comun';

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

// Son los `titulo` de src/content/servicios/*.md más "Otro": el <select> de
// contacto.astro. El Worker no ve las colecciones de Astro, así que la lista se
// copia aquí; test/contrato.test.ts falla si las dos se separan. El servicio
// entra en el asunto del correo a ventas, por eso no puede ser texto libre.
export const SERVICIOS: ReadonlySet<string> = new Set([
  'Obras Civiles',
  'Obras de Infraestructura',
  'Obras Electromecánicas',
  'Arquitectura y Paisajismo',
  'Minería',
  'Consultoría',
  'Otro',
]);

export const IP_A_TURNSTILE = true;
export const ACCION_TURNSTILE = 'contacto';

// Por hora. Turnstile frena a los bots; esto frena a una persona usando el
// acuse de recibo para inundar el buzón de un tercero, o el de ventas.
const MAXIMO_POR_HORA = 3;

export function validar(cuerpo: Record<string, unknown>): Consulta | null {
  const c = leerCampos({ ...cuerpo, origen: limpiarOrigen(cuerpo.origen) }, LIMITES);
  if (!c || OBLIGATORIOS.some((campo) => !c[campo])) return null;
  // El tope por hora compara correos: Ana@ y ANA@ son el mismo buzón.
  c.correo = c.correo.toLowerCase();
  if (!CORREO_VALIDO.test(c.correo) || !nombreValido(c.nombre) || !SERVICIOS.has(c.servicio)) return null;
  return c;
}

export async function procesar(consulta: Consulta, env: Env, ipHash: string, ctx: ExecutionContext): Promise<Respuesta> {
  const { recientes } = (await env.DB.prepare(
    `SELECT COUNT(*) AS recientes FROM consultas
     WHERE creado > datetime('now', '-1 hour') AND (ip_hash = ?1 OR correo = ?2)`,
  ).bind(ipHash, consulta.correo).first<{ recientes: number }>())!;
  if (recientes >= MAXIMO_POR_HORA) return { status: 429, datos: { ok: false, error: 'limite' } };
  if (await saturado(env, 'consultas')) return { status: 503, datos: { ok: false, error: 'saturado' } };

  // Se guarda antes de enviar: si CPaaS falla, la consulta no se pierde.
  const { id } = (await env.DB.prepare(
    `INSERT INTO consultas (nombre, correo, telefono, empresa, servicio, mensaje, origen, ip_hash)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) RETURNING id`,
  ).bind(
    consulta.nombre, consulta.correo, consulta.telefono, consulta.empresa,
    consulta.servicio, consulta.mensaje, consulta.origen, ipHash,
  ).first<{ id: number }>())!;

  try {
    await avisarAVentas(env, consulta, id);
  } catch (e) {
    await marcar(env, id, 'error', String(e));
    console.error(`contacto: falló el aviso de la consulta ${id}`);
    return { status: 502, datos: { ok: false, error: 'envio' } };
  }

  // Con el aviso en manos de ventas la respuesta ya es 200: marcar la fila y
  // el acuse siguen después de contestar. Antes se esperaban aquí, y un acuse
  // lento o un fallo al marcar convertían un envío correcto en un error a ojos
  // del visitante, que reenviaba.
  ctx.waitUntil(despuesDelAviso(consulta, env, id));
  return { status: 200, datos: { ok: true } };
}

async function despuesDelAviso(consulta: Consulta, env: Env, id: number): Promise<void> {
  try {
    await marcar(env, id, 'notificado');
  } catch {
    // Queda en 'recibido' y el cron la reenvía: mejor un aviso repetido que perdido.
    console.error(`contacto: no se pudo marcar la consulta ${id}`);
  }
  // El acuse es cortesía: si falla, la consulta ya llegó a ventas.
  if (env.ENVIAR_ACUSE !== 'si') return;
  try {
    await enviar(env, {
      para: [consulta.correo],
      responderA: { address: env.CORREO_DESTINO, name: 'INACONS' },
      asunto: 'Recibimos tu consulta — INACONS',
      ...acuse(consulta),
    });
  } catch (e) {
    await marcar(env, id, 'notificado', `acuse: ${e}`).catch(() => {});
  }
}

/**
 * Vuelve a avisar a ventas de las consultas que no le llegaron (ver
 * CONDICION_PENDIENTES). Lo llama el cron. Sin acuse: el visitante ya vio el
 * error en su momento, y un acuse horas después confunde más de lo que ayuda.
 */
export async function reintentarPendientes(env: Env): Promise<void> {
  const { results } = await env.DB.prepare(
    `SELECT id, nombre, correo, telefono, empresa, servicio, mensaje, origen, estado, error
     FROM consultas WHERE ${CONDICION_PENDIENTES}`,
  ).all<Consulta & { id: number; estado: string; error: string | null }>();
  for (const fila of results) {
    try {
      await avisarAVentas(env, fila, fila.id, true);
      await marcar(env, fila.id, 'notificado', `reenviada por el cron; antes ${fila.estado}${fila.error ? `: ${fila.error}` : ''}`.slice(0, 1000));
    } catch (e) {
      await marcar(env, fila.id, 'error', String(e));
      console.error(`contacto: falló el reenvío de la consulta ${fila.id}`);
    }
  }
}

function avisarAVentas(env: Env, c: Consulta, id: number, reenvio = false): Promise<void> {
  return enviar(env, {
    para: [env.CORREO_DESTINO],
    responderA: { address: c.correo, name: c.nombre },
    // "[Reenvío]": el primer intento pudo haber llegado tarde, o el visitante
    // reenviar a mano; así ventas reconoce el posible duplicado por el n.°.
    asunto: `${reenvio ? '[Reenvío] ' : ''}Consulta web — ${c.servicio} — ${c.nombre}`,
    ...avisoAVentas(c, id),
  });
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
