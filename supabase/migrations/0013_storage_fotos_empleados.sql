-- ============================================================================
--  0013 — BUCKET DE FOTOS DE EMPLEADO
--  Ejecutar despues de 0012.
--
--  Hasta ahora ninguna imagen del sitio se subia desde el navegador: todas
--  viven como archivo estatico en public/assets/imagenes/, cargadas a mano al
--  repositorio. Las fotos de empleado son distintas -- las sube un
--  administrador desde /panel/, no un commit -- y para eso hace falta
--  Supabase Storage, que hoy no se usa en ningun otro lugar del proyecto.
--
--  El bucket es PUBLICO a proposito: son fotos de perfil, pensadas para
--  mostrarse en una ficha publica. Un bucket publico sirve el archivo por
--  /storage/v1/object/public/... sin pasar por RLS -- por diseno de Supabase,
--  igual que una imagen en public/ no pasa por ninguna politica. Eso es
--  exactamente lo que hace falta aca, y es una categoria de riesgo distinta a
--  la tabla `empleados`: ahi si importa RLS, porque tiene telefono y correo.
--  Una foto de perfil no.
--
--  Lo que SI protege RLS es quien puede ESCRIBIR en el bucket: solo un
--  administrador autenticado, igual que cualquier otra escritura del panel.
-- ============================================================================

begin;

-- ── El bucket ────────────────────────────────────────────────────────────
--
-- 2 MB y tres formatos: lo que ya acepta el <input type="file"> del panel.
-- Limitarlo aca tambien, y no solo en el navegador, es lo que importa: el
-- limite del navegador se salta con una peticion directa a la API.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'empleados-fotos',
  'empleados-fotos',
  true,
  2097152, -- 2 MiB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- ── Quien puede escribir ─────────────────────────────────────────────────
--
-- storage.objects ya tiene RLS activo por defecto en todo proyecto de
-- Supabase; lo que falta son las politicas. Sin with check/using acotado a
-- bucket_id, es_admin() alcanzaria para escribir en CUALQUIER bucket que se
-- cree despues -- por eso las tres politicas repiten la condicion del
-- bucket, no solo la del administrador.
drop policy if exists admin_sube_fotos_empleados on storage.objects;
create policy admin_sube_fotos_empleados on storage.objects
  for insert to authenticated
  with check (bucket_id = 'empleados-fotos' and public.es_admin());

drop policy if exists admin_actualiza_fotos_empleados on storage.objects;
create policy admin_actualiza_fotos_empleados on storage.objects
  for update to authenticated
  using (bucket_id = 'empleados-fotos' and public.es_admin())
  with check (bucket_id = 'empleados-fotos' and public.es_admin());

drop policy if exists admin_borra_fotos_empleados on storage.objects;
create policy admin_borra_fotos_empleados on storage.objects
  for delete to authenticated
  using (bucket_id = 'empleados-fotos' and public.es_admin());

-- Sin politica de SELECT a proposito: no hace falta. El bucket publico sirve
-- lecturas por su propia ruta, sin pasar por RLS. Una politica de SELECT acá
-- solo afectaria al listado autenticado de objetos, que el panel no usa: ya
-- sabe la ruta de cada foto porque la construyo el mismo al subirla.

commit;


-- ── Verificacion ────────────────────────────────────────────────────────────
-- El bucket existe, es publico y con los limites correctos.
select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'empleados-fotos';

-- Las tres politicas nuevas, ninguna mas ampia que su bucket.
select policyname, cmd from pg_policies
where schemaname = 'storage' and tablename = 'objects' and policyname like '%fotos_empleados';
