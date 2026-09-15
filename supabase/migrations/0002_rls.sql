-- ============================================================================
--  0002 — SEGURIDAD A NIVEL DE FILA (RLS)
--  Ejecutar inmediatamente despues de 0001. Entre uno y otro la base esta
--  abierta: las tablas existen y todavia no las protege nada.
-- ============================================================================

-- Todo el archivo va en una sola transaccion: si algo falla a la mitad, no
-- queda nada a medio aplicar. Sin esto, el SQL Editor de Supabase ejecuta
-- sentencia por sentencia y un error deja la base en un estado intermedio que
-- hay que deshacer a mano para poder reintentar.
begin;
--
--  Por que esto no es opcional.
--
--  Supabase publica la base entera como API REST. La clave anonima que la
--  abre es publica por diseno: viaja dentro del JavaScript de cualquier
--  pagina del sitio, cualquiera la lee con Ver codigo fuente. No es un
--  secreto y no tiene sentido tratarla como tal.
--
--  Lo unico que separa esa clave de la tabla de contactos es RLS. Sin RLS,
--  publicar el sitio es publicar la base de datos.
--
--  El modelo que sigue es "denegar todo, despues abrir lo justo":
--    - RLS activo en todas las tablas.
--    - Sin politica = sin acceso. No hay que escribir la denegacion.
--    - Las unicas politicas que existen exigen es_admin().
--    - El rol anonimo no tiene NI UNA politica. No lee ni escribe nada.
--
--  El rol service_role se salta RLS por diseno; es el que usa el SQL Editor.
--  Esa clave no aparece jamas en el navegador ni en este repositorio.
-- ============================================================================


-- ── Activar RLS en todo ─────────────────────────────────────────────────────
alter table public.administradores  enable row level security;
alter table public.configuracion    enable row level security;
alter table public.qr_codes         enable row level security;
alter table public.qr_cambios       enable row level security;
alter table public.escaneos         enable row level security;
alter table public.escaneos_diarios enable row level security;
alter table public.empleados        enable row level security;
alter table public.eventos          enable row level security;
alter table public.contactos        enable row level security;
alter table public.inscripciones    enable row level security;
alter table public.leads            enable row level security;


-- ── administradores: sin politicas, a proposito ─────────────────────────────
--
-- Nadie la lee ni la escribe por la API, ni siquiera un administrador. Si un
-- administrador pudiera escribir aqui, un administrador comprometido podria
-- agregar complices; y si pudiera leerla, un atacante sabria a quien atacar.
-- Se edita solo desde el SQL Editor. es_admin() la consulta por dentro porque
-- es SECURITY DEFINER, que es precisamente para esto.


-- ── Todo lo demas: solo administradores ─────────────────────────────────────
--
-- `using` decide que filas se ven y cuales se pueden modificar o borrar.
-- `with check` valida las filas que entran en un insert o update. Hacen falta
-- las dos: sin `with check`, alguien podria insertar una fila que despues no
-- tiene permiso de leer.
do $$
declare
  t text;
begin
  foreach t in array array[
    'configuracion', 'qr_codes', 'qr_cambios', 'escaneos', 'escaneos_diarios',
    'empleados', 'eventos', 'contactos', 'inscripciones', 'leads'
  ]
  loop
    execute format('drop policy if exists admin_lee on public.%I', t);
    execute format('drop policy if exists admin_escribe on public.%I', t);

    execute format(
      'create policy admin_lee on public.%I for select to authenticated using (public.es_admin())', t);

    execute format(
      'create policy admin_escribe on public.%I for all to authenticated '
      'using (public.es_admin()) with check (public.es_admin())', t);
  end loop;
end $$;


-- ── Segundo cerrojo: quitarle los permisos de tabla al rol anonimo ──────────
--
-- Con RLS activo y cero politicas, el rol anonimo ya no puede leer nada. Esto
-- es redundante y se hace igual: RLS filtra filas, los GRANT controlan el
-- acceso a la tabla. Si alguna vez se escribe una politica de mas por error,
-- este revoke la deja sin efecto para el rol anonimo.
--
-- Los permisos de insercion del rol anonimo sobre `escaneos` (Fase 2) e
-- `inscripciones` (Fase 4) se otorgaran en esas fases, uno por uno, junto con
-- el codigo que los necesita.
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Ojo con las funciones: nacen con EXECUTE concedido al pseudo-rol PUBLIC, y
-- anon lo hereda de ahi. Revocarselo a anon no quita ese grant heredado; hay
-- que quitarselo a PUBLIC. Es un permiso que parece cerrado leyendo el codigo
-- y esta abierto en la base.
revoke all on all functions in schema public from public, anon;

-- es_admin() la evalua cada politica con los permisos de quien consulta, asi
-- que `authenticated` tiene que poder ejecutarla. Sin este grant, RLS no
-- filtra: falla, y el panel se queda sin poder leer nada estando dentro.
grant execute on function public.es_admin() to authenticated;
grant execute on function public.generar_codigo_opaco(integer) to authenticated;

-- Que lo que se cree mas adelante nazca igual de cerrado, sin depender de que
-- alguien se acuerde de repetir el revoke.
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from public, anon;


commit;


-- ── Verificacion ────────────────────────────────────────────────────────────
--
-- Esta consulta tiene que devolver CERO filas. Cada fila que devuelva es una
-- tabla publicada sin proteccion.
select
  c.relname as tabla_sin_proteger
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relrowsecurity = false;
