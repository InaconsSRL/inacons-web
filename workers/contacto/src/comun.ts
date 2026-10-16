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
// noreply@inacons.com.pe. El acuse lleva el nombre dentro del saludo.
const NOMBRE_SOSPECHOSO = /:\/\/|www\.|@|[\r\n]/i;
export const nombreValido = (nombre: string): boolean => !NOMBRE_SOSPECHOSO.test(nombre);

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

/**
 * false = el token no vale (el visitante repite el desafío). Si Cloudflare no
 * contesta lanza VerificacionNoDisponible, que index.ts convierte en un 503:
 * devolver false aquí sería un 403 que culpa al visitante de un fallo ajeno.
 */
export async function turnstileValido(token: string, ip: string, secreto: string): Promise<boolean> {
  if (!token) return false;
  const datos = new FormData();
  datos.append('secret', secreto);
  datos.append('response', token);
  if (ip) datos.append('remoteip', ip);
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: datos,
      signal: AbortSignal.timeout(5000),
    });
    const resultado = await r.json<{ success: boolean }>();
    return resultado.success === true;
  } catch {
    throw new VerificacionNoDisponible();
  }
}

export type Destinatario = { address: string; name?: string };

export type Correo = {
  para: string[];
  responderA?: Destinatario;
  asunto: string;
  texto: string;
  html: string;
};

export async function enviar(env: Env, c: Correo): Promise<void> {
  const r = await fetch(env.CPAAS_URL, {
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
