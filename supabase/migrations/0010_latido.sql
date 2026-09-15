-- ============================================================================
--  0010 — LATIDO CONTRA LA SUSPENSION
--  Ejecutar despues de 0009.
--
--  El plan gratuito de Supabase pausa el proyecto tras una semana sin
--  actividad. Con QRs impresos circulando eso es una caida sin aviso: la gente
--  escanea y no llega a ningun lado, y nadie se entera hasta que alguien se
--  queja.
--
--  Esto lo evita. Una tarea programada fuera de Supabase llama a `latido()`
--  cada pocos dias y el proyecto nunca cumple la semana ociosa.
--
--  Por que NO se puede resolver con pg_cron: pg_cron corre DENTRO de la base.
--  Si el proyecto se pausa, pg_cron se pausa con el. Lo que mantiene vivo al
--  proyecto tiene que venir de afuera -- aqui, de GitHub Actions.
--
--  ── LO QUE ESTO NO RESUELVE ────────────────────────────────────────────────
--  El plan gratuito no tiene NINGUN respaldo. Cero. Un latido evita la pausa,
--  pero no devuelve una tabla borrada por error ni una migracion mal aplicada.
--  Cuando entren contactos de personas reales (Fase 4), la razon para pagar
--  sigue siendo esa, no la pausa. Ver la seccion 10 de la especificacion.
-- ============================================================================

begin;

-- Fila unica, igual que `configuracion`: el check hace imposible una segunda.
create table if not exists public.latidos (
  id     smallint primary key default 1 check (id = 1),
  ultimo timestamptz not null default now(),
  total  bigint not null default 0
);

insert into public.latidos (id) values (1) on conflict (id) do nothing;

alter table public.latidos enable row level security;
-- Sin politicas, a proposito: no se lee ni se escribe por la API. Solo la
-- funcion de abajo la toca, y lo hace por dentro porque es SECURITY DEFINER.


-- ── El latido ───────────────────────────────────────────────────────────────
--
-- Escribe en vez de leer, por dos razones:
--
--   1. Una escritura es actividad sin ambiguedad. Una lectura tambien deberia
--      contar, pero no depende de nosotros como lo mida Supabase, y no es algo
--      que convenga averiguar el dia que el proyecto amanezca pausado.
--
--   2. Deja rastro. Si la tarea programada se cae en silencio -- GitHub
--      desactiva los cron de repositorios inactivos, y eso pasa --, `ultimo`
--      lo dice. Sin el, la primera senal de que el latido murio seria la pausa.
--
-- El rol anonimo puede ejecutarla y no puede hacer nada mas: la tabla no tiene
-- politicas. Lo peor que logra quien la llame de mas es incrementar un
-- contador, que es exactamente para lo que esta.
create or replace function public.latido()
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ultimo timestamptz;
begin
  update public.latidos
  set ultimo = now(), total = total + 1
  where id = 1
  returning ultimo into v_ultimo;

  return v_ultimo;
end;
$$;

revoke all on function public.latido() from public;
grant execute on function public.latido() to anon, authenticated;

commit;


-- ── Verificacion ────────────────────────────────────────────────────────────
select public.latido() as primer_latido;
select ultimo, total from public.latidos;
