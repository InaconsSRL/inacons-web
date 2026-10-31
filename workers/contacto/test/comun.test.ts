import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CORREO_VALIDO, VerificacionNoDisponible, escapar, fechaValida, leerCampos, limpiarOrigen, nombreValido, tablaHtml,
  turnstileValido,
} from '../src/comun';
import { redFalsa } from './simulado';

describe('escapar', () => {
  it('neutraliza los cinco caracteres que abren HTML', () => {
    expect(escapar(`<a href="x">&'`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
  });
});

describe('leerCampos', () => {
  const limites = { nombre: 10, correo: 20 };

  it('recorta espacios y deja vacío lo que no es texto', () => {
    expect(leerCampos({ nombre: '  Ana  ', correo: 42 }, limites)).toEqual({ nombre: 'Ana', correo: '' });
  });

  it('ignora los campos que no declara', () => {
    expect(leerCampos({ nombre: 'Ana', extra: 'x' }, limites)).toEqual({ nombre: 'Ana', correo: '' });
  });

  it('devuelve null si un campo pasa su límite', () => {
    expect(leerCampos({ nombre: 'a'.repeat(11) }, limites)).toBeNull();
  });
});

describe('tablaHtml', () => {
  it('escapa los valores que escribió el visitante', () => {
    expect(tablaHtml([['Nombre', '<script>alert(1)</script>']])).not.toContain('<script>');
  });
});

describe('CORREO_VALIDO', () => {
  it('acepta un correo normal y rechaza lo que no lo es', () => {
    expect(CORREO_VALIDO.test('ana@empresa.pe')).toBe(true);
    expect(CORREO_VALIDO.test('ana@empresa')).toBe(false);
    expect(CORREO_VALIDO.test('ana @empresa.pe')).toBe(false);
  });
});

describe('nombreValido', () => {
  it('acepta nombres reales, con tildes, guion, apóstrofo e iniciales', () => {
    expect(nombreValido('María-José O\'Neil')).toBe(true);
    expect(nombreValido('Ñahui Quispe')).toBe(true);
    expect(nombreValido('J. R. Pérez')).toBe(true);
  });

  it.each([
    ['un enlace', 'Hola, visita https://malo.example'],
    ['un dominio con www', 'visita www.malo.example'],
    ['un dominio suelto', 'Tu cuenta vence, entra a bit.ly/x'],
    ['un dominio sin ruta', 'cobros-inacons.com'],
    ['una arroba', 'ana@malo.example'],
    ['un salto de línea', 'Ana\nLópez'],
    ['un tabulador', 'Ana\tLópez'],
    ['un separador de línea Unicode', `Ana${String.fromCharCode(0x2028)}López`],
  ])('rechaza un nombre con %s', (_caso, nombre) => {
    expect(nombreValido(nombre)).toBe(false);
  });
});

describe('fechaValida', () => {
  it.each([
    ['2026-10-01', true],
    ['2028-02-29', true],
    ['2026-02-29', false],
    ['2026-13-45', false],
    ['01/10/2026', false],
  ])('%s → %s', (fecha, esperado) => {
    expect(fechaValida(fecha)).toBe(esperado);
  });
});

describe('limpiarOrigen', () => {
  it('quita query y fragmento', () => {
    expect(limpiarOrigen('https://home.inacons.com.pe/contacto/?utm_source=x#form')).toBe('https://home.inacons.com.pe/contacto/');
  });

  it('recorta a 300 caracteres en vez de rechazar', () => {
    expect(limpiarOrigen('https://home.inacons.com.pe/' + 'a'.repeat(400))).toHaveLength(300);
  });

  it('devuelve vacío si no es texto', () => {
    expect(limpiarOrigen(42)).toBe('');
  });
});

describe('turnstileValido', () => {
  afterEach(() => vi.unstubAllGlobals());

  const esperado = { hosts: ['home.inacons.com.pe'], accion: 'contacto' };
  const secreto = 'secreto-de-produccion';

  it('acepta un token del sitio y del formulario correcto', async () => {
    redFalsa();
    expect(await turnstileValido('token', '', secreto, esperado)).toBe(true);
  });

  it('rechaza un token resuelto en otro host', async () => {
    redFalsa({ turnstile: { success: true, hostname: 'localhost', action: 'contacto' } });
    expect(await turnstileValido('token', '', secreto, esperado)).toBe(false);
  });

  it('rechaza un token del otro formulario', async () => {
    redFalsa({ turnstile: { success: true, hostname: 'home.inacons.com.pe', action: 'canal' } });
    expect(await turnstileValido('token', '', secreto, esperado)).toBe(false);
  });

  it('con la clave de prueba de Cloudflare solo mira success', async () => {
    redFalsa({ turnstile: { success: true, hostname: 'example.com', action: '' } });
    expect(await turnstileValido('token', '', '1x0000000000000000000000000000000AA', esperado)).toBe(true);
  });

  it('registra un secret mal configurado, que antes daba 403 sin rastro', async () => {
    redFalsa({ turnstile: { success: false, 'error-codes': ['invalid-input-secret'] } });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await turnstileValido('token', '', secreto, esperado)).toBe(false);
    expect(log).toHaveBeenCalledWith('Turnstile: invalid-input-secret');
  });

  it('no registra un token simplemente vencido', async () => {
    redFalsa({ turnstile: { success: false, 'error-codes': ['timeout-or-duplicate'] } });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await turnstileValido('token', '', secreto, esperado)).toBe(false);
    expect(log).not.toHaveBeenCalled();
  });

  it('si Cloudflare no responde, lanza VerificacionNoDisponible (503, no 403)', async () => {
    redFalsa({ turnstile: 'caido' });
    await expect(turnstileValido('token', '', secreto, esperado)).rejects.toBeInstanceOf(VerificacionNoDisponible);
  });

  it('sin token no consulta a Cloudflare', async () => {
    const { fetchFalso } = redFalsa();
    expect(await turnstileValido('', '', secreto, esperado)).toBe(false);
    expect(fetchFalso).not.toHaveBeenCalled();
  });
});
