import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { violaciones } from '../src/csp';
import { entorno } from './simulado';

const reportingApi = [{
  type: 'csp-violation',
  url: 'https://home.inacons.com.pe/canal-etico/?obra=pucusana',
  body: {
    documentURL: 'https://home.inacons.com.pe/canal-etico/?obra=pucusana',
    effectiveDirective: 'script-src-elem',
    blockedURL: 'https://malo.example/x.js?token=123',
    disposition: 'report',
  },
}];
const reportUri = {
  'csp-report': {
    'document-uri': 'https://home.inacons.com.pe/mineria/',
    'violated-directive': 'script-src-elem',
    'blocked-uri': 'inline',
  },
};

describe('violaciones', () => {
  it('lee la Reporting API y se queda con origen y ruta, sin query', () => {
    expect(violaciones(reportingApi)).toEqual([
      { directiva: 'script-src-elem', bloqueado: 'https://malo.example', pagina: 'home.inacons.com.pe/canal-etico/' },
    ]);
  });

  it('lee el formato antiguo de report-uri', () => {
    expect(violaciones(reportUri)).toEqual([
      { directiva: 'script-src-elem', bloqueado: 'inline', pagina: 'home.inacons.com.pe/mineria/' },
    ]);
  });

  it('ignora lo que no es un informe de CSP', () => {
    expect(violaciones([{ type: 'deprecation', body: {} }])).toEqual([]);
    expect(violaciones({ nombre: 'x' })).toEqual([]);
  });
});

describe('ruta /csp', () => {
  afterEach(() => vi.restoreAllMocks());

  async function llamar(o: { metodo?: string; cuerpo?: string; tipo?: string }) {
    const e = entorno({ fallaDB: true });
    const req = new Request('https://inacons-contacto.example.workers.dev/csp', {
      method: o.metodo ?? 'POST',
      // Sin Origin: así llegan muchos informes, y no deben chocar con el control de origen.
      headers: o.metodo === 'OPTIONS' ? {} : { 'Content-Type': o.tipo ?? 'application/reports+json' },
      body: o.metodo === 'OPTIONS' ? undefined : o.cuerpo,
    });
    return worker.fetch!(req as Parameters<NonNullable<typeof worker.fetch>>[0], e.env, e.ctx);
  }

  it('responde el preflight con CORS abierto', async () => {
    const r = await llamar({ metodo: 'OPTIONS' });
    expect(r.status).toBe(204);
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('registra una línea por violación, sin la query de la página, y no toca D1', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const r = await llamar({ cuerpo: JSON.stringify(reportingApi) });
    expect(r.status).toBe(204);
    expect(log).toHaveBeenCalledWith('CSP: script-src-elem bloqueó https://malo.example en home.inacons.com.pe/canal-etico/');
    expect(JSON.stringify(log.mock.calls)).not.toContain('pucusana');
  });

  it('acepta el formato antiguo', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const r = await llamar({ cuerpo: JSON.stringify(reportUri), tipo: 'application/csp-report' });
    expect(r.status).toBe(204);
  });

  it('rechaza un cuerpo que no es JSON y uno demasiado grande', async () => {
    expect((await llamar({ cuerpo: 'no es json' })).status).toBe(400);
    expect((await llamar({ cuerpo: JSON.stringify([{ x: 'y'.repeat(20_000) }]) })).status).toBe(413);
  });
});
