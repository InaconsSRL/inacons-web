import { afterEach, describe, expect, it, vi } from 'vitest';
import { procesar, reintentarPendientes, validar } from '../src/contacto';
import { entorno, redFalsa, type OpcionesEntorno } from './simulado';

const base = {
  nombre: 'María López',
  correo: 'maria@empresa.pe',
  telefono: '999 888 777',
  servicio: 'Obras Civiles',
  mensaje: 'Necesitamos cotizar un cerco perimétrico.',
};

describe('contacto.validar', () => {
  it('acepta una consulta completa; empresa y origen son opcionales', () => {
    expect(validar(base)).toMatchObject({ nombre: 'María López', empresa: '', origen: '' });
  });

  it.each(['nombre', 'correo', 'telefono', 'servicio', 'mensaje'])('exige %s', (campo) => {
    expect(validar({ ...base, [campo]: '' })).toBeNull();
  });

  it('rechaza un correo mal formado', () => {
    expect(validar({ ...base, correo: 'maria@empresa' })).toBeNull();
  });

  it('pasa el correo a minúsculas: el límite por hora compara correos', () => {
    expect(validar({ ...base, correo: 'Maria@Empresa.PE' })?.correo).toBe('maria@empresa.pe');
  });

  it('rechaza un servicio que no está en la lista', () => {
    expect(validar({ ...base, servicio: 'Cualquier cosa' })).toBeNull();
  });

  it('acepta "Otro"', () => {
    expect(validar({ ...base, servicio: 'Otro' })).not.toBeNull();
  });

  it('rechaza un nombre con enlace o dominio: el acuse lo repite en el saludo', () => {
    expect(validar({ ...base, nombre: 'Visita https://malo.example' })).toBeNull();
    expect(validar({ ...base, nombre: 'Tu cuenta vence, entra a bit.ly/x' })).toBeNull();
  });

  it('rechaza un campo que pasa su límite', () => {
    expect(validar({ ...base, mensaje: 'x'.repeat(3001) })).toBeNull();
  });

  it('un origen con UTM largos ya no rechaza la consulta: se guarda sin query', () => {
    const origen = 'https://home.inacons.com.pe/contacto/?utm_source=x&gclid=' + 'y'.repeat(400);
    expect(validar({ ...base, origen })?.origen).toBe('https://home.inacons.com.pe/contacto/');
  });
});

describe('contacto.procesar', () => {
  afterEach(() => vi.unstubAllGlobals());

  async function enviarConsulta(opciones: OpcionesEntorno = {}, cpaas?: number) {
    const red = redFalsa({ cpaas });
    const e = entorno(opciones);
    const respuesta = await procesar(validar(base)!, e.env, 'hash', e.ctx);
    const antesDeResponder = red.correos.length;
    await e.despues();
    return { respuesta, antesDeResponder, ...red, ...e };
  }

  it('avisa a ventas antes de responder; el acuse y la marca van después', async () => {
    const { respuesta, antesDeResponder, correos, estados } = await enviarConsulta();
    expect(respuesta).toEqual({ status: 200, datos: { ok: true } });
    expect(antesDeResponder).toBe(1);
    expect(correos.map((c) => c.para[0])).toEqual(['ventas@inacons.com.pe', 'maria@empresa.pe']);
    expect(estados()).toEqual(['notificado']);
  });

  it('el envío a CPaaS lleva tiempo límite', async () => {
    const { correos } = await enviarConsulta();
    expect(correos[0].senal).toBeInstanceOf(AbortSignal);
  });

  it('si CPaaS falla: 502, sin acuse, y la fila queda en error para el cron', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { respuesta, correos, estados } = await enviarConsulta({}, 500);
    expect(respuesta.status).toBe(502);
    expect(correos).toHaveLength(1);
    expect(estados()).toEqual(['error']);
  });

  it('con 3 envíos en la última hora: 429', async () => {
    const { respuesta, correos } = await enviarConsulta({ recientes: 3 });
    expect(respuesta.status).toBe(429);
    expect(correos).toHaveLength(0);
  });

  it('con el tope diario lleno: 503, sin guardar ni avisar', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { respuesta, correos, sentencias } = await enviarConsulta({ total: 100 });
    expect(respuesta).toEqual({ status: 503, datos: { ok: false, error: 'saturado' } });
    expect(correos).toHaveLength(0);
    expect(sentencias.some((s) => s.sql.includes('INSERT'))).toBe(false);
  });
});

describe('contacto.reintentarPendientes', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reenvía a ventas con [Reenvío], sin acuse, y marca la fila', async () => {
    const { correos } = redFalsa();
    const e = entorno({ pendientes: [{ id: 9, ...base, empresa: '', origen: '', estado: 'recibido', error: null }] });
    await reintentarPendientes(e.env);
    expect(correos).toHaveLength(1);
    expect(correos[0].para).toEqual(['ventas@inacons.com.pe']);
    expect(correos[0].asunto).toBe('[Reenvío] Consulta web — Obras Civiles — María López');
    expect(e.estados()).toEqual(['notificado']);
  });
});
