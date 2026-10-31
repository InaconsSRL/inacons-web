/**
 * Envío compartido de los formularios que hablan con el Worker de
 * workers/contacto/: /contacto/ y /canal-etico/. El contrato HTTP está en
 * docs/contenido.md.
 *
 * Cada página aporta solo lo que es suyo: a qué URL va, qué hace si no hay
 * endpoint y cómo se ve el éxito y el error. El orden de los pasos es el mismo
 * en las dos y vive aquí, para que un arreglo no se quede en un formulario y
 * falte en el otro.
 *
 * No importa astro:env: la URL llega por parámetro y cada página decide.
 */

export type TipoAviso = 'ok' | 'error' | 'info';

/**
 * Pinta un aviso en el contenedor `role="status"` de la página. El aviso puede
 * recibir foco (tabindex -1) para cuando haya que llevarlo ahí a propósito.
 */
export function aviso(estado: HTMLElement | null, tipo: TipoAviso, html: string): void {
  if (!estado) return;
  estado.innerHTML = `<div class="notice notice--${tipo}" tabindex="-1">${html}</div>`;
  estado.scrollIntoView({ block: 'nearest' });
}

/*
  Errores de campo. Antes solo cambiaba el color del borde y aparecía la
  burbuja del navegador en el primer campo, que se va sola: quien no distingue
  el rojo, o usa lector de pantalla, no sabía qué faltaba (WCAG 1.4.1 y 3.3.1).
  Ahora cada campo inválido lleva un .form-error con el motivo, enlazado por
  aria-describedby, y aria-invalid; el foco va al primero.
*/
type Campo = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function mensajeDe(c: Campo): string {
  const v = c.validity;
  if (v.valueMissing) {
    if (c.type === 'radio') return 'Elige una opción.';
    if (c.type === 'checkbox') return 'Marca la casilla para continuar.';
    return 'Este campo es obligatorio.';
  }
  if (v.typeMismatch && c.type === 'email') return 'Escribe un correo válido, como nombre@empresa.pe.';
  if (v.tooLong && 'maxLength' in c) return `Usa como máximo ${c.maxLength} caracteres.`;
  return c.validationMessage;
}

// Dónde va el mensaje y qué elemento lo anuncia: un grupo de radios lo anuncia
// su fieldset; la casilla de términos, después de su etiqueta; el resto, al
// final de su .form-group.
function destinoDe(c: Campo): { despuesDe: HTMLElement; describe: HTMLElement[] } | null {
  if (c.type === 'radio') {
    const grupo = c.closest('fieldset');
    if (!grupo) return null;
    return { despuesDe: grupo.lastElementChild as HTMLElement, describe: [grupo] };
  }
  const etiqueta = c.closest<HTMLElement>('label');
  if (c.type === 'checkbox' && etiqueta) return { despuesDe: etiqueta, describe: [c] };
  const grupo = c.closest<HTMLElement>('.form-group');
  return grupo ? { despuesDe: grupo.lastElementChild as HTMLElement, describe: [c] } : null;
}

function marcar(c: Campo, mensaje: string | null): void {
  const id = `error-${c.name || c.id}`;
  const destino = destinoDe(c);
  const radios = c.type === 'radio' && c.form
    ? [...c.form.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${c.name}"]`)]
    : [c];
  let nodo = document.getElementById(id);
  if (!mensaje) {
    nodo?.remove();
    radios.forEach((r) => r.removeAttribute('aria-invalid'));
    destino?.describe.forEach((el) => quitarDescripcion(el, id));
    return;
  }
  if (!nodo && destino) {
    nodo = document.createElement('span');
    nodo.id = id;
    nodo.className = 'form-error';
    destino.despuesDe.after(nodo);
  }
  if (nodo) nodo.textContent = mensaje;
  radios.forEach((r) => r.setAttribute('aria-invalid', 'true'));
  destino?.describe.forEach((el) => agregarDescripcion(el, id));
}

function agregarDescripcion(el: HTMLElement, id: string): void {
  const ids = new Set((el.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean));
  ids.add(id);
  el.setAttribute('aria-describedby', [...ids].join(' '));
}

function quitarDescripcion(el: HTMLElement, id: string): void {
  const ids = (el.getAttribute('aria-describedby') ?? '').split(/\s+/).filter((x) => x && x !== id);
  if (ids.length) el.setAttribute('aria-describedby', ids.join(' '));
  else el.removeAttribute('aria-describedby');
}

const camposDe = (contenedor: HTMLElement) =>
  [...contenedor.querySelectorAll<Campo>('input, select, textarea')].filter((c) => c.willValidate);

/**
 * Valida los campos de `contenedor` (un formulario o un paso del asistente),
 * marca los inválidos con su mensaje y lleva el foco al primero. Devuelve si
 * todo es válido. Los campos apagados (un fieldset disabled) no cuentan.
 */
export function validarCampos(contenedor: HTMLElement): boolean {
  let primero: Campo | null = null;
  for (const c of camposDe(contenedor)) {
    const valido = c.checkValidity();
    marcar(c, valido ? null : mensajeDe(c));
    if (!valido && !primero) primero = c;
  }
  primero?.focus();
  return !primero;
}

/** Quita todos los mensajes de error, por ejemplo tras un envío correcto. */
export function limpiarErrores(contenedor: HTMLElement): void {
  for (const c of camposDe(contenedor)) marcar(c, null);
}

// Una vez marcado, el mensaje sigue al campo mientras la persona lo corrige:
// desaparece en cuanto el valor es válido, sin esperar a otro envío.
function vigilarCampos(form: HTMLFormElement): void {
  const revisar = (e: Event) => {
    const c = e.target as Campo;
    if (!c.willValidate || c.getAttribute('aria-invalid') !== 'true') return;
    if (c.checkValidity()) marcar(c, null);
    else marcar(c, mensajeDe(c));
  };
  form.addEventListener('input', revisar);
  form.addEventListener('change', revisar);
}

export interface OpcionesEnvio {
  form: HTMLFormElement;
  boton: HTMLButtonElement | null;
  /** Contenedor `role="status"` donde se pintan los avisos. */
  estado: HTMLElement | null;
  /** URL completa del Worker, o null si el build no trae endpoint. */
  url: string | null;
  /** Sin endpoint: qué hacer con los datos ya validados (contacto abre el correo). */
  sinEndpoint?: (datos: Record<string, string>) => void;
  /** HTML del aviso de éxito, a partir del JSON que devolvió el Worker. */
  exito: (respuesta: Record<string, unknown>) => string;
  /** HTML del aviso de error. `codigo` es el status HTTP ("429", "502"…) o "red" si no hubo respuesta. */
  error: (codigo: string) => string;
  /** Después de vaciar el formulario tras un envío correcto. */
  alLimpiar?: () => void;
}

// 503 es el Worker diciendo que no puede recibir ahora: Turnstile no le
// contestó, o se llegó al tope diario de envíos (docs/contenido.md). No es
// culpa de quien escribe ni se arregla reintentando de inmediato, así que el
// texto es el mismo en los dos formularios.
const NO_DISPONIBLE =
  '<strong>No podemos recibir envíos en este momento.</strong> ' +
  'Lo que escribiste sigue en el formulario: inténtalo de nuevo en unos minutos.';

type Turnstile = { reset(): void };

export function conectarFormulario(o: OpcionesEnvio): void {
  const { form, boton, estado } = o;

  // El HTML trae el botón apagado para que, sin este script, nada se envíe por
  // la vía nativa. Se enciende si hay adónde mandar los datos: el Worker o, en
  // /contacto/, el correo del visitante.
  if (boton && (o.url || o.sinEndpoint)) boton.disabled = false;
  vigilarCampos(form);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const datos = Object.fromEntries(
      [...new FormData(form)].map(([k, v]) => [k, String(v).trim()]),
    );
    // Campo trampa: una persona no lo ve, un bot lo rellena. Se sale sin avisar.
    if (datos.company_url) return;

    form.classList.add('was-validated');
    if (!validarCampos(form)) return;

    // Turnstile mete su token como campo del formulario; viaja aparte porque
    // no es parte del mensaje.
    const turnstile = datos['cf-turnstile-response'] ?? '';
    delete datos.company_url;
    delete datos['cf-turnstile-response'];

    if (!o.url) {
      o.sinEndpoint?.(datos);
      return;
    }

    if (form.querySelector('.cf-turnstile') && !turnstile) {
      aviso(estado, 'info', 'Espera a que termine la verificación de seguridad, sobre el botón, y vuelve a enviar.');
      return;
    }

    if (boton) boton.disabled = true;
    aviso(estado, 'info', 'Enviando…');
    try {
      const respuesta = await fetch(o.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        // Sin query ni fragmento: los UTM y gclid pasaban el límite del Worker,
        // y en un reporte anónimo la query puede acotar quién escribe.
        body: JSON.stringify({ ...datos, turnstile, origen: location.origin + location.pathname }),
        signal: AbortSignal.timeout(10000),
      });
      if (!respuesta.ok) throw new Error(String(respuesta.status));

      // El éxito ya es seguro con el 2xx: si el cuerpo no es JSON no se pierde.
      let cuerpo: Record<string, unknown> = {};
      try {
        cuerpo = await respuesta.json();
      } catch { /* sin cuerpo utilizable */ }

      aviso(estado, 'ok', o.exito(cuerpo));
      form.reset();
      form.classList.remove('was-validated');
      limpiarErrores(form);
      o.alLimpiar?.();
      // El foco va al aviso, después de alLimpiar (que en el Canal lo lleva al
      // paso 1): el aviso trae el código del reporte, y un cambio de foco a otro
      // lado suele pisar el anuncio de role="status" en el lector de pantalla.
      // Para un reporte anónimo ese código es la única forma de seguir el caso.
      estado?.querySelector<HTMLElement>('.notice')?.focus();
    } catch (err) {
      // Un status HTTP llega como Error("429"); cualquier otra cosa (corte de
      // red, los 10 s de espera) es "red".
      const codigo = err instanceof Error && /^\d{3}$/.test(err.message) ? err.message : 'red';
      aviso(estado, 'error', codigo === '503' ? NO_DISPONIBLE : o.error(codigo));
    } finally {
      if (boton) boton.disabled = false;
      // Cada token sirve para un solo envío, haya salido bien o no.
      (window as { turnstile?: Turnstile }).turnstile?.reset();
    }
  });
}
