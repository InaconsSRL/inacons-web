/**
 * Ruta "/canal": los seis formularios del Canal Ético de /canal-etico/.
 *
 * Cada tipo de reporte llega solo a sus responsables (TIPOS). Se puede
 * reportar con nombre o de forma anónima; en el anónimo no viaja ni se
 * guarda nada que identifique a quien reporta: la fila no lleva IP ni hash,
 * el límite de envíos se cuenta en memoria (binding LIMITE_CANAL) y la IP no
 * se manda a Turnstile.
 */

import {
  CONDICION_PENDIENTES, CORREO_VALIDO, enviar, escapar, fechaValida, leerCampos, limpiarOrigen, nombreValido, saturado,
  tablaHtml, type Env, type Respuesta,
} from './comun';

// La clave es el contrato con el sitio: es el value del <select> de
// canal-etico.astro. El título y los destinatarios solo viven aquí.
export const TIPOS = {
  consulta: { titulo: 'Canal de Consultas', destino: ['ventas@inacons.com.pe'] },
  denuncia: { titulo: 'Canal de Denuncias', destino: ['oficialdecumplimiento@inacons.com.pe'] },
  sugerencia: { titulo: 'Canal de Sugerencias', destino: ['sig@inacons.com.pe'] },
  'buenas-practicas': { titulo: 'Reporte de Buenas Prácticas', destino: ['tbalbin@inacons.com.pe'] },
  queja: { titulo: 'Reporte de Quejas', destino: ['oficialdecumplimiento@inacons.com.pe'] },
  'acto-subestandar': { titulo: 'Actos y Condiciones Subestándar', destino: ['tbalbin@inacons.com.pe'] },
} as const;
type Tipo = keyof typeof TIPOS;

type Reporte = {
  tipo: string;
  modalidad: string;
  nombre: string;
  correo: string;
  telefono: string;
  relacion: string;
  lugar: string;
  fecha: string;
  personas: string;
  descripcion: string;
  origen: string;
};

// Los mismos maxlength que el formulario del sitio.
const LIMITES: Record<keyof Reporte, number> = {
  tipo: 40,
  modalidad: 10,
  nombre: 120,
  correo: 160,
  telefono: 30,
  relacion: 60,
  lugar: 200,
  fecha: 10,
  personas: 500,
  descripcion: 5000,
  origen: 300,
};

// El límite (5 por minuto por conexión, en wrangler.jsonc) es alto a
// propósito: en una oficina o una obra todos salen a internet por la misma IP,
// y un tope bajo dejaría a un trabajador sin poder denunciar porque otros
// reportaron antes. Turnstile ya frena a los bots; esto solo corta un abuso
// evidente.
export const IP_A_TURNSTILE = false;
export const ACCION_TURNSTILE = 'canal';

// Acuses por correo y hora. El reporte se guarda y se avisa a los responsables
// igual; lo que se calla es la cortesía hacia quien lo envía, para que el
// acuse no sirva de megáfono hacia un tercero. En la modalidad con nombre el
// correo ya está en la fila del reporte, así que contarlo no toca el anonimato.
const MAXIMO_ACUSES_POR_HORA = 3;

// Sin 0/O ni 1/I: el código se dicta por teléfono o se copia a mano.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function validar(cuerpo: Record<string, unknown>): (Reporte & { tipo: Tipo }) | null {
  const r = leerCampos({ ...cuerpo, origen: limpiarOrigen(cuerpo.origen) }, LIMITES);
  if (!r || !Object.hasOwn(TIPOS, r.tipo) || !r.descripcion) return null;
  if (r.fecha && !fechaValida(r.fecha)) return null;

  if (r.modalidad === 'anonimo') {
    // Lo que el navegador no debería mandar en anónimo, se descarta igual.
    r.nombre = r.correo = r.telefono = '';
  } else if (r.modalidad === 'nombre') {
    // El tope de acuses compara correos: Ana@ y ANA@ son el mismo buzón.
    r.correo = r.correo.toLowerCase();
    if (!r.nombre || !nombreValido(r.nombre) || !CORREO_VALIDO.test(r.correo)) return null;
  } else {
    return null;
  }
  return r as Reporte & { tipo: Tipo };
}

export async function procesar(reporte: Reporte & { tipo: Tipo }, env: Env, ipHash: string, ctx: ExecutionContext): Promise<Respuesta> {
  const { success } = await env.LIMITE_CANAL.limit({ key: ipHash });
  if (!success) return { status: 429, datos: { ok: false, error: 'limite' } };
  if (await saturado(env, 'reportes')) return { status: 503, datos: { ok: false, error: 'saturado' } };

  const { titulo, destino } = TIPOS[reporte.tipo];
  const codigo = nuevoCodigo();
  const identificado = reporte.modalidad === 'nombre';

  // Antes del INSERT, para no contar el reporte que se está procesando.
  let conAcuse = false;
  if (identificado) {
    const { recientes } = (await env.DB.prepare(
      `SELECT COUNT(*) AS recientes FROM reportes
       WHERE modalidad = 'nombre' AND correo = ?1 AND creado > datetime('now', '-1 hour')`,
    ).bind(reporte.correo).first<{ recientes: number }>())!;
    conAcuse = recientes < MAXIMO_ACUSES_POR_HORA;
  }

  // Se guarda antes de enviar: si CPaaS falla, el reporte no se pierde.
  const { id } = (await env.DB.prepare(
    `INSERT INTO reportes (codigo, tipo, modalidad, nombre, correo, telefono, relacion, lugar,
                           fecha_hecho, personas, descripcion, origen, destino)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13) RETURNING id`,
  ).bind(
    codigo, reporte.tipo, reporte.modalidad, reporte.nombre, reporte.correo, reporte.telefono,
    reporte.relacion, reporte.lugar, reporte.fecha, reporte.personas, reporte.descripcion,
    reporte.origen, destino.join(', '),
  ).first<{ id: number }>())!;

  try {
    await avisarResponsables(env, reporte, titulo, [...destino], codigo);
  } catch (e) {
    await marcar(env, id, 'error', String(e));
    console.error(`canal: falló el aviso del reporte ${id}`);
    return { status: 502, datos: { ok: false, error: 'envio' } };
  }

  // Con el aviso en manos de los responsables la respuesta ya es 200 con el
  // código: marcar la fila y el acuse siguen después de contestar. Antes se
  // esperaban aquí, y un acuse lento podía llevar al navegador a los 10 s y
  // mostrar un error; quien reportaba de forma anónima reenviaba y perdía el
  // código del primero.
  ctx.waitUntil(despuesDelAviso(env, id, conAcuse ? reporte : null, titulo, codigo));
  return { status: 200, datos: { ok: true, codigo } };
}

async function despuesDelAviso(env: Env, id: number, paraAcuse: Reporte | null, titulo: string, codigo: string): Promise<void> {
  try {
    await marcar(env, id, 'notificado');
  } catch {
    // Queda en 'recibido' y el cron lo reenvía: mejor un aviso repetido que perdido.
    console.error(`canal: no se pudo marcar el reporte ${id}`);
  }
  if (!paraAcuse || env.ENVIAR_ACUSE !== 'si') return;
  try {
    await enviar(env, {
      para: [paraAcuse.correo],
      asunto: `Recibimos tu reporte ${codigo} — INACONS`,
      ...acuse(paraAcuse, titulo, codigo),
    });
  } catch (e) {
    await marcar(env, id, 'notificado', `acuse: ${e}`).catch(() => {});
  }
}

type FilaReporte = Omit<Reporte, 'fecha'> & {
  id: number; codigo: string; fecha_hecho: string; destino: string; estado: string; error: string | null;
};

/**
 * Vuelve a avisar a los responsables de los reportes que no les llegaron (ver
 * CONDICION_PENDIENTES). Lo llama el cron. Una denuncia guardada que nadie
 * recibe es el peor fallo del canal: antes solo quedaba un console.error.
 * Sin acuse: quien reportó ya vio el error en su momento.
 */
export async function reintentarPendientes(env: Env): Promise<void> {
  const { results } = await env.DB.prepare(
    `SELECT id, codigo, tipo, modalidad, nombre, correo, telefono, relacion, lugar, fecha_hecho,
            personas, descripcion, origen, destino, estado, error
     FROM reportes WHERE ${CONDICION_PENDIENTES}`,
  ).all<FilaReporte>();
  for (const fila of results) {
    // Si el tipo ya no existe se avisa a quienes figuraban cuando se guardó.
    const { titulo, destino } = Object.hasOwn(TIPOS, fila.tipo)
      ? TIPOS[fila.tipo as Tipo]
      : { titulo: fila.tipo, destino: fila.destino.split(', ') };
    try {
      await avisarResponsables(env, { ...fila, fecha: fila.fecha_hecho }, titulo, [...destino], fila.codigo, true);
      await marcar(env, fila.id, 'notificado', `reenviado por el cron; antes ${fila.estado}${fila.error ? `: ${fila.error}` : ''}`.slice(0, 1000));
    } catch (e) {
      await marcar(env, fila.id, 'error', String(e));
      console.error(`canal: falló el reenvío del reporte ${fila.id}`);
    }
  }
}

function avisarResponsables(env: Env, r: Reporte, titulo: string, destino: string[], codigo: string, reenvio = false): Promise<void> {
  return enviar(env, {
    para: destino,
    ...(r.modalidad === 'nombre' ? { responderA: { address: r.correo, name: r.nombre } } : {}),
    // Sin el nombre en el asunto: los asuntos se ven en listados y avisos
    // del móvil, y una denuncia no debería delatar a nadie desde ahí.
    // "[Reenvío]": el primero pudo llegar tarde; el código delata el duplicado.
    asunto: `${reenvio ? '[Reenvío] ' : ''}Canal Ético — ${titulo} — ${codigo}`,
    ...aviso(r, titulo, codigo),
  });
}

function nuevoCodigo(): string {
  const azar = crypto.getRandomValues(new Uint8Array(8));
  const letras = [...azar].map((b) => ALFABETO[b % ALFABETO.length]).join('');
  return `CE-${letras.slice(0, 4)}-${letras.slice(4)}`;
}

function aviso(r: Reporte, titulo: string, codigo: string) {
  const filas: [string, string][] = [
    ['Código', codigo],
    ['Tipo', titulo],
    ['Modalidad', r.modalidad === 'anonimo' ? 'Anónimo' : 'Con nombre'],
    ...(r.modalidad === 'nombre'
      ? ([['Nombre', r.nombre], ['Correo', r.correo], ['Teléfono', r.telefono || '—']] as [string, string][])
      : []),
    ['Relación con INACONS', r.relacion || '—'],
    ['Lugar, obra o área', r.lugar || '—'],
    ['Fecha del hecho', r.fecha || '—'],
    ['Personas involucradas', r.personas || '—'],
  ];
  const pie = r.modalidad === 'anonimo'
    ? 'Reporte anónimo: no hay a quién responder. Si la persona vuelve a escribir, citará el código.'
    : 'Responde a este correo para contestar a quien reportó.';
  const texto = [
    `${titulo} — reporte ${codigo}`,
    '',
    ...filas.map(([k, v]) => `${k}: ${v}`),
    '',
    'Descripción:',
    r.descripcion,
    '',
    pie,
    'Información confidencial del Canal Ético de INACONS: no la reenvíes fuera de quienes la gestionan.',
  ].join('\n');
  const html = `
    <p><strong>${escapar(titulo)}</strong> — reporte <strong>${codigo}</strong></p>
    ${tablaHtml(filas)}
    <p style="color:#555">Descripción:</p>
    <p style="white-space:pre-wrap">${escapar(r.descripcion)}</p>
    <p style="color:#777;font-size:12px">${pie}<br>
    Información confidencial del Canal Ético de INACONS: no la reenvíes fuera de quienes la gestionan.</p>`;
  return { texto, html };
}

// No repite la descripción: el acuse llega a un buzón que quizá no es solo
// de quien reportó, y el detalle ya está en manos de los responsables.
function acuse(r: Reporte, titulo: string, codigo: string) {
  const texto = [
    `Hola, ${r.nombre}:`,
    '',
    `Recibimos tu reporte en el ${titulo} de INACONS. Su código es ${codigo}; consérvalo para cualquier comunicación sobre este caso.`,
    '',
    'Será atendido de forma confidencial por las personas responsables.',
    '',
    'INACONS S.R.L.',
  ].join('\n');
  const html = `
    <p>Hola, ${escapar(r.nombre)}:</p>
    <p>Recibimos tu reporte en el <strong>${escapar(titulo)}</strong> de INACONS.
    Su código es <strong>${codigo}</strong>; consérvalo para cualquier comunicación sobre este caso.</p>
    <p>Será atendido de forma confidencial por las personas responsables.</p>
    <p>INACONS S.R.L.</p>`;
  return { texto, html };
}

async function marcar(env: Env, id: number, estado: string, error: string | null = null) {
  await env.DB.prepare('UPDATE reportes SET estado = ?1, error = ?2 WHERE id = ?3').bind(estado, error, id).run();
}
