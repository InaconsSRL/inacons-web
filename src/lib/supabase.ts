/**
 * Cliente de Supabase. Unico lugar del repositorio que lo instancia.
 *
 * Sobre la clave anonima: es publica por diseno. Viaja dentro del JavaScript
 * que descarga el navegador, asi que cualquiera puede leerla. No es una fuga
 * y no hay que esconderla. Lo que impide que sirva para algo es RLS, del lado
 * de la base -- ver supabase/migrations/0002_rls.sql.
 *
 * La que NUNCA puede aparecer aqui ni en ningun archivo de este repositorio es
 * la clave `service_role`: esa se salta RLS entera.
 *
 * Esta en variables de entorno de todas formas porque el proyecto de Supabase
 * puede cambiar, y entonces conviene que el valor viva en un solo sitio.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY ?? '';

/** Las dos variables estan presentes. Se consulta en build para no publicar un panel muerto. */
export const supabaseConfigurado = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let cliente: SupabaseClient | null = null;

/**
 * Cliente con sesion persistente. Guarda el token en localStorage y lo renueva
 * solo, que es lo que hace que recargar el panel no obligue a volver a entrar.
 */
export function getSupabase(): SupabaseClient {
  if (!supabaseConfigurado) {
    throw new Error(
      'Faltan PUBLIC_SUPABASE_URL y/o PUBLIC_SUPABASE_ANON_KEY. Ver .env.example.'
    );
  }
  cliente ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return cliente;
}

/**
 * Cliente sin sesion, deliberadamente anonimo.
 *
 * Es el instrumento con el que se comprueba el criterio de aceptacion de la
 * Fase 1: "con la clave anonima, desde el navegador, no se puede leer ni
 * escribir ninguna tabla sin sesion". Sin esto habria que creerselo.
 *
 * `persistSession: false` y `storageKey` propio para que no herede ni pise la
 * sesion del administrador que esta usando el panel en esa misma pestana.
 */
export function getSupabaseAnonimo(): SupabaseClient {
  if (!supabaseConfigurado) {
    throw new Error('Faltan las variables de entorno de Supabase.');
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'sb-prueba-anonima',
    },
  });
}

/**
 * Tablas que la prueba de RLS recorre.
 *
 * Se escribe a mano y no se deriva del catalogo de Postgres: eso es una
 * debilidad conocida, no un descuido. `latidos` (0010) nacio con RLS activo y
 * quedo fuera de esta lista durante un tiempo porque nada obligaba a tocar
 * este archivo al agregar una tabla. La proxima tabla nueva tiene el mismo
 * riesgo — anadirla aqui en el mismo commit que la crea.
 */
export const TABLAS = [
  'administradores',
  'configuracion',
  'qr_codes',
  'qr_cambios',
  'escaneos',
  'escaneos_diarios',
  'empleados',
  'eventos',
  'contactos',
  'inscripciones',
  'leads',
  'latidos',
  'tarjeta_eventos',
] as const;

/**
 * Comprueba que un código QR existe y está activo. Pensada para el BUILD.
 *
 * Usa `fetch` directo y no el cliente: en el build no hay sesión que persistir
 * ni token que renovar, y crear un cliente completo para una pregunta de sí o
 * no es traer una maquinaria que no hace falta.
 *
 * Devuelve `null` cuando no se pudo consultar. Es deliberado: el build NO debe
 * depender de que Supabase esté disponible. Un código roto tiene que romper el
 * build; Supabase caído, no — si no, el sitio deja de poder publicarse por algo
 * que no tiene nada que ver con el sitio.
 *
 * No llama a `resolver_qr` a propósito: esa registra un escaneo, y validar en
 * cada build metería escaneos falsos en las estadísticas.
 */
export async function codigoExiste(codigo: string): Promise<boolean | null> {
  if (!supabaseConfigurado) return null;

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/codigo_existe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ p_codigo: codigo }),
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    return (await r.json()) === true;
  } catch {
    return null;
  }
}

/** Lo que devuelve `tarjeta_empleado()` — ver 0012_tarjetas_empleados.sql. */
export interface DatosTarjetaEmpleado {
  nombre: string;
  cargo: string | null;
  area: string | null;
  sede: string | null;
  bio: string | null;
  telefono: string | null;
  whatsapp: string | null;
  email: string | null;
  foto_url: string | null;
  redes: Record<string, string>;
}

/**
 * Ficha pública de UN empleado activo, por slug. Para `src/pages/tarjetas/`.
 *
 * Mismo motivo que `codigoExiste()` para usar `fetch` y no el cliente: es una
 * pregunta de una sola vez, sin sesión que mantener, y esta llamada corre en
 * el navegador de quien acaba de escanear una credencial — no hace falta
 * cargar el SDK completo para eso.
 *
 * `null` cubre dos casos a propósito y no se distinguen: el slug no existe, o
 * el empleado está de baja. `tarjeta_empleado()` ya los trata igual en la
 * base — acá solo se respeta esa decisión.
 */
export async function tarjetaEmpleado(slug: string): Promise<DatosTarjetaEmpleado | null> {
  if (!supabaseConfigurado) return null;

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/tarjeta_empleado`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ p_slug: slug }),
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    const filas = await r.json();
    return Array.isArray(filas) && filas.length > 0 ? filas[0] : null;
  } catch {
    return null;
  }
}

/** Una fila de `directorio_empleados()` — ver 0012_tarjetas_empleados.sql. */
export interface FilaDirectorio {
  slug: string;
  nombre: string;
  cargo: string | null;
  foto_url: string | null;
}

/**
 * Directorio público de empleados activos, para `src/pages/empleados/`.
 *
 * `null` significa que no se pudo consultar (red caída, Supabase pausado);
 * un array vacío significa "consultó bien, todavía no hay nadie publicado".
 * La página tiene que distinguir las dos cosas para no decirle a un visitante
 * "no hay empleados" cuando en realidad Supabase no respondió.
 */
export async function directorioEmpleados(): Promise<FilaDirectorio[] | null> {
  if (!supabaseConfigurado) return null;

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/directorio_empleados`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    const filas = await r.json();
    return Array.isArray(filas) ? filas : null;
  } catch {
    return null;
  }
}

/** Eventos medibles dentro de una ficha. Ver 0015_analitica_tarjetas.sql. */
export type EventoTarjeta =
  | 'vista' | 'clic_llamar' | 'clic_whatsapp' | 'clic_correo'
  | 'guardar_contacto' | 'compartir';

/**
 * Registra un evento de interacción con la ficha de un empleado.
 *
 * "Fire-and-forget" a propósito: a quien está viendo la ficha no le importa
 * si esto se registró o no, y no debe esperar por ello ni ver un error si
 * falla. `registrar_evento_tarjeta()` ya es silenciosa del lado de la base
 * (no revela si el slug existe); acá el mismo criterio, sin relanzar nunca.
 */
export function registrarEventoTarjeta(slug: string, evento: EventoTarjeta): void {
  if (!supabaseConfigurado) return;

  fetch(`${SUPABASE_URL}/rest/v1/rpc/registrar_evento_tarjeta`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ p_slug: slug, p_evento: evento, p_referrer: document.referrer || null }),
  }).catch(() => {});
}
