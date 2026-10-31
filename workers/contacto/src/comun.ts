/** Lo que comparten las rutas del Worker: entorno, envío y utilidades. */

export interface Env {
  DB: D1Database;
  LIMITE_CANAL: RateLimit;
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

/** Lo que devuelve cada ruta; index.ts le agrega CORS y lo serializa. */
export type Respuesta = { status: number; datos: Record<string, unknown> };

export const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Un nombre con enlace, dominio, arroba o salto de línea no es un nombre: es
// alguien usando el acuse de recibo para mandar texto a un tercero desde
// noreply@inacons.com.pe. El acuse lleva el nombre dentro del saludo. El
// dominio suelto ("entra a bit.ly/x") también: los clientes de correo lo
// convierten en enlace. Los separadores de línea Unicode y el tabulador
// cuentan como salto porque el nombre va también en el asunto y el Reply-To.
const NOMBRE_SOSPECHOSO = /:\/\/|www\.|@|\/|\.[a-z]{2,}|[\r\n\t\x85\p{Zl}\p{Zp}]/iu;
export const nombreValido = (nombre: string): boolean => !NOMBRE_SOSPECHOSO.test(nombre);

/** AAAA-MM-DD y que exista en el calendario: la regex sola deja pasar 2026-13-45. */
export function fechaValida(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const d = new Date(`${fecha}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(fecha);
}

/**
 * La página desde la que se envió, sin query ni fragmento. Una URL con UTM y
 * gclid pasaba el límite y la consulta se perdía con un 400; y en un reporte
 * anónimo la query (un QR por obra, un fbclid) puede acotar quién escribe. El
 * sitio ya manda solo origen + ruta; esto cubre a quien tenga la página vieja
 * abierta. Se recorta en vez de rechazar: es un dato informativo.
 */
export function limpiarOrigen(valor: unknown): string {
  return typeof valor === 'string' ? valor.split(/[?#]/)[0].trim().slice(0, 300) : '';
}

/**
 * Lee del cuerpo solo los campos conocidos, recortados. Devuelve null si
 * alguno supera su límite: los límites son los maxlength del formulario,
 * así que eso solo pasa con un envío que no salió del navegador.
 */
export function leerCampos<K extends string>(
  cuerpo: Record<string, unknown>,
  limites: Record<K, number>,
): Record<K, string> | null {
  const campos = {} as Record<K, string>;
  for (const campo of Object.keys(limites) as K[]) {
    const valor = typeof cuerpo[campo] === 'string' ? (cuerpo[campo] as string).trim() : '';
    if (valor.length > limites[campo]) return null;
    campos[campo] = valor;
  }
  return campos;
}

/** Cloudflare no respondió a tiempo o respondió algo que no es JSON. */
export class VerificacionNoDisponible extends Error {}

/** Lo que tiene que traer un token válido además de `success`. */
export type TurnstileEsperado = {
  /** Hosts del sitio (los de ORIGENES): un token resuelto en otra página no sirve. */
  hosts: string[];
  /** La `action` del widget: un token del formulario de contacto no sirve para el Canal. */
  accion: string;
};

// Las claves secretas de prueba de Cloudflare (1x…, 2x…, 3x…) responden con un
// hostname y una action de ejemplo: con ellas solo se mira `success`.
const SECRETO_DE_PRUEBA = /^[123]x0{20,}/;

// Códigos que no son culpa del visitante sino de la configuración. Se
// registran (no contienen datos de nadie): un secret mal puesto daba 403 a
// todos los envíos sin dejar rastro.
const ERRORES_DE_CONFIGURACION = new Set(['missing-input-secret', 'invalid-input-secret', 'bad-request', 'internal-error']);

/**
 * false = el token no vale (el visitante repite el desafío). Si Cloudflare no
 * contesta lanza VerificacionNoDisponible, que index.ts convierte en un 503:
 * devolver false aquí sería un 403 que culpa al visitante de un fallo ajeno.
 */
export async function turnstileValido(token: string, ip: string, secreto: string, esperado: TurnstileEsperado): Promise<boolean> {
  if (!token) return false;
  const datos = new FormData();
  datos.append('secret', secreto);
  datos.append('response', token);
  if (ip) datos.append('remoteip', ip);
  let resultado: { success?: boolean; hostname?: string; action?: string; 'error-codes'?: string[] };
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: datos,
      signal: AbortSignal.timeout(5000),
    });
    resultado = await r.json();
  } catch {
    throw new VerificacionNoDisponible();
  }

  if (resultado.success !== true) {
    const codigos = resultado['error-codes'] ?? [];
    if (codigos.some((c) => ERRORES_DE_CONFIGURACION.has(c))) console.error(`Turnstile: ${codigos.join(', ')}`);
    return false;
  }
  if (SECRETO_DE_PRUEBA.test(secreto)) return true;
  return esperado.hosts.includes(resultado.hostname ?? '') && resultado.action === esperado.accion;
}

export type Destinatario = { address: string; name?: string };

export type Correo = {
  para: string[];
  responderA?: Destinatario;
  asunto: string;
  texto: string;
  html: string;
};

// El navegador espera 10 s y Turnstile ya puede haber gastado 5. Sin tope, un
// CPaaS lento hacía que el visitante viera un error aunque el aviso saliera
// después, y reenviaba: llegaba duplicado y, si era anónimo, perdía el código
// del primero. Con el tope el aviso se da por fallido, la fila queda en
// 'error' y el cron lo reintenta (reintentarPendientes).
const ESPERA_CPAAS_MS = 4000;

export async function enviar(env: Env, c: Correo): Promise<void> {
  const r = await fetch(env.CPAAS_URL, {
    signal: AbortSignal.timeout(ESPERA_CPAAS_MS),
    method: 'POST',
    headers: {
      Authorization: `Zoho-enczapikey ${env.CPAAS_TOKEN.replace(/^Zoho-enczapikey\s+/, '')}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      from: { address: env.CORREO_REMITENTE, name: 'Web INACONS' },
      to: c.para.map((address) => ({ email_address: { address } })),
      ...(c.responderA ? { reply_to: [c.responderA] } : {}),
      subject: c.asunto,
      textbody: c.texto,
      htmlbody: c.html,
    }),
  });
  if (!r.ok) throw new Error(`CPaaS ${r.status}: ${(await r.text()).slice(0, 500)}`);
}

// Tope de filas por día y por tabla, para todo el sitio. Los límites por IP o
// por correo no frenan a quien rota proxies con un solucionador de Turnstile:
// sin esto podía inundar el buzón de cumplimiento, esconder las denuncias
// reales entre el ruido y gastar el crédito de CPaaS. El tráfico real está muy
// por debajo; al llegar se responde 503 y queda un console.error como alerta.
const TOPE_DIARIO = 100;

export async function saturado(env: Env, tabla: 'consultas' | 'reportes'): Promise<boolean> {
  const fila = await env.DB.prepare(
    `SELECT COUNT(*) AS total FROM ${tabla} WHERE creado > datetime('now', '-1 day')`,
  ).first<{ total: number }>();
  const lleno = (fila?.total ?? 0) >= TOPE_DIARIO;
  if (lleno) console.error(`${tabla}: se alcanzó el tope de ${TOPE_DIARIO} envíos en 24 h`);
  return lleno;
}

/**
 * Filas cuyo aviso no salió: quedaron en 'error' (CPaaS falló o tardó) o en
 * 'recibido' (el Worker murió entre el INSERT y el envío). Los 15 minutos dejan
 * terminar a un envío en curso; pasados 7 días ya no se insiste y queda para
 * revisión manual (docs/deploy.md). Veinte por pasada: si CPaaS vuelve tras
 * una caída, los avisos atrasados no llegan todos a la vez.
 */
export const CONDICION_PENDIENTES = `estado IN ('recibido', 'error')
  AND creado < datetime('now', '-15 minutes') AND creado > datetime('now', '-7 days')
  ORDER BY id LIMIT 20`;

/** Filas etiqueta–valor del cuerpo HTML de un aviso, con los valores escapados. */
export function tablaHtml(filas: [string, string][]): string {
  return `<table cellpadding="6" style="border-collapse:collapse">
      ${filas.map(([k, v]) => `<tr><td style="color:#555">${k}</td><td><strong>${escapar(v)}</strong></td></tr>`).join('')}
    </table>`;
}

export async function sha256(texto: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function escapar(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}
