/**
 * El Worker y el sitio comparten dos listas que no pueden importarse la una a la
 * otra (el Worker no corre Astro): los servicios del formulario de contacto y
 * los tipos del Canal Ético. Estas pruebas leen los archivos del sitio y fallan
 * si las listas se separan, que es el cambio que en producción se vería como un
 * 400 sin explicación.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SERVICIOS } from '../src/contacto';
import { TIPOS } from '../src/canal';

const raiz = (ruta: string) => fileURLToPath(new URL(`../../../${ruta}`, import.meta.url));

describe('contrato con el sitio', () => {
  it('SERVICIOS son los títulos de src/content/servicios más "Otro"', () => {
    const carpeta = raiz('src/content/servicios');
    const titulos = readdirSync(carpeta)
      .filter((f) => f.endsWith('.md'))
      .map((f) => readFileSync(`${carpeta}/${f}`, 'utf8').match(/^titulo:\s*(.+)$/m)?.[1].trim().replace(/^["']|["']$/g, ''));

    expect(titulos.every(Boolean)).toBe(true);
    expect([...SERVICIOS].sort()).toEqual([...(titulos as string[]), 'Otro'].sort());
  });

  it('TIPOS del Worker son los tipos de CANALES en canal-etico.astro', () => {
    const pagina = readFileSync(raiz('src/pages/canal-etico.astro'), 'utf8');
    const tipos = [...pagina.matchAll(/\{ tipo: '([a-z-]+)'/g)].map((m) => m[1]);

    expect(tipos.length).toBeGreaterThan(0);
    expect(Object.keys(TIPOS).sort()).toEqual([...tipos].sort());
  });
});
