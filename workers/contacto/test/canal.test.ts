import { afterEach, describe, expect, it, vi } from 'vitest';
import { procesar, validar } from '../src/canal';
import type { Env } from '../src/comun';

const base = { tipo: 'denuncia', modalidad: 'anonimo', descripcion: 'Descripción del hecho.' };
const conNombre = { ...base, modalidad: 'nombre', nombre: 'Ana Ríos', correo: 'ana@empresa.pe' };

describe('canal.validar', () => {
  it('descarta nombre, correo y teléfono en un reporte anónimo', () => {
    const r = validar({ ...base, nombre: 'Ana', correo: 'a@b.pe', telefono: '1' });
    expect(r).toMatchObject({ modalidad: 'anonimo', nombre: '', correo: '', telefono: '' });
  });

  it('rechaza un tipo desconocido', () => {
    expect(validar({ ...base, tipo: 'otro' })).toBeNull();
  });

  it('rechaza una modalidad desconocida', () => {
    expect(validar({ ...base, modalidad: 'secreto' })).toBeNull();
  });

  it('exige descripción', () => {
    expect(validar({ ...base, descripcion: '' })).toBeNull();
  });

  it('rechaza una fecha que no es AAAA-MM-DD', () => {
    expect(validar({ ...base, fecha: '01/10/2026' })).toBeNull();
    expect(validar({ ...base, fecha: '2026-10-01' })).not.toBeNull();
  });

  it('con nombre exige nombre y un correo válido', () => {
    expect(validar(conNombre)).not.toBeNull();
    expect(validar({ ...conNombre, nombre: '' })).toBeNull();
    expect(validar({ ...conNombre, correo: 'mal' })).toBeNull();
  });

  it('con nombre rechaza un nombre con enlace o arroba', () => {
    expect(validar({ ...conNombre, nombre: 'https://malo.example' })).toBeNull();
    expect(validar({ ...conNombre, nombre: 'ana@malo.example' })).toBeNull();
  });
});

// Un D1 y un CPaaS de mentira: lo que se comprueba es cuántos correos salen y
// si se consulta por correo en un reporte anónimo, no la base ni la red.
function entorno(acusesRecientes: number) {
  const sentencias: string[] = [];
  const DB = {
    prepare(sql: string) {
      sentencias.push(sql);
      return {
        bind: () => ({
          first: async () => (sql.includes('COUNT(*)') ? { recientes: acusesRecientes } : { id: 1 }),
          run: async () => ({}),
        }),
      };
    },
  };
  const env = {
    DB,
    LIMITE_CANAL: { limit: async () => ({ success: true }) },
    CPAAS_URL: 'https://cpaas.invalid/v1.1/email',
    CPAAS_TOKEN: 'token',
    CORREO_REMITENTE: 'noreply@inacons.com.pe',
    ENVIAR_ACUSE: 'si',
  } as unknown as Env;
  return { env, sentencias };
}

describe('canal.procesar: acuse por correo', () => {
  afterEach(() => vi.unstubAllGlobals());

  async function correosEnviados(reporte: Record<string, unknown>, acusesRecientes: number) {
    const fetchFalso = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchFalso);
    const { env, sentencias } = entorno(acusesRecientes);
    const respuesta = await procesar(validar(reporte)!, env, 'hash');
    return { respuesta, enviados: fetchFalso.mock.calls.length, sentencias };
  }

  it('con nombre y pocos acuses recientes: avisa a los responsables y acusa recibo', async () => {
    const { respuesta, enviados } = await correosEnviados(conNombre, 0);
    expect(respuesta.status).toBe(200);
    expect(enviados).toBe(2);
  });

  it('con nombre y el tope alcanzado: guarda y avisa, pero no manda el acuse', async () => {
    const { respuesta, enviados } = await correosEnviados(conNombre, 3);
    expect(respuesta.status).toBe(200);
    expect(enviados).toBe(1);
  });

  it('anónimo: solo avisa, y no consulta nada por correo', async () => {
    const { respuesta, enviados, sentencias } = await correosEnviados(base, 0);
    expect(respuesta.status).toBe(200);
    expect(enviados).toBe(1);
    expect(sentencias.some((s) => s.includes('COUNT(*)'))).toBe(false);
  });
});
