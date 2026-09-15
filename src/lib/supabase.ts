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

/** Tablas que la prueba de RLS recorre. Es el esquema completo de la seccion 6. */
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
] as const;
