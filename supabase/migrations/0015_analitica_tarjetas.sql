-- ============================================================================
--  0015 — ANALITICA DE LA FICHA DE EMPLEADO
--  Ejecutar despues de 0014.
--
--  Hoy solo se mide el escaneo del QR fisico de la credencial (`escaneos`).
--  Nada mide lo que pasa DESPUES: si alguien abrio la ficha, si toco llamar
--  o WhatsApp, si guardo el contacto. Sin eso, la tarjeta es una hoja de
--  papel digital -- no hay forma de saber si sirve para algo.
--
--  Mismo patron de seguridad que el resto del esquema: nunca una politica
--  amplia sobre datos de personas. Una funcion angosta que solo sabe hacer
--  una cosa -- anotar un evento contra un slug activo -- y nada mas.
-- ============================================================================

begin;

create table if not exists public.tarjeta_eventos (
  id          bigint generated always as identity primary key,
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  evento      text not null check (evento in (
                'vista', 'clic_llamar', 'clic_whatsapp', 'clic_correo',
                'guardar_contacto', 'compartir'
              )),
  fecha       timestamptz not null default now(),
  referrer    text
);

-- El panel siempre pregunta "eventos de ESTE empleado, mas recientes
-- primero" -- mismo criterio que escaneos_codigo_fecha_idx en 0001.
create index if not exists tarjeta_eventos_empleado_fecha_idx
  on public.tarjeta_eventos (empleado_id, fecha desc);

alter table public.tarjeta_eventos enable row level security;

drop policy if exists admin_lee on public.tarjeta_eventos;
drop policy if exists admin_escribe on public.tarjeta_eventos;

create policy admin_lee on public.tarjeta_eventos
  for select to authenticated using (public.es_admin());

create policy admin_escribe on public.tarjeta_eventos
  for all to authenticated using (public.es_admin()) with check (public.es_admin());

revoke all on public.tarjeta_eventos from anon;


-- ── Registrar un evento ──────────────────────────────────────────────────
--
-- Resuelve el slug a un empleado ACTIVO antes de insertar. Si no existe o
-- esta de baja, no pasa nada -- ni error, ni fila -- mismo criterio
-- anti-enumeracion que tarjeta_empleado(): no hay forma de usar esto para
-- averiguar si un slug existe.
create or replace function public.registrar_evento_tarjeta(
  p_slug     text,
  p_evento   text,
  p_referrer text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_empleado_id uuid;
begin
  if p_evento not in (
    'vista', 'clic_llamar', 'clic_whatsapp', 'clic_correo',
    'guardar_contacto', 'compartir'
  ) then
    return;
  end if;

  select id into v_empleado_id
  from public.empleados
  where slug = p_slug and estado = 'activo';

  if v_empleado_id is null then
    return;
  end if;

  insert into public.tarjeta_eventos (empleado_id, evento, referrer)
  values (v_empleado_id, p_evento, substr(coalesce(p_referrer, ''), 1, 400));
end;
$$;

comment on function public.registrar_evento_tarjeta(text, text, text) is
  'Anota un evento de interaccion con la ficha de un empleado activo. '
  'Silenciosa si el slug no existe o esta de baja -- no revela cual de las dos cosas.';

grant execute on function public.registrar_evento_tarjeta(text, text, text) to anon;

commit;


-- ── Verificacion ────────────────────────────────────────────────────────────
-- Un slug inexistente no debe insertar nada.
select public.registrar_evento_tarjeta('nadie-trabaja-aqui', 'vista');
select count(*) as filas_de_slug_inexistente from public.tarjeta_eventos;

-- Un evento fuera de la lista permitida tampoco inserta nada, con un slug real.
begin;
  insert into public.empleados (slug, nombre, estado)
  values ('prueba-0015', 'Prueba De Verificacion', 'activo');

  select public.registrar_evento_tarjeta('prueba-0015', 'evento-inventado');
  select count(*) as debe_ser_cero from public.tarjeta_eventos where empleado_id =
    (select id from public.empleados where slug = 'prueba-0015');

  select public.registrar_evento_tarjeta('prueba-0015', 'vista');
  select count(*) as debe_ser_uno from public.tarjeta_eventos where empleado_id =
    (select id from public.empleados where slug = 'prueba-0015');
rollback;
