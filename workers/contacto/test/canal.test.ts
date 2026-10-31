import { afterEach, describe, expect, it, vi } from 'vitest';
import { procesar, reintentarPendientes, validar } from '../src/canal';
import { entorno, redFalsa, type OpcionesEntorno } from './simulado';

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

  it('rechaza una fecha que no es AAAA-MM-DD o que no existe', () => {
    expect(validar({ ...base, fecha: '01/10/2026' })).toBeNull();
    expect(validar({ ...base, fecha: '2026-13-45' })).toBeNull();
    expect(validar({ ...base, fecha: '2026-10-01' })).not.toBeNull();
  });

  it('con nombre exige nombre y un correo válido', () => {
    expect(validar(conNombre)).not.toBeNull();
    expect(validar({ ...conNombre, nombre: '' })).toBeNull();
    expect(validar({ ...conNombre, correo: 'mal' })).toBeNull();
  });

  it('con nombre rechaza un nombre con enlace, dominio o arroba', () => {
    expect(validar({ ...conNombre, nombre: 'https://malo.example' })).toBeNull();
    expect(validar({ ...conNombre, nombre: 'entra a bit.ly/x' })).toBeNull();
    expect(validar({ ...conNombre, nombre: 'ana@malo.example' })).toBeNull();
  });

  it('pasa el correo a minúsculas: el tope de acuses compara correos', () => {
    expect(validar({ ...conNombre, correo: 'Ana@Empresa.PE' })?.correo).toBe('ana@empresa.pe');
  });

  it('guarda la página de origen sin query, aunque sea larga', () => {
    const origen = 'https://home.inacons.com.pe/canal-etico/?obra=pucusana&fbclid=' + 'x'.repeat(400);
    expect(validar({ ...base, origen })?.origen).toBe('https://home.inacons.com.pe/canal-etico/');
  });
});

describe('canal.procesar', () => {
  afterEach(() => vi.unstubAllGlobals());

  async function enviarReporte(reporte: Record<string, unknown>, opciones: OpcionesEntorno = {}, cpaas?: number) {
    const red = redFalsa({ cpaas });
    const e = entorno(opciones);
    const respuesta = await procesar(validar(reporte)!, e.env, 'hash', e.ctx);
    const antesDeResponder = red.correos.length;
    await e.despues();
    return { respuesta, antesDeResponder, ...red, ...e };
  }

  it('con nombre y pocos acuses recientes: avisa antes de responder y acusa recibo después', async () => {
    const { respuesta, antesDeResponder, correos, estados } = await enviarReporte(conNombre, { recientes: 0 });
    expect(respuesta.status).toBe(200);
    expect(respuesta.datos.codigo).toMatch(/^CE-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(antesDeResponder).toBe(1);
    expect(correos.map((c) => c.para[0])).toEqual(['oficialdecumplimiento@inacons.com.pe', 'ana@empresa.pe']);
    expect(estados()).toContain('notificado');
  });

  it('con nombre y el tope alcanzado: guarda y avisa, pero no manda el acuse', async () => {
    const { respuesta, correos } = await enviarReporte(conNombre, { recientes: 3 });
    expect(respuesta.status).toBe(200);
    expect(correos).toHaveLength(1);
  });

  it('anónimo: solo avisa, y no consulta nada por correo', async () => {
    const { respuesta, correos, sentencias } = await enviarReporte(base);
    expect(respuesta.status).toBe(200);
    expect(correos).toHaveLength(1);
    expect(sentencias.some((s) => s.sql.includes('correo = ?1'))).toBe(false);
  });

  it('el asunto lleva tipo y código, nunca el nombre', async () => {
    const { correos } = await enviarReporte(conNombre);
    expect(correos[0].asunto).toMatch(/^Canal Ético — Canal de Denuncias — CE-/);
    expect(correos[0].asunto).not.toContain('Ana');
  });

  it('si CPaaS falla: 502 y la fila queda en error para el cron', async () => {
    const { respuesta, estados } = await enviarReporte(base, {}, 500);
    expect(respuesta.status).toBe(502);
    expect(estados()).toEqual(['error']);
  });

  it('con el tope diario lleno: 503, sin guardar ni avisar', async () => {
    const { respuesta, correos, sentencias } = await enviarReporte(base, { total: 100 });
    expect(respuesta).toEqual({ status: 503, datos: { ok: false, error: 'saturado' } });
    expect(correos).toHaveLength(0);
    expect(sentencias.some((s) => s.sql.includes('INSERT'))).toBe(false);
  });

  it('con el límite en memoria agotado: 429', async () => {
    const { respuesta } = await enviarReporte(base, { limiteCanal: false });
    expect(respuesta.status).toBe(429);
  });
});

describe('canal.reintentarPendientes', () => {
  afterEach(() => vi.unstubAllGlobals());

  const fila = {
    id: 3, codigo: 'CE-ABCD-EFGH', tipo: 'denuncia', modalidad: 'anonimo', nombre: '', correo: '', telefono: '',
    relacion: '', lugar: 'Obra Pucusana', fecha_hecho: '2026-10-01', personas: '', descripcion: 'Hecho.',
    origen: '', destino: 'oficialdecumplimiento@inacons.com.pe', estado: 'error', error: 'CPaaS 500',
  };

  it('reenvía a los responsables con [Reenvío] y marca la fila', async () => {
    const { correos } = redFalsa();
    const e = entorno({ pendientes: [fila] });
    await reintentarPendientes(e.env);
    expect(correos).toHaveLength(1);
    expect(correos[0].para).toEqual(['oficialdecumplimiento@inacons.com.pe']);
    expect(correos[0].asunto).toBe('[Reenvío] Canal Ético — Canal de Denuncias — CE-ABCD-EFGH');
    expect(correos[0].texto).toContain('Fecha del hecho: 2026-10-01');
    expect(e.estados()).toEqual(['notificado']);
  });

  it('con un tipo que ya no existe, avisa a quienes figuraban al guardarlo', async () => {
    const { correos } = redFalsa();
    const e = entorno({ pendientes: [{ ...fila, tipo: 'retirado', destino: 'a@inacons.com.pe, b@inacons.com.pe' }] });
    await reintentarPendientes(e.env);
    expect(correos[0].para).toEqual(['a@inacons.com.pe', 'b@inacons.com.pe']);
  });

  it('si vuelve a fallar, la deja en error para la próxima pasada', async () => {
    redFalsa({ cpaas: 500 });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const e = entorno({ pendientes: [fila] });
    await reintentarPendientes(e.env);
    expect(e.estados()).toEqual(['error']);
  });
});
