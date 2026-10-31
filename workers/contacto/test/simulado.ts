/**
 * D1, CPaaS, Turnstile y contexto de ejecución de mentira. Lo que se comprueba
 * en las pruebas es qué sentencias se ejecutan, qué correos salen y qué queda
 * para después de responder; no la base ni la red.
 */
import { vi } from 'vitest';
import type { Env } from '../src/comun';

export type Sentencia = { sql: string; params: unknown[] };

export type OpcionesEntorno = {
  /** Lo que devuelve un COUNT(*) AS recientes (límite por hora o de acuses). */
  recientes?: number;
  /** Lo que devuelve el COUNT(*) AS total del tope diario. */
  total?: number;
  /** Filas que devuelve la consulta de pendientes del cron. */
  pendientes?: Record<string, unknown>[];
  /** Si el límite en memoria del Canal deja pasar. */
  limiteCanal?: boolean;
  /** Toda sentencia lanza, como un D1 caído. */
  fallaDB?: boolean;
  RETENCION_MESES?: string;
};

export function entorno(o: OpcionesEntorno = {}) {
  const sentencias: Sentencia[] = [];
  const respuesta = (sql: string) =>
    sql.includes('AS total') ? { total: o.total ?? 0 }
    : sql.includes('AS recientes') ? { recientes: o.recientes ?? 0 }
    : { id: 7 };
  const DB = {
    prepare(sql: string) {
      if (o.fallaDB) throw new Error('D1_ERROR: simulado');
      const sentencia = (params: unknown[]) => ({
        first: async () => (sentencias.push({ sql, params }), respuesta(sql)),
        run: async () => (sentencias.push({ sql, params }), {}),
        all: async () => (sentencias.push({ sql, params }), { results: sql.includes("estado IN") ? (o.pendientes ?? []) : [] }),
      });
      return { ...sentencia([]), bind: (...params: unknown[]) => sentencia(params) };
    },
  };
  const env = {
    DB,
    LIMITE_CANAL: { limit: async () => ({ success: o.limiteCanal ?? true }) },
    CPAAS_URL: 'https://cpaas.invalid/v1.1/email',
    CPAAS_TOKEN: 'token',
    TURNSTILE_SECRET: 'secreto-de-produccion',
    IP_SALT: 'sal',
    ORIGENES: 'https://home.inacons.com.pe',
    CORREO_DESTINO: 'ventas@inacons.com.pe',
    CORREO_REMITENTE: 'noreply@inacons.com.pe',
    ENVIAR_ACUSE: 'si',
    RETENCION_MESES: o.RETENCION_MESES ?? '12',
  } as unknown as Env;

  // waitUntil guarda las promesas: `despues()` las espera, como haría
  // Cloudflare tras enviar la respuesta.
  const enCola: Promise<unknown>[] = [];
  const ctx = { waitUntil: (p: Promise<unknown>) => enCola.push(p), passThroughOnException() {} } as unknown as ExecutionContext;
  const despues = () => Promise.all(enCola);

  /** Las sentencias UPDATE con el estado que dejaron en la fila. */
  const estados = () => sentencias.filter((s) => s.sql.startsWith('UPDATE')).map((s) => s.params[0]);

  return { env, ctx, despues, sentencias, estados };
}

export type OpcionesRed = {
  /** Respuesta de siteverify. Por defecto, un token válido del formulario de contacto. */
  turnstile?: Record<string, unknown> | 'caido';
  /** Status con que responde CPaaS. */
  cpaas?: number;
};

export function redFalsa(o: OpcionesRed = {}) {
  const correos: { para: string[]; asunto: string; texto: string; senal: unknown }[] = [];
  const fetchFalso = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).includes('siteverify')) {
      if (o.turnstile === 'caido') throw new TypeError('fetch failed');
      return Response.json(o.turnstile ?? { success: true, hostname: 'home.inacons.com.pe', action: 'contacto' });
    }
    const cuerpo = JSON.parse(String(init?.body));
    correos.push({
      para: cuerpo.to.map((t: { email_address: { address: string } }) => t.email_address.address),
      asunto: cuerpo.subject,
      texto: cuerpo.textbody,
      senal: init?.signal,
    });
    return new Response('{}', { status: o.cpaas ?? 200 });
  });
  vi.stubGlobal('fetch', fetchFalso);
  return { fetchFalso, correos };
}
