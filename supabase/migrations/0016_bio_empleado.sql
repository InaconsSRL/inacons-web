-- ============================================================================
--  0016 — "SOBRE MI" DEL EMPLEADO
--  Ejecutar despues de 0015.
--
--  La ficha rediseñada (set 2026) agrega una seccion breve de presentacion
--  personal, debajo de "Informacion profesional". Es texto libre, opcional --
--  si no se carga, la seccion no se pinta.
-- ============================================================================

begin;

alter table public.empleados add column if not exists bio text;

-- create or replace no alcanza aca: cambia las columnas de salida (agrega
-- bio), y Postgres exige DROP FUNCTION primero cuando cambia el tipo de fila
-- definido por los parametros OUT. Ya paso una vez con 0014 y la sede.
drop function if exists public.tarjeta_empleado(text);

create function public.tarjeta_empleado(p_slug text)
returns table (
  nombre   text,
  cargo    text,
  area     text,
  sede     text,
  bio      text,
  telefono text,
  whatsapp text,
  email    text,
  foto_url text,
  redes    jsonb
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select nombre, cargo, area, sede, bio, telefono, whatsapp, email, foto_url, redes
  from public.empleados
  where slug = p_slug and estado = 'activo';
$$;

comment on function public.tarjeta_empleado(text) is
  'Datos publicos de UN empleado activo, por slug. Cero filas si no existe o '
  'si esta de baja -- no se puede distinguir una cosa de la otra desde afuera. '
  'La usa src/pages/tarjetas/ (la ficha individual, detras de /empleados/SLUG/).';

grant execute on function public.tarjeta_empleado(text) to anon;

commit;


-- ── Verificacion ────────────────────────────────────────────────────────────
select nombre, sede, bio from public.tarjeta_empleado('nadie-trabaja-aqui');
