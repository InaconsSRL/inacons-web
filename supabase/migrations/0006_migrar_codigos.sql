-- ============================================================================
--  0006 — LOS CODIGOS DE MYSQL PASAN A POSTGRES
--  Fase 2. Ejecutar despues de 0005.
--
--  Cuatro codigos en produccion, con 43 escaneos acumulados entre todos. Se
--  conservan con su nombre EXACTO: es lo unico que hace que el material ya
--  impreso siga sirviendo. Un codigo "mejorado" durante una migracion es papel
--  muerto que nadie puede arreglar.
-- ============================================================================

begin;

-- ── 1. El codigo admite guion bajo y guion medio ────────────────────────────
--
-- La restriccion original solo admitia A-Z y digitos, y los cuatro codigos que
-- ya existen llevan guion bajo: `canal_etico`, `expomina_form`,
-- `pagina_inacons`, `tickets_ti`. Ninguno habria entrado.
--
-- El guion bajo no esta en el alfabeto del modo alfanumerico del estandar QR
-- (0-9 A-Z espacio $ % * + - . / :), asi que obliga al codificador a abrir un
-- segmento en modo byte. Medido sobre estos cuatro: el simbolo queda en 33x33
-- con guion bajo y en 33x33 sin el. No cruza el limite de version, asi que en
-- estas longitudes el costo es CERO y no hay razon para tocarlos.
--
-- Para codigos nuevos sigue siendo preferible evitarlo: en una URL mas larga
-- si puede empujar a la version siguiente. El generador de codigos opacos solo
-- produce A-Z y digitos, asi que esto afecta unicamente a los legibles que
-- alguien escriba a mano.
alter table public.qr_codes drop constraint if exists qr_codes_codigo_check;
alter table public.qr_codes add constraint qr_codes_codigo_check
  check (codigo = upper(codigo) and codigo ~ '^[A-Z0-9_-]{2,24}$');


-- ── 2. El historial de escaneos que no tiene fecha ──────────────────────────
--
-- MySQL guardaba un contador, no un registro por escaneo: hay un total y no
-- hay forma de saber cuando ocurrio cada uno. Inventar fechas para repartirlos
-- en `escaneos_diarios` seria fabricar datos que despues alguien leeria como
-- ciertos. Se guarda el total aparte, declarado como lo que es.
alter table public.qr_codes add column if not exists escaneos_previos integer not null default 0;

comment on column public.qr_codes.escaneos_previos is
  'Total heredado de MySQL antes de la migracion. Sin desglose por fecha: el sistema anterior solo contaba. El panel debe sumarlo aparte, nunca mezclarlo con escaneos_diarios.';


-- ── 3. Un host que faltaba en la lista permitida ────────────────────────────
--
-- `tickets_ti` apunta a materen-ti.vercel.app, que NO estaba en la lista con
-- la que se creo `configuracion`. Esa lista se copio de la plantilla de
-- public/empresa/config.php del repositorio, y el config REAL del servidor
-- -- que esta en .gitignore y por lo tanto nunca se vio -- tenia una entrada
-- mas.
--
-- Se detecto probando el codigo en produccion antes de migrar: redirige
-- correctamente hoy. Sin esta linea, migrarlo lo habria dejado devolviendo la
-- pagina de enlace caido, con el codigo activo y el destino bien escrito. Un
-- fallo sin ningun sintoma que apunte a la causa.
update public.configuracion
set hosts_permitidos = array(
  select distinct unnest(hosts_permitidos || array['materen-ti.vercel.app'])
)
where id = 1;


-- ── 4. Los cuatro codigos ───────────────────────────────────────────────────
--
-- En mayusculas porque asi se almacenan todos; la resolucion es insensible a
-- mayusculas, de modo que /r/canal_etico -- que es lo que esta impreso --
-- sigue encontrando CANAL_ETICO.
--
-- `en_material_impreso` queda en false porque NO SABEMOS cuales estan en papel.
-- Es un dato que hay que revisar en el panel: marca la diferencia entre
-- reasignar un destino tranquilo y hacerlo sabiendo que hay material
-- circulando que no se puede actualizar.
insert into public.qr_codes
  (codigo, tipo, destino_url, activo, en_material_impreso, escaneos_previos, notas)
values
  ('CANAL_ETICO',    'url',     'https://home.inacons.com.pe/canal-etico/',  true, false,  7, 'Migrado de MySQL (Fase 2). Revisar si esta en material impreso.'),
  ('EXPOMINA_FORM',  'evento',  'https://home.inacons.com.pe/expomina/',     true, false,  1, 'Migrado de MySQL (Fase 2). Apunta al aviso de cierre de la feria.'),
  ('PAGINA_INACONS', 'url',     'https://home.inacons.com.pe/',             true, false, 30, 'Migrado de MySQL (Fase 2). El mas escaneado. Revisar si esta en material impreso.'),
  ('TICKETS_TI',     'url',     'https://materen-ti.vercel.app/soporte',    true, false,  5, 'Migrado de MySQL (Fase 2). Destino externo: requiere materen-ti.vercel.app en hosts_permitidos.')
on conflict (codigo) do update set
  destino_url      = excluded.destino_url,
  activo           = excluded.activo,
  escaneos_previos = excluded.escaneos_previos,
  notas            = excluded.notas;


-- ── 5. Fuera los codigos de prueba de 0004 ──────────────────────────────────
--
-- Ya hay datos reales: los inventados dejan de ser utiles y pasan a ser ruido
-- que alguien puede confundir con un codigo vivo. Se borran sus escaneos
-- primero -- `escaneos` no tiene clave foranea, asi que no se van solos.
delete from public.escaneos         where qr_codigo in ('EXPOMINA', 'A7F3K', 'BROCHURE', 'K9M2P', 'NOEXISTE', 'ZZBLOQ', 'ZZPRUEBA', 'NADA');
delete from public.escaneos_diarios where qr_codigo in ('EXPOMINA', 'A7F3K', 'BROCHURE', 'K9M2P', 'NOEXISTE', 'ZZBLOQ', 'ZZPRUEBA', 'NADA');
delete from public.qr_cambios       where qr_codigo in ('EXPOMINA', 'A7F3K', 'BROCHURE', 'K9M2P', 'ZZBLOQ');
delete from public.qr_codes         where codigo    in ('EXPOMINA', 'A7F3K', 'BROCHURE', 'K9M2P', 'ZZBLOQ');

commit;


-- ── Verificacion ────────────────────────────────────────────────────────────

-- Los cuatro codigos, y nada mas.
select codigo, tipo, destino_url, activo, escaneos_previos
from public.qr_codes order by codigo;

-- El host nuevo tiene que aparecer en la lista.
select unnest(hosts_permitidos) as host_permitido from public.configuracion where id = 1 order by 1;

-- Los cuatro resuelven. Ninguna fila puede traer `destino` vacio: si alguna lo
-- trae, su host no esta permitido y ese QR quedaria roto al enchufar /r/.
select codigo, (public.resolver_qr(codigo)).*
from public.qr_codes order by codigo;
