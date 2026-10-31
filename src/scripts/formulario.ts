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

/** Pinta un aviso en el contenedor `role="status"` de la página. */
export function aviso(estado: HTMLElement | null, tipo: TipoAviso, html: string): void {
  if (!estado) return;
  estado.innerHTML = `<div class="notice notice--${tipo}">${html}</div>`;
  estado.scrollIntoView({ block: 'nearest' });
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

// 503 es el Worker diciendo que Turnstile no le contestó (docs/contenido.md):
// no es culpa de quien escribe ni se arregla reintentando de inmediato, así
// que el texto es el mismo en los dos formularios.
const SIN_VERIFICACION =
  '<strong>La verificación de seguridad no respondió.</strong> ' +
  'Lo que escribiste sigue en el formulario: inténtalo de nuevo en un momento.';

type Turnstile = { reset(): void };

export function conectarFormulario(o: OpcionesEnvio): void {
  const { form, boton, estado } = o;

  // El HTML trae el botón apagado para que, sin este script, nada se envíe por
  // la vía nativa. Se enciende si hay adónde mandar los datos: el Worker o, en
  // /contacto/, el correo del visitante.
  if (boton && (o.url || o.sinEndpoint)) boton.disabled = false;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const datos = Object.fromEntries(
      [...new FormData(form)].map(([k, v]) => [k, String(v).trim()]),
    );
    // Campo trampa: una persona no lo ve, un bot lo rellena. Se sale sin avisar.
    if (datos.company_url) return;

    form.classList.add('was-validated');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

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
        body: JSON.stringify({ ...datos, turnstile, origen: location.href }),
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
      o.alLimpiar?.();
    } catch (err) {
      // Un status HTTP llega como Error("429"); cualquier otra cosa (corte de
      // red, los 10 s de espera) es "red".
      const codigo = err instanceof Error && /^\d{3}$/.test(err.message) ? err.message : 'red';
      aviso(estado, 'error', codigo === '503' ? SIN_VERIFICACION : o.error(codigo));
    } finally {
      if (boton) boton.disabled = false;
      // Cada token sirve para un solo envío, haya salido bien o no.
      (window as { turnstile?: Turnstile }).turnstile?.reset();
    }
  });
}
