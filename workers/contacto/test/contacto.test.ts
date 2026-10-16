import { describe, expect, it } from 'vitest';
import { validar } from '../src/contacto';

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

  it('rechaza un servicio que no está en la lista', () => {
    expect(validar({ ...base, servicio: 'Cualquier cosa' })).toBeNull();
  });

  it('acepta "Otro"', () => {
    expect(validar({ ...base, servicio: 'Otro' })).not.toBeNull();
  });

  it('rechaza un nombre con enlace: el acuse lo repite en el saludo', () => {
    expect(validar({ ...base, nombre: 'Visita https://malo.example' })).toBeNull();
  });

  it('rechaza un campo que pasa su límite', () => {
    expect(validar({ ...base, mensaje: 'x'.repeat(3001) })).toBeNull();
  });
});
