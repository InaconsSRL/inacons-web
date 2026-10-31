/**
 * index.ts: CORS, códigos de error, reparto por ruta y cron. Cada respuesta
 * que el formulario tiene que leer debe salir con CORS: sin él, el navegador la
 * muestra como un corte de red y no como lo que es.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { entorno, redFalsa, type OpcionesEntorno } from './simulado';

const SITIO = 'https://home.inacons.com.pe';
const consulta = {
  nombre: 'María López', correo: 'maria@empresa.pe', telefono: '999 888 777',
  servicio: 'Obras Civiles', mensaje: 'Cotización.', turnstile: 'token',
};

function peticion(o: { metodo?: string; origen?: string; ruta?: string; tipo?: string; cuerpo?: string } = {}) {
  const cabeceras: Record<string, string> = { Origin: o.origen ?? SITIO, 'CF-Connecting-IP': '203.0.113.5' };
  if (o.metodo !== 'OPTIONS' && o.metodo !== 'GET') cabeceras['Content-Type'] = o.tipo ?? 'application/json';
  return new Request(`https://inacons-contacto.example.workers.dev${o.ruta ?? '/'}`, {
    method: o.metodo ?? 'POST',
    headers: cabeceras,
    body: o.metodo === 'OPTIONS' || o.metodo === 'GET' ? undefined : (o.cuerpo ?? JSON.stringify(consulta)),
  });
}

async function llamar(req: Request, opciones: OpcionesEntorno = {}) {
  const e = entorno(opciones);
  // El tipo de fetch espera las propiedades `cf` de Cloudflare, que una Request de Node no trae.
  const respuesta = await worker.fetch!(req as Parameters<NonNullable<typeof worker.fetch>>[0], e.env, e.ctx);
  await e.despues();
  return { respuesta, cuerpo: await respuesta.json().catch(() => null), ...e };
}

describe('index.fetch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('rechaza un origen que no está en ORIGENES, sin CORS', async () => {
    const { respuesta } = await llamar(peticion({ metodo: 'OPTIONS', origen: 'http://localhost:4321' }));
    expect(respuesta.status).toBe(403);
    expect(respuesta.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('responde el preflight del sitio con CORS', async () => {
    const { respuesta } = await llamar(peticion({ metodo: 'OPTIONS' }));
    expect(respuesta.status).toBe(204);
    expect(respuesta.headers.get('Access-Control-Allow-Origin')).toBe(SITIO);
  });

  it.each([
    ['GET', { metodo: 'GET' }, 405],
    ['texto plano', { tipo: 'text/plain' }, 415],
    ['JSON roto', { cuerpo: '{"nombre":' }, 400],
    ['JSON que no es objeto', { cuerpo: '[1,2]' }, 400],
    ['ruta desconocida', { ruta: '/otra' }, 404],
  ])('%s → %i con CORS', async (_caso, o, status) => {
    redFalsa();
    const { respuesta } = await llamar(peticion(o));
    expect(respuesta.status).toBe(status);
    expect(respuesta.headers.get('Access-Control-Allow-Origin')).toBe(SITIO);
  });

  it('un cuerpo de más de 32 KB → 413', async () => {
    const { respuesta } = await llamar(peticion({ cuerpo: JSON.stringify({ ...consulta, mensaje: 'x'.repeat(40_000) }) }));
    expect(respuesta.status).toBe(413);
  });

  it('una consulta válida → 200, con aviso y acuse', async () => {
    const { correos } = redFalsa();
    const { respuesta, cuerpo } = await llamar(peticion());
    expect(respuesta.status).toBe(200);
    expect(cuerpo).toEqual({ ok: true });
    expect(correos).toHaveLength(2);
  });

  it('un token del formulario del Canal no sirve para contacto → 403', async () => {
    redFalsa({ turnstile: { success: true, hostname: 'home.inacons.com.pe', action: 'canal' } });
    const { respuesta, cuerpo } = await llamar(peticion());
    expect(respuesta.status).toBe(403);
    expect(cuerpo).toEqual({ ok: false, error: 'verificacion' });
  });

  it('si Turnstile no responde → 503 con CORS', async () => {
    redFalsa({ turnstile: 'caido' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { respuesta } = await llamar(peticion());
    expect(respuesta.status).toBe(503);
    expect(respuesta.headers.get('Access-Control-Allow-Origin')).toBe(SITIO);
  });

  it('un fallo de D1 → 500 con CORS, sin datos del envío en el log', async () => {
    redFalsa();
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { respuesta, cuerpo } = await llamar(peticion(), { fallaDB: true });
    expect(respuesta.status).toBe(500);
    expect(respuesta.headers.get('Access-Control-Allow-Origin')).toBe(SITIO);
    expect(cuerpo).toEqual({ ok: false, error: 'interno' });
    expect(JSON.stringify(log.mock.calls)).not.toContain('maria@empresa.pe');
  });

  it('el Canal valida con su propia action', async () => {
    redFalsa({ turnstile: { success: true, hostname: 'home.inacons.com.pe', action: 'canal' } });
    const reporte = { tipo: 'denuncia', modalidad: 'anonimo', descripcion: 'Hecho.', turnstile: 'token' };
    const { respuesta, cuerpo } = await llamar(peticion({ ruta: '/canal', cuerpo: JSON.stringify(reporte) }));
    expect(respuesta.status).toBe(200);
    expect(cuerpo).toMatchObject({ ok: true, codigo: expect.stringMatching(/^CE-/) });
  });
});

describe('index.scheduled', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function correrCron(opciones: OpcionesEntorno = {}) {
    const e = entorno(opciones);
    await worker.scheduled!({} as ScheduledController, e.env);
    return e;
  }

  it('reintenta los pendientes de las dos tablas y purga las consultas vencidas', async () => {
    redFalsa();
    const { sentencias } = await correrCron();
    const sql = sentencias.map((s) => s.sql);
    expect(sql.filter((s) => s.includes("estado IN"))).toHaveLength(2);
    const purga = sentencias.find((s) => s.sql.startsWith('DELETE'));
    expect(purga?.params).toEqual(['-12 months']);
  });

  it('vacía los hash de IP de más de una hora', async () => {
    redFalsa();
    const { sentencias } = await correrCron();
    expect(sentencias.some((s) => s.sql.includes("SET ip_hash = ''") && s.sql.includes("'-1 hour'"))).toBe(true);
  });

  it('con RETENCION_MESES inválido no purga y lo registra', async () => {
    redFalsa();
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { sentencias } = await correrCron({ RETENCION_MESES: '-3' });
    expect(sentencias.some((s) => s.sql.startsWith('DELETE'))).toBe(false);
    expect(log).toHaveBeenCalled();
  });
});
