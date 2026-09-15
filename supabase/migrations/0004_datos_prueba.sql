-- ============================================================================
--  0004 — DATOS DE PRUEBA
--  Ejecutar al final. Existen para poder comprobar que las politicas dejan
--  pasar al administrador y frenan a todo lo demas: sin filas, una consulta
--  que devuelve vacio no distingue "no hay datos" de "RLS me esta bloqueando".
--
--  Todos los nombres son inventados. Nada de esto es informacion de personas
--  reales y se puede borrar entero con el bloque del final.
--
--  La migracion real de qr_links desde MySQL es de la Fase 2.
-- ============================================================================

-- Todo el archivo va en una sola transaccion: si algo falla a la mitad, no
-- queda nada a medio aplicar. Sin esto, el SQL Editor de Supabase ejecuta
-- sentencia por sentencia y un error deja la base en un estado intermedio que
-- hay que deshacer a mano para poder reintentar.
begin;

insert into public.configuracion (id, ruc, email_contacto, telefono)
values (1, '20XXXXXXXXX', 'ventas@inacons.com.pe', '+51 999 999 999')
on conflict (id) do nothing;


-- Un evento archivado y uno activo, para ver los dos estados en el panel.
insert into public.eventos (slug, nombre, fecha_inicio, fecha_fin, sede, estado, plantilla_visual)
values
  ('expomina-2026', 'Expomina 2026', '2026-09-09', '2026-09-11', 'Lima', 'archivado', 'feria'),
  ('demo-2027',     'Evento de prueba', '2027-03-01', '2027-03-02', 'Lima', 'borrador', 'estandar')
on conflict (slug) do nothing;

insert into public.empleados (slug, nombre, cargo, area, email, estado, orden)
values ('persona-de-prueba', 'Persona De Prueba', 'Cargo de prueba', 'Operaciones',
        'prueba@example.com', 'borrador', 1)
on conflict (slug) do nothing;


-- Los dos tipos de codigo de la seccion 5 de la especificacion, para tenerlos
-- a la vista uno al lado del otro:
--   EXPOMINA  legible, porque iba en un video y alguien podia teclearlo
--   A7F3K     opaco, porque en una credencial no debe revelar el destino
insert into public.qr_codes (codigo, tipo, destino_url, activo, en_material_impreso, perfil_generacion, notas)
values
  ('EXPOMINA', 'evento',  'https://home.inacons.com.pe/expomina/',  true,  true,  'pantalla',  'Legible: iba en el video del stand.'),
  ('A7F3K',    'empleado','https://home.inacons.com.pe/empleados/', true,  true,  'impresion', 'Opaco: ejemplo de credencial.'),
  ('BROCHURE', 'recurso', 'https://home.inacons.com.pe/assets/documentos/brochure_inacons.pdf', true, false, 'impresion', null),
  ('K9M2P',    'url',     'https://home.inacons.com.pe/',           false, false, 'pantalla',  'Desactivado a proposito: sirve para probar la pagina de codigo dado de baja.')
on conflict (codigo) do nothing;


-- Un contacto con su inscripcion, para comprobar que la relacion "una persona,
-- muchas inscripciones" funciona y que el consentimiento queda versionado.
with c as (
  insert into public.contactos (nombre, empresa, cargo, email, telefono)
  values ('Contacto De Prueba', 'Empresa De Prueba', 'Gerente', 'contacto@example.com', '+51 900 000 000')
  on conflict do nothing
  returning id
)
insert into public.inscripciones (contacto_id, evento_id, consentimiento_aceptado, version_consentimiento, origen)
select c.id, e.id, true, 'v1-2026-09', 'EXPOMINA'
from c cross join public.eventos e
where e.slug = 'expomina-2026'
on conflict do nothing;


-- Escaneos repartidos en los ultimos dias para que el agregado tenga algo que
-- agregar y el tablero no se pruebe contra una tabla vacia.
insert into public.escaneos (qr_codigo, resultado, fecha, dispositivo)
select
  'EXPOMINA',
  'ok',
  now() - (n || ' hours')::interval,
  case when n % 3 = 0 then 'desktop' else 'movil' end
from generate_series(1, 60) as n
-- Sin esta guarda, reejecutar el archivo duplica los escaneos de prueba y el
-- tablero muestra el doble de lo que deberia.
where not exists (select 1 from public.escaneos where qr_codigo = 'EXPOMINA');

insert into public.escaneos (qr_codigo, resultado, fecha)
select * from (values
  ('K9M2P',    'inactivo'::public.escaneo_resultado,    now() - interval '2 hours'),
  ('NOEXISTE', 'desconocido'::public.escaneo_resultado, now() - interval '1 hour')
) as v
where not exists (select 1 from public.escaneos where qr_codigo = 'K9M2P');

select public.agregar_escaneos_diarios(7);


commit;


-- ── Verificacion ────────────────────────────────────────────────────────────
select 'qr_codes' as tabla, count(*) from public.qr_codes
union all select 'escaneos',         count(*) from public.escaneos
union all select 'escaneos_diarios', count(*) from public.escaneos_diarios
union all select 'contactos',        count(*) from public.contactos
union all select 'inscripciones',    count(*) from public.inscripciones;


-- ── Para borrar los datos de prueba mas adelante ────────────────────────────
-- Descomentar y ejecutar cuando entren datos reales.
--
-- delete from public.escaneos         where qr_codigo in ('EXPOMINA','K9M2P','NOEXISTE');
-- delete from public.escaneos_diarios where qr_codigo in ('EXPOMINA','K9M2P','NOEXISTE');
-- delete from public.inscripciones    where version_consentimiento = 'v1-2026-09';
-- delete from public.contactos        where email = 'contacto@example.com';
-- delete from public.qr_codes         where codigo in ('EXPOMINA','A7F3K','BROCHURE','K9M2P');
-- delete from public.empleados        where slug = 'persona-de-prueba';
-- delete from public.eventos          where slug = 'demo-2027';
