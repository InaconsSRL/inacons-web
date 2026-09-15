-- ============================================================================
--  0005 — EL REDIRECTOR PUEDE RESOLVER
--  Fase 2. Ejecutar despues de 0004.
--
--  Hasta ahora `resolver_qr()` existia sin permiso para nadie: una puerta sin
--  llave porque todavia no habia nada del otro lado. Ya existe el redirector,
--  asi que se le da la llave -- y de paso la funcion aprende a defenderse de
--  un destino fuera de los dominios permitidos.
-- ============================================================================


-- ── Un resultado nuevo: destino bloqueado ───────────────────────────────────
--
-- Va FUERA de la transaccion de abajo a proposito. Postgres no deja usar un
-- valor de enum recien creado dentro de la misma transaccion que lo crea, asi
-- que este ALTER se confirma solo antes de que empiece el resto.
alter type public.escaneo_resultado add value if not exists 'bloqueado';


begin;

-- ── Proteccion contra redireccion abierta ───────────────────────────────────
--
-- `index.php` compara el host del destino contra una lista blanca antes de
-- redirigir. Sin eso, quien pueda escribir un destino convierte el dominio de
-- INACONS en un trampolin: un enlace que empieza en home.inacons.com.pe y
-- termina donde sea, que es exactamente lo que necesita un correo de phishing
-- para parecer legitimo.
--
-- La proteccion se conserva, pero cambia de sitio: la lista pasa de una
-- constante en un PHP ignorado por git a `configuracion.hosts_permitidos`.
--
-- Por que se movio. Con la lista en PHP habria DOS listas -- la del servidor y
-- la que el panel usa para validar al guardar -- y el dia que alguien agregue
-- un dominio desde el panel, el redirector seguiria rechazandolo. Un fallo que
-- se ve como "guardé el destino y no funciona", sin ningun error que lo
-- explique. Una sola lista, editable desde el panel, y el control en el punto
-- donde se produce el destino.
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
  v_codigo    text := upper(trim(p_codigo));
  v_fila      public.qr_codes%rowtype;
  v_resultado public.escaneo_resultado;
  v_hosts     text[];
  v_host      text;
begin
  select * into v_fila from public.qr_codes where codigo = v_codigo;

  if not found then
    v_resultado := 'desconocido';

  elsif not v_fila.activo then
    v_resultado := 'inactivo';

  else
    -- Host del destino: se descarta el esquema, el `usuario@` si lo hubiera y
    -- el puerto. El `usuario@` importa: `https://inacons.com.pe@evil.com/` NO
    -- apunta a inacons.com.pe, apunta a evil.com, y leyendolo rapido parece lo
    -- contrario.
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

  -- Resolver y registrar en la misma transaccion: o pasan las dos cosas o no
  -- pasa ninguna. No puede quedar una redireccion sin contar.
  insert into public.escaneos (qr_codigo, resultado, user_agent, referrer, dispositivo, pais_aprox)
  values (v_codigo, v_resultado, p_user_agent, p_referrer, p_dispositivo, p_pais);

  return query select
    case when v_resultado = 'ok' then v_fila.destino_url else null end,
    v_fila.codigo is not null,
    coalesce(v_fila.activo, false);
end;
$$;


-- ── La llave para el redirector ─────────────────────────────────────────────
--
-- El rol anonimo puede EJECUTAR la funcion, y sigue sin poder leer ni una
-- tabla. Esa es toda la gracia del diseno: la funcion responde por un codigo
-- que ya conoces -- lo que hace un escaner -- y no hay forma de pedirle la
-- lista. Con un SELECT sobre `qr_codes` bastaria una peticion para llevarse el
-- catalogo completo de destinos.
--
-- Consecuencia practica: el PHP del servidor no guarda ningun secreto. Le
-- alcanza con la clave publicable, la misma que ya viaja en el JavaScript del
-- sitio.
grant execute on function public.resolver_qr(text, text, text, text, text) to anon;

commit;


-- ── Verificacion ────────────────────────────────────────────────────────────
-- Los cuatro casos. El ultimo tiene que decir 'bloqueado' y devolver destino
-- nulo aunque el codigo exista y este activo.
begin;
  insert into public.qr_codes (codigo, tipo, destino_url, activo, notas)
  values ('ZZBLOQ', 'url', 'https://evil.example.com/', true, 'Prueba de allowlist.')
  on conflict (codigo) do nothing;

  select 'activo'      as caso, * from public.resolver_qr('expomina')
  union all select 'desactivado', * from public.resolver_qr('K9M2P')
  union all select 'inexistente', * from public.resolver_qr('NADA')
  union all select 'host no permitido', * from public.resolver_qr('ZZBLOQ');
rollback;
