-- ============================================================================
--  0014 — SEDE DEL EMPLEADO
--  Ejecutar despues de 0013.
--
--  `empleados` tenia area (departamento: Tecnologia, Operaciones...) pero
--  ningun campo de ciudad. INACONS opera en varias sedes (Lima, Huancayo,
--  Pasco, segun el mapa de cobertura del home) y hoy no hay forma de decir
--  desde donde trabaja cada persona. La ficha publica lo muestra junto al
--  area: "Tecnologia · Huancayo".
-- ============================================================================

begin;

alter table public.empleados add column if not exists sede text;

-- Redefine tarjeta_empleado() para incluir sede. Mismo cuerpo de
-- 0012_tarjetas_empleados.sql, una columna mas.
--
-- directorio_empleados() NO cambia: el directorio se queda con avatar,
-- nombre y cargo. La sede solo aparece en la ficha individual, que es donde
-- la propuesta original la mostraba -- el directorio es para escanear
-- nombres rapido, no para filtrar por ciudad.
--
-- create or replace no alcanza aca: cambia las columnas de salida (agrega
-- sede), y Postgres exige DROP FUNCTION primero cuando cambia el tipo de
-- fila definido por los parametros OUT -- no es un cambio de cuerpo, es un
-- cambio de firma. Sin el drop, el error es "cannot change return type of
-- existing function".
drop function if exists public.tarjeta_empleado(text);

create function public.tarjeta_empleado(p_slug text)
returns table (
  nombre   text,
  cargo    text,
  area     text,
  sede     text,
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
  select nombre, cargo, area, sede, telefono, whatsapp, email, foto_url, redes
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
-- La firma nueva de tarjeta_empleado() tiene que traer la columna sede.
select nombre, area, sede from public.tarjeta_empleado('nadie-trabaja-aqui');
