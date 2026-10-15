/**
 * Ruta "/canal": los seis formularios del Canal Ético de /canal-etico/.
 *
 * Cada tipo de reporte llega solo a sus responsables (TIPOS). Se puede
 * reportar con nombre o de forma anónima; en el anónimo no viaja ni se
 * guarda nada que identifique a quien reporta: la fila no lleva IP ni hash,
 * el límite de envíos se cuenta en memoria (binding LIMITE_CANAL) y la IP no
 * se manda a Turnstile.
 */

import { CORREO_VALIDO, enviar, escapar, leerCampos, tablaHtml, type Env, type Respuesta } from './comun';

// La clave es el contrato con el sitio: es el value del <select> de
// canal-etico.astro. El título y los destinatarios solo viven aquí.
const TIPOS = {
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

// Sin 0/O ni 1/I: el código se dicta por teléfono o se copia a mano.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function validar(cuerpo: Record<string, unknown>): (Reporte & { tipo: Tipo }) | null {
  const r = leerCampos(cuerpo, LIMITES);
  if (!r || !Object.hasOwn(TIPOS, r.tipo) || !r.descripcion) return null;
  if (r.fecha && !/^\d{4}-\d{2}-\d{2}$/.test(r.fecha)) return null;

  if (r.modalidad === 'anonimo') {
    // Lo que el navegador no debería mandar en anónimo, se descarta igual.
    r.nombre = r.correo = r.telefono = '';
  } else if (r.modalidad === 'nombre') {
    if (!r.nombre || !CORREO_VALIDO.test(r.correo)) return null;
  } else {
    return null;
  }
  return r as Reporte & { tipo: Tipo };
}

export async function procesar(reporte: Reporte & { tipo: Tipo }, env: Env, ipHash: string): Promise<Respuesta> {
  const { success } = await env.LIMITE_CANAL.limit({ key: ipHash });
  if (!success) return { status: 429, datos: { ok: false, error: 'limite' } };

  const { titulo, destino } = TIPOS[reporte.tipo];
  const codigo = nuevoCodigo();

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

  const identificado = reporte.modalidad === 'nombre';
  try {
    await enviar(env, {
      para: [...destino],
      ...(identificado ? { responderA: { address: reporte.correo, name: reporte.nombre } } : {}),
      // Sin el nombre en el asunto: los asuntos se ven en listados y avisos
      // del móvil, y una denuncia no debería delatar a nadie desde ahí.
      asunto: `Canal Ético — ${titulo} — ${codigo}`,
      ...aviso(reporte, titulo, codigo),
    });
  } catch (e) {
    await marcar(env, id, 'error', String(e));
    console.error(`canal: falló el aviso del reporte ${id}`);
    return { status: 502, datos: { ok: false, error: 'envio' } };
  }
  await marcar(env, id, 'notificado');

  if (identificado && env.ENVIAR_ACUSE === 'si') {
    try {
      await enviar(env, {
        para: [reporte.correo],
        asunto: `Recibimos tu reporte ${codigo} — INACONS`,
        ...acuse(reporte, titulo, codigo),
      });
    } catch (e) {
      await marcar(env, id, 'notificado', `acuse: ${e}`);
    }
  }

  return { status: 200, datos: { ok: true, codigo } };
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
