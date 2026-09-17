-- ============================================================================
--  0011 — SANEAMIENTO DE `escaneos`
--  Ejecutar despues de 0010.
--
--  `resolver_qr()` es la unica funcion que el rol anonimo puede ejecutar, y
--  cada llamada hace un INSERT en `escaneos` -- exista el codigo o no, en la
--  misma transaccion que la resolucion, a proposito (0007). Eso significa que
--  cualquiera que sepa que existe `/r/` puede generar filas sin limite, sin
--  autenticarse: un bucle simple contra codigos al azar llena la tabla.
--
--  Sobre un plan gratuito con limite de tamano, una tabla llena pone el
--  proyecto en solo lectura. Ahi el INSERT de `resolver_qr()` empieza a
--  fallar, la funcion entera falla, y el redirector responde 503. La garantia
--  que existia para no perder un escaneo ("o pasan las dos cosas o no pasa
--  ninguna") se convierte, bajo disco lleno, en que NINGUN codigo QR impreso
--  vuelve a redirigir. Esta migracion ataca las dos puntas: cuanto pesa cada
--  fila abusiva, y cuanto tiempo se les deja acumularse.
-- ============================================================================

begin;

-- ── 1. No guardar lo que no hace falta cuando el escaneo no es valido ───────
--
-- user_agent y referrer llegan a 400 caracteres cada uno (r/index.php). Son
-- utiles para depurar un escaneo real; para un barrido de codigos inventados
-- no aportan nada y son la parte mas pesada de la fila. `dispositivo` y
-- `pais_aprox` se conservan siempre: pesan poco y sirven igual para notar un
-- patron de abuso en el tablero.
--
-- Misma firma, mismo cuerpo que 0007_codigo_tolerante.sql salvo el INSERT.
create or replace function public.resolver_qr(
  p_codigo      text,
  p_user_agent  text default null,
  p_referrer    text default null,
  p_dispositivo text default null,
  p_pais        text default null
)
returns table (destino text, encontrado boolean, esta_activo boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_codigo    text := translate(upper(trim(p_codigo)), '-', '_');
  v_fila      public.qr_codes%rowtype;
  v_resultado public.escaneo_resultado;
  v_hosts     text[];
  v_host      text;
begin
  select * into v_fila
  from public.qr_codes
  where translate(codigo, '-', '_') = v_codigo;

  if not found then
    v_resultado := 'desconocido';

  elsif not v_fila.activo then
    v_resultado := 'inactivo';

  else
    select hosts_permitidos into v_hosts from public.configuracion where id = 1;

    v_host := lower(
      (regexp_match(coalesce(v_fila.destino_url, ''),
                    '^[a-zA-Z][a-zA-Z0-9+.-]*://(?:[^/@]*@)?([^/:?#]+)'))[1]
    );

    if v_host is null or not (v_host = any(coalesce(v_hosts, array[]::text[]))) then
      v_resultado := 'bloqueado';
    else
      v_resultado := 'ok';
    end if;
  end if;

  insert into public.escaneos (qr_codigo, resultado, user_agent, referrer, dispositivo, pais_aprox)
  values (
    coalesce(v_fila.codigo, v_codigo),
    v_resultado,
    case when v_resultado = 'ok' then p_user_agent else null end,
    case when v_resultado = 'ok' then p_referrer   else null end,
    p_dispositivo,
    p_pais
  );

  return query select
    case when v_resultado = 'ok' then v_fila.destino_url else null end,
    v_fila.codigo is not null,
    coalesce(v_fila.activo, false);
end;
$$;

grant execute on function public.resolver_qr(text, text, text, text, text) to anon;


-- ── 2. Purga programada ─────────────────────────────────────────────────────
--
-- `escaneos_diarios` ya guarda el total por dia y por codigo (0003); purgar
-- el detalle no pierde esa serie historica. 90 dias de margen: de sobra para
-- investigar un escaneo puntual, corto para que la tabla crezca sin limite.
create or replace function public.purgar_escaneos_antiguos(p_dias integer default 90)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_filas integer;
begin
  delete from public.escaneos
  where fecha < now() - (p_dias || ' days')::interval;

  get diagnostics v_filas = row_count;
  return v_filas;
end;
$$;

comment on function public.purgar_escaneos_antiguos(integer) is
  'Borra de escaneos lo mas viejo que p_dias. escaneos_diarios conserva el agregado. Idempotente.';

-- 09:00 UTC = 04:00 en Lima, una hora despues del agregado diario (0003, a las
-- 03:00 Lima): que el total del dia quede sumado antes de borrar el detalle
-- en el que se apoya, aunque en la practica el margen de 90 dias hace que el
-- orden exacto de los dos crons no cambie el resultado.
select cron.unschedule('purgar-escaneos-antiguos')
where exists (select 1 from cron.job where jobname = 'purgar-escaneos-antiguos');

select cron.schedule(
  'purgar-escaneos-antiguos',
  '0 9 * * *',
  $$ select public.purgar_escaneos_antiguos(90); $$
);

commit;


-- ── Verificacion ────────────────────────────────────────────────────────────
--
-- Mismo patron de 0005/0007: llamar a resolver_qr() desde el FROM, no desde
-- la lista de columnas -- ahi si hace falta un LATERAL para pasarle el
-- codigo de una fila real de qr_codes.
--
-- Un codigo inexistente tiene que guardar el escaneo con user_agent NULL. Si
-- hay algun codigo activo en la base, se prueba tambien que ese SI lo guarda.
-- Todo dentro de una transaccion que se deshace: no deja rastro de prueba.
begin;
  select 'inexistente' as caso, * from public.resolver_qr(
    'NOEXISTE-0011', 'agente-de-prueba-0011', null, 'desktop', 'PE'
  );

  select 'inexistente, guardado' as caso, resultado, (user_agent is not null) as guardo_user_agent
  from public.escaneos where qr_codigo = 'NOEXISTE-0011' order by fecha desc limit 1;

  select 'activo' as caso, r.*
  from (select codigo from public.qr_codes where activo limit 1) q
  cross join lateral public.resolver_qr(q.codigo, 'agente-de-prueba-0011', null, 'desktop', 'PE') r;

  select 'activo, guardado' as caso, resultado, (user_agent is not null) as guardo_user_agent
  from public.escaneos
  where qr_codigo = (select codigo from public.qr_codes where activo limit 1)
  order by fecha desc limit 1;
rollback;

-- Tiene que devolver una fila con el schedule '0 9 * * *' y active = true.
select jobname, schedule, active from cron.job where jobname = 'purgar-escaneos-antiguos';
