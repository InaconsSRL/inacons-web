import { describe, expect, it } from 'vitest';
import { CORREO_VALIDO, escapar, leerCampos, nombreValido, tablaHtml } from '../src/comun';

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
  it('acepta nombres reales, con tildes, guion y apóstrofo', () => {
    expect(nombreValido('María-José O\'Neil')).toBe(true);
    expect(nombreValido('Ñahui Quispe')).toBe(true);
  });

  it.each([
    ['un enlace', 'Hola, visita https://malo.example'],
    ['un dominio con www', 'visita www.malo.example'],
    ['una arroba', 'ana@malo.example'],
    ['un salto de línea', 'Ana\nLópez'],
  ])('rechaza un nombre con %s', (_caso, nombre) => {
    expect(nombreValido(nombre)).toBe(false);
  });
});
