/**
 * Lo único de Node que usan las pruebas (contrato.test.ts lee archivos del
 * sitio). El Worker compila contra los tipos de Cloudflare, no contra los de
 * Node, y no instala @types/node solo para esto.
 *
 * contrato.test.ts no puede quedar fuera del tsconfig del Worker: Vite busca
 * entonces el tsconfig del sitio, que extiende astro/tsconfigs/strict, y en el
 * CI (que solo instala el Worker) la prueba no llega ni a compilar.
 */
declare module 'node:fs' {
  export function readdirSync(ruta: string): string[];
  export function readFileSync(ruta: string, codificacion: 'utf8'): string;
}

declare module 'node:url' {
  export function fileURLToPath(url: URL | string): string;
}

interface ImportMeta {
  readonly url: string;
}
