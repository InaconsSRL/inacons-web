/**
 * Comprueba sobre dist/ los contratos que el build no ve (docs/arquitectura.md,
 * "Lo que un rediseño no puede romper"). Sin dependencias: corre en el CI y con
 * `npm run verificar` después de `npm run build`.
 *
 *   1. CSP: cada script en línea del HTML tiene su sha256 en public/.htaccess.
 *      Si no, el navegador lo bloquea en cuanto la CSP deje el modo informe.
 *   2. Regla 1 de CLAUDE.md: cada selector con alcance de página
 *      (data-astro-cid) encuentra al menos un elemento en las páginas que cargan
 *      ese CSS. Si no encuentra ninguno, apunta a algo que pinta un componente
 *      hijo o que inyecta JavaScript, y no se aplica nunca.
 *   3. Enlaces: todo href, src y srcset interno apunta a un archivo de dist/.
 *
 * Sale con código 1 si algo falla, con una línea por problema.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DIST = 'dist';
const SITIO = 'https://home.inacons.com.pe';
const problemas = [];

const paginas = [];
(function recorrer(dir) {
  for (const nombre of fs.readdirSync(dir)) {
    const ruta = path.join(dir, nombre);
    if (fs.statSync(ruta).isDirectory()) recorrer(ruta);
    else if (ruta.endsWith('.html')) paginas.push({ ruta, html: fs.readFileSync(ruta, 'utf8') });
  }
})(DIST);
const nombre = (p) => '/' + path.relative(DIST, p.ruta).split(path.sep).join('/');

// ── 1. Hashes de la CSP ──────────────────────────────────────────────────────
const htaccess = fs.readFileSync('public/.htaccess', 'utf8');
const hashesUsados = new Set();
for (const p of paginas) {
  for (const [, atributos, cuerpo] of p.html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    // Los que tienen src no son en línea, y el JSON-LD no se ejecuta.
    if (/\bsrc=/.test(atributos) || /application\/ld\+json/.test(atributos)) continue;
    const hash = `sha256-${crypto.createHash('sha256').update(cuerpo).digest('base64')}`;
    hashesUsados.add(hash);
    if (!htaccess.includes(`'${hash}'`)) problemas.push(`CSP: ${nombre(p)} tiene un script en línea sin su hash en .htaccess: '${hash}'`);
  }
}
for (const [hash] of htaccess.matchAll(/sha256-[A-Za-z0-9+/=]+/g)) {
  if (!hashesUsados.has(hash)) console.warn(`aviso CSP: '${hash}' está en .htaccess y ya no lo usa ningún script`);
}

// ── 2. Regla 1: selectores de página que no encuentran nada ─────────────────

// Árbol mínimo del HTML que emite Astro (bien formado): etiqueta, id, clases,
// atributos data-astro-cid-* e hijos. El contenido de <script> no se recorre.
const VACIOS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
function arbol(html) {
  const raiz = { tag: '#raiz', clases: new Set(), cids: new Set(), hijos: [], padre: null };
  let actual = raiz;
  const fichas = /<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1>|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>/g;
  for (const m of html.matchAll(fichas)) {
    if (m[0].startsWith('<!--')) continue;
    if (m[1]) { // script o style: elemento hoja
      actual.hijos.push({ tag: m[1].toLowerCase(), clases: new Set(), cids: new Set(), hijos: [], padre: actual });
      continue;
    }
    if (m[2]) { // cierre: sube hasta la etiqueta que cierra
      const tag = m[2].toLowerCase();
      let n = actual;
      while (n !== raiz && n.tag !== tag) n = n.padre;
      if (n !== raiz) actual = n.padre;
      continue;
    }
    const tag = m[3].toLowerCase();
    const atributos = m[4] ?? '';
    const clase = atributos.match(/\sclass\s*=\s*(?:"([^"]*)"|'([^']*)')/);
    const id = atributos.match(/\sid\s*=\s*(?:"([^"]*)"|'([^']*)')/);
    const nodo = {
      tag,
      id: id ? (id[1] ?? id[2]) : null,
      clases: new Set((clase ? (clase[1] ?? clase[2]) : '').split(/\s+/).filter(Boolean)),
      cids: new Set([...atributos.matchAll(/\s(data-astro-cid-[\w-]+)/g)].map((c) => c[1])),
      hijos: [],
      padre: actual,
    };
    actual.hijos.push(nodo);
    if (!VACIOS.has(tag) && !m[0].endsWith('/>')) actual = nodo;
  }
  return raiz;
}
function* elementos(n) { for (const h of n.hijos) { yield h; yield* elementos(h); } }

// Clases que pone JavaScript en tiempo de ejecución: en el HTML estático no
// están, así que un selector que las pide no se descarta por eso. Se sacan del
// código, para que la lista no haya que mantenerla a mano.
const clasesDeJs = new Set(['js']);
(function recorrer(dir) {
  for (const n of fs.readdirSync(dir)) {
    const ruta = path.join(dir, n);
    if (fs.statSync(ruta).isDirectory()) recorrer(ruta);
    else if (/\.(ts|astro)$/.test(n)) {
      const codigo = fs.readFileSync(ruta, 'utf8');
      for (const [, lista] of codigo.matchAll(/classList\.(?:add|toggle|remove|replace)\(([^)]*)\)/g)) {
        for (const [, c] of lista.matchAll(/['"`]([\w-]+)['"`]/g)) clasesDeJs.add(c);
      }
    }
  }
})('src');

// Un compuesto se reduce a lo que se puede comprobar en el HTML estático:
// etiqueta, id, clases que no pone JS y data-astro-cid. Pseudoclases y demás
// atributos ([aria-expanded], [hidden]…) dependen del estado y se ignoran.
function compuesto(texto) {
  let t = texto;
  while (/:[\w-]+\([^()]*\)/.test(t)) t = t.replace(/:[\w-]+\([^()]*\)/g, '');
  t = t.replace(/::?[\w-]+/g, '');
  const cids = [...t.matchAll(/\[(data-astro-cid-[\w-]+)\]/g)].map((m) => m[1]);
  t = t.replace(/\[[^\]]*\]/g, '');
  const tag = t.match(/^[a-zA-Z][\w-]*/)?.[0]?.toLowerCase() ?? null;
  const id = t.match(/#([\w-]+)/)?.[1] ?? null;
  const clases = [...t.matchAll(/\.([\w-]+)/g)].map((m) => m[1]).filter((c) => !clasesDeJs.has(c));
  return { tag, id, clases, cids };
}
const encaja = (n, c) =>
  (!c.tag || n.tag === c.tag) && (!c.id || n.id === c.id) &&
  c.clases.every((x) => n.clases.has(x)) && c.cids.every((x) => n.cids.has(x));

// Se admiten descendiente y ">"; con "+" o "~" el selector no se evalúa.
function coincide(selector, raiz) {
  const partes = selector.trim().replace(/\s*>\s*/g, ' > ').split(/\s+/);
  const pasos = [];
  for (let i = 0; i < partes.length; i++) {
    if (partes[i] === '>') continue;
    pasos.push({ c: compuesto(partes[i]), hijoDirecto: partes[i - 1] === '>' });
  }
  const desde = (n, i) => {
    if (i < 0) return true;
    const { c, hijoDirecto } = pasos[i + 1];
    for (let p = n.padre; p; p = p.padre) {
      if (encaja(p, pasos[i].c) && desde(p, i - 1)) return true;
      if (hijoDirecto) return false;
    }
    void c;
    return false;
  };
  const ultimo = pasos.length - 1;
  for (const n of elementos(raiz)) if (encaja(n, pasos[ultimo].c) && desde(n, ultimo - 1)) return true;
  return false;
}

// Selectores de un CSS minificado, entrando en @media y @supports.
function selectores(css) {
  const lista = [];
  let i = 0;
  const bloque = (fin) => {
    let previo = '';
    while (i < css.length) {
      const ch = css[i++];
      if (ch === '{') {
        const cabeza = previo.trim();
        previo = '';
        if (/^@(media|supports|layer|container)/.test(cabeza)) bloque();
        else if (cabeza.startsWith('@')) saltar();
        else { lista.push(...cabeza.split(',')); saltar(); }
      } else if (ch === '}') { if (fin !== false) return; }
      else if (ch === ';') previo = '';
      else previo += ch;
    }
  };
  const saltar = () => { for (let n = 1; i < css.length && n > 0; i++) { if (css[i] === '{') n++; else if (css[i] === '}') n--; } };
  bloque(false);
  return lista.map((s) => s.trim()).filter((s) => s.includes('data-astro-cid') && !/[+~]/.test(s.replace(/\[[^\]]*\]|\([^)]*\)/g, '')));
}

const cssDe = new Map(); // selector → páginas que cargan el CSS donde está
for (const p of paginas) {
  p.raiz = arbol(p.html);
  const hojas = [...p.html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="(\/_astro\/[^"]+\.css)"/g)]
    .map((m) => fs.readFileSync(path.join(DIST, m[1]), 'utf8'));
  const enLinea = [...p.html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
  for (const css of [...hojas, ...enLinea]) {
    for (const s of selectores(css)) {
      if (!cssDe.has(s)) cssDe.set(s, new Set());
      cssDe.get(s).add(p);
    }
  }
}
// Selectores de contenido que existe en el código pero que hoy los datos no
// pintan. No es la regla 1: el día que se pinten, sus elementos llevarán el
// atributo. Cada entrada dice por qué; si el motivo deja de ser cierto, se borra.
const CONDICIONALES = [
  { patron: /^(a)?\.sello/, motivo: 'SellosCertificacion.astro no pinta nada hasta que una norma traiga `sello` (docs/contenido.md)' },
  { patron: /^\.recurso-formato$/, motivo: '/recursos/ la muestra solo para formatos sin vista previa; hoy todos son imagen' },
];

for (const [selector, enPaginas] of cssDe) {
  const lista = [...enPaginas];
  if (lista.some((p) => coincide(selector, p.raiz))) continue;
  const legible = selector.replace(/\[data-astro-cid-[\w-]+\]/g, '');
  const donde = lista.map(nombre).slice(0, 3).join(', ');
  // El elemento está, pero sin el atributo: lo pinta un componente hijo.
  const sinAlcance = selector.replace(/\[data-astro-cid-[\w-]+\]/g, '');
  if (lista.some((p) => coincide(sinAlcance, p.raiz))) {
    problemas.push(`Regla 1: "${legible}" (${donde}) apunta a elementos que pinta un componente hijo: no llevan el atributo de alcance de la página. ` +
      'Va en design-system.css, con :global() o como custom property.');
  } else if (!CONDICIONALES.some((c) => c.patron.test(legible))) {
    problemas.push(`Regla 1: "${legible}" (${donde}) no encuentra ningún elemento en el HTML. Si lo inyecta JS, el estilo va en el JS o en ` +
      'design-system.css; si es contenido que hoy no se pinta, se agrega a CONDICIONALES de este script con el motivo.');
  }
}

// ── 3. Enlaces internos ──────────────────────────────────────────────────────
const existe = (u) => {
  const ruta = path.join(DIST, decodeURIComponent(u.split(/[?#]/)[0]));
  return fs.existsSync(ruta) && (fs.statSync(ruta).isFile() || fs.existsSync(path.join(ruta, 'index.html')));
};
for (const p of paginas) {
  const rotos = new Set();
  for (const [, valor] of p.html.matchAll(/\s(?:href|src|srcset|data-src)="([^"]+)"/g)) {
    for (let u of valor.split(',').map((s) => s.trim().split(/\s+/)[0])) {
      if (u.startsWith(SITIO)) u = u.slice(SITIO.length) || '/';
      if (!u.startsWith('/') || u.startsWith('//')) continue;
      if (!existe(u)) rotos.add(u);
    }
  }
  for (const u of rotos) problemas.push(`Enlace: ${nombre(p)} apunta a ${u}, que no está en dist/`);
}

if (problemas.length) {
  for (const p of problemas) console.error(`✗ ${p}`);
  console.error(`\n${problemas.length} problema(s) en dist/.`);
  process.exit(1);
}
console.log(`✓ dist/: ${paginas.length} páginas, ${hashesUsados.size} scripts en línea con hash, ${cssDe.size} selectores de página revisados, enlaces internos completos.`);
