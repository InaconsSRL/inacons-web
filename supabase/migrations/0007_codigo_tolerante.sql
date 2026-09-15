-- ============================================================================
--  0007 — EL GUION BAJO Y EL GUION MEDIO SON EL MISMO CODIGO
--  Ejecutar despues de 0006.
--
--  Por que.
--
--  `canal_etico` lleva guion BAJO y su destino es `/canal-etico/`, con guion
--  MEDIO. Alguien que lee el codigo impreso y lo teclea se equivoca, y no por
--  distraccion: el guion bajo se apoya en la linea base, desaparece bajo un
--  subrayado, y en muchas tipografias a tamano chico es indistinguible del
--  medio. Ya paso en la primera prueba real de este sistema.
--
--  Es el mismo problema que la seccion 5 de la especificacion ya resuelve para
--  los codigos opacos, donde prohibe 0/O y 1/I/L "sin ambiguedades visuales".
--  Aquella regla protege al codigo generado; esta protege al escrito a mano.
--  Y es la misma clase de tolerancia que la insensibilidad a mayusculas, que
--  ya estaba aceptada.
--
--  El almacenamiento no cambia: `canal_etico` sigue guardado con guion bajo, y
--  eso es lo que aparece en el panel y en los informes. Lo unico que cambia es
--  que la BUSQUEDA no distingue uno de otro.
-- ============================================================================

begin;

-- ── Dos codigos no pueden diferenciarse solo en el guion ────────────────────
--
-- Sin esto, `MI-CODIGO` y `MI_CODIGO` podrian existir a la vez y la resolucion
-- devolveria cualquiera de los dos. El indice unico lo hace imposible de
-- crear, en vez de dejarlo fallar mas tarde de forma silenciosa.
create unique index if not exists qr_codes_forma_normalizada
  on public.qr_codes (translate(codigo, '-', '_'));


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
  -- Mayusculas y guion unificado. Las dos normalizaciones responden al mismo
  -- criterio: quien teclea una URL desde un papel no deberia poder fallar por
  -- algo que no puede ver.
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

  -- Se registra el codigo REAL cuando se encontro, y lo tecleado cuando no.
  -- Asi el informe no inventa un codigo que no existe, y a la vez deja ver que
  -- estuvo intentando la gente.
  insert into public.escaneos (qr_codigo, resultado, user_agent, referrer, dispositivo, pais_aprox)
  values (coalesce(v_fila.codigo, v_codigo), v_resultado, p_user_agent, p_referrer, p_dispositivo, p_pais);

  return query select
    case when v_resultado = 'ok' then v_fila.destino_url else null end,
    v_fila.codigo is not null,
    coalesce(v_fila.activo, false);
end;
$$;

grant execute on function public.resolver_qr(text, text, text, text, text) to anon;

commit;


-- ── Verificacion ────────────────────────────────────────────────────────────
-- Las cuatro primeras filas tienen que traer el mismo destino: son el mismo
-- codigo escrito de cuatro maneras. La ultima sigue sin existir.
select 'guion bajo'        as escrito, * from public.resolver_qr('canal_etico')
union all select 'guion medio',        * from public.resolver_qr('canal-etico')
union all select 'MAYUS guion medio',  * from public.resolver_qr('CANAL-ETICO')
union all select 'MAYUS guion bajo',   * from public.resolver_qr('CANAL_ETICO')
union all select 'inexistente',        * from public.resolver_qr('canal-etico-x');
