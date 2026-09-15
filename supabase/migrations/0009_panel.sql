-- ============================================================================
--  0009 — LO QUE EL PANEL NECESITA DE LA BASE
--  Fase 3. Ejecutar despues de 0008.
-- ============================================================================

begin;

-- ── Reasignar un destino, dejando dicho por que ─────────────────────────────
--
-- El trigger de auditoria lee el motivo de `current_setting('app.motivo')`, y
-- ese ajuste tiene que ocurrir en LA MISMA transaccion que el UPDATE. Desde el
-- navegador eso no se puede: cada peticion a la API REST es su propia
-- transaccion, asi que un `set_config` por un lado y un `update` por otro
-- dejarian el motivo en null siempre.
--
-- Con las dos cosas dentro de una funcion, el motivo no es opcional por
-- accidente. Y como la auditoria la escribe el trigger y no esta funcion, no
-- hay forma de reasignar sin dejar rastro ni aunque alguien llame al UPDATE
-- por otro camino.
--
-- SECURITY INVOKER a proposito: corre con los permisos de quien llama, asi que
-- RLS sigue decidiendo. Un autenticado que no sea administrador no actualiza
-- nada, igual que si lo intentara directo.
create or replace function public.reasignar_qr(
  p_codigo  text,
  p_destino text,
  p_motivo  text default null
)
returns public.qr_codes
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_fila public.qr_codes%rowtype;
begin
  if coalesce(trim(p_destino), '') = '' then
    raise exception 'El destino no puede quedar vacio.';
  end if;

  perform set_config('app.motivo', nullif(trim(coalesce(p_motivo, '')), ''), true);

  update public.qr_codes
  set destino_url = trim(p_destino)
  where translate(codigo, '-', '_') = translate(upper(trim(p_codigo)), '-', '_')
  returning * into v_fila;

  if not found then
    raise exception 'No existe el codigo %', p_codigo;
  end if;

  return v_fila;
end;
$$;

grant execute on function public.reasignar_qr(text, text, text) to authenticated;


-- ── Recalcular el agregado a mano ───────────────────────────────────────────
--
-- pg_cron lo corre cada madrugada, pero el panel necesita poder pedirlo: quien
-- acaba de pegar un QR en una pared quiere ver si alguien lo escaneo, y decirle
-- "vuelva manana" es una respuesta que no sirve.
--
-- Es idempotente, asi que pulsarlo dos veces no duplica nada.
grant execute on function public.agregar_escaneos_diarios(integer) to authenticated;

commit;


-- ── Verificacion ────────────────────────────────────────────────────────────
-- Reasigna y comprueba que el motivo quedo registrado. Se deshace al final.
begin;
  select public.reasignar_qr('canal_etico', 'https://home.inacons.com.pe/contacto/', 'prueba de auditoria');
  select qr_codigo, destino_anterior, destino_nuevo, motivo
  from public.qr_cambios where qr_codigo = 'CANAL_ETICO' order by fecha desc limit 1;
rollback;
