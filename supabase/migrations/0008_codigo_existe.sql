-- ============================================================================
--  0008 — COMPROBAR SI UN CODIGO EXISTE, SIN REGISTRAR UN ESCANEO
--  Ejecutar despues de 0007.
--
--  Nace de un fallo real. Los recursos de /recursos/ declaran su codigo QR en
--  el frontmatter de un archivo Markdown, y los codigos viven en esta base.
--  Son dos sitios que no se hablan, y se habian separado sin que nadie lo
--  notara:
--
--      markdown        base de datos
--      canal-etico  -> canal_etico     (diferencia de guion)
--      ticket-ti    -> tickets_ti      (singular contra plural)
--
--  El segundo generaba un QR hacia un codigo que no existe. Y ese recurso es
--  un flyer A4 pensado para imprimirse: el fallo se descubre cuando alguien
--  escanea el papel, que es el momento en que ya no se puede arreglar.
--
--  Con esta funcion el build puede comprobar cada codigo antes de publicar, y
--  fallar ahi -- donde arreglarlo cuesta un commit.
--
--  Por que una funcion y no un SELECT: si el rol anonimo pudiera leer
--  `qr_codes`, podria leerla entera, y la clave anonima viaja en el HTML de
--  cualquier pagina. Esta solo responde si/no sobre un codigo que ya conoces.
--  No permite recorrer el catalogo.
--
--  Y por que no reutilizar `resolver_qr`: esa registra un escaneo. Validar en
--  cada build meteria escaneos falsos en las estadisticas, que es justo lo que
--  arruina un tablero.
-- ============================================================================

begin;

create or replace function public.codigo_existe(p_codigo text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.qr_codes
    where translate(codigo, '-', '_') = translate(upper(trim(p_codigo)), '-', '_')
      and activo
  );
$$;

comment on function public.codigo_existe(text) is
  'Si un codigo existe y esta activo. No registra escaneo. La usa el build para validar los codigos declarados en src/content/recursos/.';

grant execute on function public.codigo_existe(text) to anon;

commit;


-- ── Verificacion ────────────────────────────────────────────────────────────
-- Los dos primeros true, los dos ultimos false.
select 'canal_etico'  as codigo, public.codigo_existe('canal_etico')  as existe
union all select 'canal-etico',  public.codigo_existe('canal-etico')
union all select 'ticket-ti',    public.codigo_existe('ticket-ti')
union all select 'inventado',    public.codigo_existe('inventado');
