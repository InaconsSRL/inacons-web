-- ============================================================================
--  0003 — AGREGADO DIARIO DE ESCANEOS
--  Ejecutar despues de 0002.
--
--  Requiere la extension pg_cron. Si falla la primera linea, activarla antes
--  en el panel: Database > Extensions > buscar "pg_cron" > Enable. Ese fallo
--  no afecta a 0001 ni 0002; por eso esto va en un archivo aparte.
-- ============================================================================

-- Todo el archivo va en una sola transaccion: si algo falla a la mitad, no
-- queda nada a medio aplicar. Sin esto, el SQL Editor de Supabase ejecuta
-- sentencia por sentencia y un error deja la base en un estado intermedio que
-- hay que deshacer a mano para poder reintentar.
begin;

create extension if not exists pg_cron;


-- ── El dia es el dia en Lima, no en UTC ─────────────────────────────────────
--
-- Supabase guarda todo en UTC. Peru esta en UTC-5 y sin horario de verano, asi
-- que las cinco primeras horas de cada dia UTC son todavia la tarde anterior
-- en Lima. Agregando por dia UTC, un escaneo de las 9 de la noche del lunes
-- aparece contado el martes, y el tablero le muestra al administrador el dia
-- equivocado justo cuando compara con lo que recuerda del stand.
--
-- Recalcula los ultimos dias en vez del anterior solo: si una noche el cron no
-- corre, la siguiente rellena el hueco sin que nadie tenga que darse cuenta.
create or replace function public.agregar_escaneos_diarios(p_dias_atras integer default 3)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_desde date := (now() at time zone 'America/Lima')::date - p_dias_atras;
  v_filas integer;
begin
  insert into public.escaneos_diarios (qr_codigo, dia, total)
  select
    qr_codigo,
    (fecha at time zone 'America/Lima')::date as dia,
    count(*)
  from public.escaneos
  where resultado = 'ok'
    and (fecha at time zone 'America/Lima')::date >= v_desde
  group by 1, 2
  on conflict (qr_codigo, dia) do update set total = excluded.total;

  get diagnostics v_filas = row_count;
  return v_filas;
end;
$$;

comment on function public.agregar_escaneos_diarios(integer) is
  'Recalcula escaneos_diarios por dia de Lima. Idempotente: se puede correr las veces que haga falta.';


-- ── Programacion ────────────────────────────────────────────────────────────
--
-- 08:00 UTC = 03:00 en Lima. De madrugada, con la base ociosa.
--
-- unschedule antes de schedule para poder reejecutar este archivo entero sin
-- terminar con dos tareas haciendo lo mismo.
select cron.unschedule('agregar-escaneos-diarios')
where exists (select 1 from cron.job where jobname = 'agregar-escaneos-diarios');

select cron.schedule(
  'agregar-escaneos-diarios',
  '0 8 * * *',
  $$ select public.agregar_escaneos_diarios(); $$
);


commit;


-- ── Verificacion ────────────────────────────────────────────────────────────
-- Tiene que devolver una fila con el schedule '0 8 * * *' y active = true.
select jobname, schedule, active from cron.job where jobname = 'agregar-escaneos-diarios';
