-- ============================================================================
--  0012 — TARJETAS DIGITALES DE EMPLEADO (Fase 5, parte publica)
--  Ejecutar despues de 0011.
--
--  `empleados` tiene RLS activo y CERO politicas para anon (0002): hoy nadie
--  sin sesion puede leer ni una fila. Eso es correcto para la tabla completa
--  -- tiene telefono, whatsapp y correo real de personas -- pero la Fase 5
--  necesita publicar dos cosas: la ficha de un empleado activo, y un
--  directorio con todos los activos.
--
--  La salida NO es "agregar una politica de SELECT para anon en empleados".
--  Esa politica expondria la tabla ENTERA a cualquiera que sepa hacer un
--  SELECT * por la API REST -- exactamente lo que este esquema evito en
--  cada tabla desde 0001 (qr_codes nunca tuvo esa politica; resolver_qr() y
--  codigo_existe() son funciones angostas por la misma razon). Aca se repite
--  el patron: dos funciones que contestan una pregunta concreta, nunca un
--  volcado de la tabla.
-- ============================================================================

begin;

-- ── Ficha de UN empleado ─────────────────────────────────────────────────
--
-- Solo responde si esta activo. Sin filas si no existe O si esta de baja --
-- misma logica que codigo_existe(): que no se pueda distinguir "nunca
-- trabajo aqui" de "ya no trabaja aqui" desde afuera. Es tambien el
-- comportamiento que pide la seccion 8 de la especificacion: al pasar a
-- inactivo, la tarjeta deja de estar publicada, sin que haga falta borrar
-- ni el empleado ni el codigo QR de su credencial.
create or replace function public.tarjeta_empleado(p_slug text)
returns table (
  nombre   text,
  cargo    text,
  area     text,
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
  select nombre, cargo, area, telefono, whatsapp, email, foto_url, redes
  from public.empleados
  where slug = p_slug and estado = 'activo';
$$;

comment on function public.tarjeta_empleado(text) is
  'Datos publicos de UN empleado activo, por slug. Cero filas si no existe o '
  'si esta de baja -- no se puede distinguir una cosa de la otra desde afuera. '
  'La usa src/pages/tarjetas/ (la ficha individual, detras de /empleados/SLUG/).';

grant execute on function public.tarjeta_empleado(text) to anon;


-- ── Directorio publico ───────────────────────────────────────────────────
--
-- A proposito NO devuelve telefono, whatsapp ni correo: eso solo se ve en
-- la ficha de cada persona, una por una. Con la lista completa devolviendo
-- contacto directo, un bot se lleva el correo de toda la plantilla en una
-- sola llamada; visitando ficha por ficha tiene la misma friccion que
-- recolectar tarjetas de presentacion a mano.
--
-- order by orden, nombre: mismo criterio que empleados_publicados_idx
-- (0001), que existe exactamente para esta consulta.
create or replace function public.directorio_empleados()
returns table (
  slug     text,
  nombre   text,
  cargo    text,
  foto_url text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select slug, nombre, cargo, foto_url
  from public.empleados
  where estado = 'activo'
  order by orden, nombre;
$$;

comment on function public.directorio_empleados() is
  'Lista publica de empleados activos: solo lo que va en el directorio, sin '
  'contacto directo. La usa src/pages/empleados/index.astro.';

grant execute on function public.directorio_empleados() to anon;

commit;


-- ── Verificacion ────────────────────────────────────────────────────────────
--
-- Sin datos reales todavia, esto solo confirma que las funciones existen y
-- responden vacio en vez de fallar. Para probar el camino "si existe": dentro
-- de una transaccion que se deshace, un empleado de prueba activo.
select 'tarjeta de slug inexistente' as caso, count(*) from public.tarjeta_empleado('nadie-trabaja-aqui');
select 'directorio, hoy'            as caso, count(*) from public.directorio_empleados();

begin;
  insert into public.empleados (slug, nombre, cargo, area, telefono, whatsapp, email, estado, orden)
  values ('prueba-0012', 'Prueba De Verificacion', 'Cargo de prueba', 'Operaciones',
          '+51 999 999 999', '+51999999999', 'prueba@inacons.com.pe', 'activo', 999);

  select 'ficha de un activo, si existe' as caso, * from public.tarjeta_empleado('prueba-0012');
  select 'aparece en el directorio'      as caso, * from public.directorio_empleados() where slug = 'prueba-0012';

  update public.empleados set estado = 'inactivo' where slug = 'prueba-0012';
  select 'de baja, ya no aparece' as caso, count(*) from public.tarjeta_empleado('prueba-0012');
rollback;
