-- ============================================================================
--  0001 — ESQUEMA
--  Fase 1 de docs/ESPECIFICACION.md. Se ejecuta una sola vez, entero, en el
--  SQL Editor de Supabase. El orden de los archivos importa: 0001 crea las
--  tablas, 0002 las cierra con RLS. Nunca ejecutar 0001 sin ejecutar 0002.
-- ============================================================================

-- Todo el archivo va en una sola transaccion: si algo falla a la mitad, no
-- queda nada a medio aplicar. Sin esto, el SQL Editor de Supabase ejecuta
-- sentencia por sentencia y un error deja la base en un estado intermedio que
-- hay que deshacer a mano para poder reintentar.
begin;


-- ── Quién es administrador ──────────────────────────────────────────────────
--
-- La especificacion dice "dos niveles de acceso, sin sistema de roles". Esto no
-- es un sistema de roles: es la lista de quien puede entrar.
--
-- Hace falta porque la alternativa era que las politicas dijeran "cualquier
-- usuario autenticado". Eso deja toda la base colgando de un interruptor del
-- panel de Supabase (Authentication > Sign Ups). Si alguien lo activa por
-- error, cualquier persona del mundo se registra sola y queda autenticada, y
-- con ello lee la tabla de contactos: nombres, correos y telefonos de personas
-- reales. Bajo la Ley 29733 eso es una brecha con consecuencias.
--
-- Con esta tabla, registrarse no alcanza. Hay que estar aqui, y aqui solo se
-- entra desde el SQL Editor, que exige la contrasena de Supabase.
create table if not exists public.administradores (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  email     text not null,
  creado_en timestamptz not null default now()
);

comment on table public.administradores is
  'Allowlist de administradores. Toda politica RLS pasa por es_admin(). Solo se edita desde el SQL Editor.';

-- SECURITY DEFINER: corre con los permisos de quien la creo, no de quien la
-- llama. Es lo que permite consultar `administradores` desde una politica sin
-- darle a nadie permiso de leer esa tabla. `search_path` fijo para que nadie
-- pueda anteponer un esquema propio y suplantar la tabla.
create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.administradores where user_id = auth.uid()
  );
$$;

comment on function public.es_admin() is
  'true si la sesion actual pertenece a un administrador de la allowlist.';


-- ── Utilidades ──────────────────────────────────────────────────────────────

create or replace function public.tocar_actualizado_en()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;


-- ── Configuracion (fila unica) ──────────────────────────────────────────────
--
-- El `check (id = 1)` es lo que la hace de fila unica: no existe un segundo id
-- posible, asi que no hay forma de insertar una segunda fila ni por error ni
-- desde el panel.
create table if not exists public.configuracion (
  id                smallint primary key default 1 check (id = 1),

  nombre_empresa    text not null default 'INACONS S.R.L.',
  ruc               text,
  email_contacto    text,
  telefono          text,
  direccion         text,

  dominio_canonico  text not null default 'https://home.inacons.com.pe',

  logo_url          text,
  color_primario    text not null default '#14172d',
  color_secundario  text not null default '#1a3a5c',
  color_acento      text not null default '#d9822b',
  tipografia        text,

  -- Allowlist anti open-redirect, portada de public/empresa/config.php.
  -- Vive aqui y no en un PHP ignorado por git para que se pueda editar desde
  -- el panel sin entrar por FTP, y para que exista una sola copia.
  hosts_permitidos  text[] not null default array[
    'inacons.com.pe',
    'www.inacons.com.pe',
    'home.inacons.com.pe',
    'drive.google.com',
    'docs.google.com',
    'formularios-inacons.bitrix24.site'
  ],

  actualizado_en    timestamptz not null default now()
);

drop trigger if exists configuracion_tocar on public.configuracion;
create trigger configuracion_tocar
  before update on public.configuracion
  for each row execute function public.tocar_actualizado_en();


-- ── Tipos ───────────────────────────────────────────────────────────────────

do $$ begin
  create type public.qr_tipo as enum ('empleado', 'evento', 'url', 'recurso', 'wifi');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.qr_perfil as enum ('pantalla', 'impresion');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.escaneo_resultado as enum ('ok', 'inactivo', 'desconocido');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.estado_empleado as enum ('borrador', 'activo', 'inactivo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.estado_evento as enum ('borrador', 'activo', 'cerrado', 'archivado');
exception when duplicate_object then null; end $$;


-- ── Codigos QR ──────────────────────────────────────────────────────────────
--
-- El codigo se guarda SIEMPRE en mayusculas, por dos razones que coinciden:
--   1. /r/a7f3k y /r/A7F3K tienen que ser el mismo codigo. Guardando una sola
--      forma, la clave primaria ya garantiza que no existan los dos.
--   2. El QR se codifica en mayusculas para habilitar el modo alfanumerico,
--      que produce un simbolo mas chico que el modo byte.
create table if not exists public.qr_codes (
  codigo              text primary key
                      check (codigo = upper(codigo) and codigo ~ '^[A-Z0-9]{2,24}$'),

  tipo                public.qr_tipo not null,

  -- Para tipo empleado/evento apunta a la fila; para url/recurso/wifi el
  -- destino es literal. Al menos uno de los dos tiene que existir.
  destino_url         text,
  destino_id          uuid,

  activo              boolean not null default true,

  -- Antes de reasignar un codigo, el administrador necesita saber si eso
  -- afecta papel circulando o solo un enlace en un correo.
  en_material_impreso boolean not null default false,

  -- Con que parametros se produjo el QR. Existe para que no se repita lo del
  -- PNG de Expomina, que se genero con una herramienta externa y no dejo
  -- fuente: hoy nadie puede regenerarlo igual.
  perfil_generacion   public.qr_perfil not null default 'pantalla',
  version_modulo_qr   text,
  generado_en         timestamptz,

  notas               text,
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now(),

  constraint qr_destino_presente
    check (destino_url is not null or destino_id is not null)
);

create index if not exists qr_codes_tipo_idx   on public.qr_codes (tipo);
create index if not exists qr_codes_activo_idx on public.qr_codes (activo) where activo;

drop trigger if exists qr_codes_tocar on public.qr_codes;
create trigger qr_codes_tocar
  before update on public.qr_codes
  for each row execute function public.tocar_actualizado_en();


-- ── Auditoria de reasignaciones ─────────────────────────────────────────────
--
-- Se escribe por trigger, no desde la aplicacion. Un registro de auditoria que
-- depende de que el codigo se acuerde de escribirlo no es un registro de
-- auditoria: el dia que importe sera justo el dia que faltaba la llamada.
create table if not exists public.qr_cambios (
  id               bigint generated always as identity primary key,
  qr_codigo        text not null references public.qr_codes(codigo)
                     on update cascade on delete cascade,
  destino_anterior text,
  destino_nuevo    text,
  motivo           text,
  fecha            timestamptz not null default now()
);

create index if not exists qr_cambios_codigo_idx on public.qr_cambios (qr_codigo, fecha desc);

create or replace function public.registrar_cambio_qr()
returns trigger
language plpgsql
as $$
begin
  if new.destino_url is distinct from old.destino_url
     or new.destino_id is distinct from old.destino_id then

    insert into public.qr_cambios (qr_codigo, destino_anterior, destino_nuevo, motivo)
    values (
      new.codigo,
      coalesce(old.destino_url, old.destino_id::text),
      coalesce(new.destino_url, new.destino_id::text),
      -- El panel puede explicar el porque con
      --   select set_config('app.motivo', 'texto', true);
      -- en la misma transaccion. Si no lo hace, queda null en vez de romper.
      nullif(current_setting('app.motivo', true), '')
    );
  end if;
  return new;
end;
$$;

drop trigger if exists qr_codes_auditar on public.qr_codes;
create trigger qr_codes_auditar
  after update on public.qr_codes
  for each row execute function public.registrar_cambio_qr();


-- ── Escaneos ────────────────────────────────────────────────────────────────
--
-- `qr_codigo` NO lleva clave foranea, a proposito. Esta tabla tiene que poder
-- registrar el intento sobre un codigo que no existe -- alguien tecleo mal la
-- URL, o alguien esta probando codigos al azar -- y eso es justo lo que una
-- clave foranea impediria. `resultado` distingue los tres casos.
create table if not exists public.escaneos (
  id          bigint generated always as identity primary key,
  qr_codigo   text not null,
  resultado   public.escaneo_resultado not null default 'ok',
  fecha       timestamptz not null default now(),
  user_agent  text,
  referrer    text,
  dispositivo text,
  pais_aprox  text
);

-- Indice compuesto: el panel siempre pregunta "escaneos de ESTE codigo en
-- ESTE rango". Con el indice solo por codigo habria que ordenar en memoria.
create index if not exists escaneos_codigo_fecha_idx on public.escaneos (qr_codigo, fecha desc);


-- ── Agregado diario ─────────────────────────────────────────────────────────
--
-- El panel lee de aqui, nunca cuenta filas de `escaneos` en vivo. Es la
-- diferencia entre un tablero que responde igual con mil o con dos millones
-- de escaneos. Lo llena 0003_agregados.sql.
create table if not exists public.escaneos_diarios (
  qr_codigo text not null,
  dia       date not null,
  total     integer not null default 0,
  primary key (qr_codigo, dia)
);


-- ── Empleados ───────────────────────────────────────────────────────────────
create table if not exists public.empleados (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nombre         text not null,
  cargo          text,
  area           text,
  telefono       text,
  whatsapp       text,
  email          text,
  foto_url       text,
  redes          jsonb not null default '{}'::jsonb,
  estado         public.estado_empleado not null default 'borrador',
  orden          integer not null default 0,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists empleados_publicados_idx
  on public.empleados (orden, nombre) where estado = 'activo';

drop trigger if exists empleados_tocar on public.empleados;
create trigger empleados_tocar
  before update on public.empleados
  for each row execute function public.tocar_actualizado_en();


-- ── Eventos ─────────────────────────────────────────────────────────────────
create table if not exists public.eventos (
  id                   uuid primary key default gen_random_uuid(),
  slug                 text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nombre               text not null,
  fecha_inicio         date,
  fecha_fin            date,
  sede                 text,
  portada_url          text,
  contenido            text,
  plantilla_visual     text not null default 'estandar',
  estado               public.estado_evento not null default 'borrador',

  -- Un evento que termina deja de aceptar respuestas solo. Esto es lo que
  -- resuelve de raiz lo que paso con Expomina, donde el formulario siguio
  -- visible despues de cerrar el backend y habria descartado registros en
  -- silencio.
  cierre_inscripciones timestamptz,

  campos_opcionales    jsonb not null default '[]'::jsonb,

  creado_en            timestamptz not null default now(),
  actualizado_en       timestamptz not null default now(),

  constraint eventos_fechas_coherentes
    check (fecha_fin is null or fecha_inicio is null or fecha_fin >= fecha_inicio)
);

drop trigger if exists eventos_tocar on public.eventos;
create trigger eventos_tocar
  before update on public.eventos
  for each row execute function public.tocar_actualizado_en();


-- ── Contactos ───────────────────────────────────────────────────────────────
--
-- Un contacto es una PERSONA, no una inscripcion. La misma persona que se
-- registro en tres ferias es una fila con tres inscripciones. Esa es la
-- propiedad que convierte esto en la base de contactos de la empresa, y el
-- indice unico sobre lower(email) es lo que la sostiene.
create table if not exists public.contactos (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,
  empresa        text,
  cargo          text,
  email          text,
  telefono       text,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create unique index if not exists contactos_email_unico
  on public.contactos (lower(email)) where email is not null;

drop trigger if exists contactos_tocar on public.contactos;
create trigger contactos_tocar
  before update on public.contactos
  for each row execute function public.tocar_actualizado_en();


-- ── Inscripciones ───────────────────────────────────────────────────────────
create table if not exists public.inscripciones (
  id                      uuid primary key default gen_random_uuid(),
  contacto_id             uuid not null references public.contactos(id) on delete cascade,

  -- restrict, no cascade: borrar un evento no puede llevarse por delante las
  -- inscripciones. Los eventos se archivan, no se borran.
  evento_id               uuid not null references public.eventos(id) on delete restrict,

  fecha                   timestamptz not null default now(),

  -- Guardar la version es lo unico que permite demostrar despues a que texto
  -- exacto dijo que si una persona. El check impide que exista una fila sin
  -- consentimiento: si no acepto, no hay inscripcion.
  consentimiento_aceptado boolean not null check (consentimiento_aceptado),
  version_consentimiento  text not null,

  -- Codigo QR de origen, o 'directo'. Ojo con el default: el de Expomina caia
  -- a 'video', asi que quien tecleaba la URL a mano quedaba contado como
  -- escaneo del QR del video. Inflaba la metrica justo donde importaba.
  origen                  text not null default 'directo',

  extras                  jsonb not null default '{}'::jsonb,

  unique (contacto_id, evento_id)
);

create index if not exists inscripciones_evento_idx on public.inscripciones (evento_id, fecha desc);


-- ── Leads desde tarjetas de empleado ────────────────────────────────────────
create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  empleado_id uuid references public.empleados(id) on delete set null,
  contacto_id uuid not null references public.contactos(id) on delete cascade,
  mensaje     text,
  origen      text not null default 'directo',
  fecha       timestamptz not null default now()
);

create index if not exists leads_empleado_idx on public.leads (empleado_id, fecha desc);


-- ── Generador de codigos opacos ─────────────────────────────────────────────
--
-- Alfabeto sin ambiguedades visuales: no estan 0/O ni 1/I/L. Alguien que lee
-- un codigo de una credencial y lo teclea no tiene que adivinar.
--
-- Aleatorio, nunca correlativo: con codigos secuenciales cualquiera recorre el
-- catalogo completo de destinos probando A0001, A0002, A0003.
create or replace function public.generar_codigo_opaco(p_largo integer default 5)
returns text
language plpgsql
as $$
declare
  alfabeto constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  candidato text;
  intentos  integer := 0;
begin
  loop
    candidato := '';
    for i in 1..p_largo loop
      candidato := candidato || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    end loop;

    exit when not exists (select 1 from public.qr_codes where codigo = candidato);

    intentos := intentos + 1;
    if intentos > 50 then
      raise exception 'No se encontro un codigo libre de % caracteres tras 50 intentos', p_largo;
    end if;
  end loop;

  return candidato;
end;
$$;


-- ── Resolver un codigo (lo usara el redirector /r/ en la Fase 2) ────────────
--
-- Por que una funcion y no un SELECT directo: si el rol anonimo pudiera leer
-- `qr_codes`, podria leerla ENTERA. La clave anonima viaja en el HTML de
-- cualquier pagina publica, asi que eso equivale a publicar el catalogo de
-- todos los destinos. La funcion solo responde por un codigo que ya conoces,
-- que es exactamente lo que hace un escaner de QR.
--
-- Resuelve y registra el escaneo en la misma transaccion: o pasan las dos
-- cosas o no pasa ninguna. No puede quedar una redireccion sin contar.
--
-- NO se le da permiso al rol anonimo todavia. El permiso se otorga en la
-- Fase 2, cuando exista el redirector que la llama. Una puerta abierta que
-- nadie usa es solo una puerta abierta.
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
begin
  select * into v_fila from public.qr_codes where codigo = v_codigo;

  if not found then
    v_resultado := 'desconocido';
  elsif not v_fila.activo then
    v_resultado := 'inactivo';
  else
    v_resultado := 'ok';
  end if;

  insert into public.escaneos (qr_codigo, resultado, user_agent, referrer, dispositivo, pais_aprox)
  values (v_codigo, v_resultado, p_user_agent, p_referrer, p_dispositivo, p_pais);

  return query select
    case when v_resultado = 'ok' then v_fila.destino_url else null end,
    v_fila.codigo is not null,
    coalesce(v_fila.activo, false);
end;
$$;

-- Las funciones nacen con EXECUTE concedido al pseudo-rol PUBLIC, y anon lo
-- hereda de ahi. Revocarselo a anon directamente no quita ese grant heredado:
-- hay que quitarselo a PUBLIC. Es el tipo de permiso que parece cerrado en la
-- lectura del codigo y esta abierto en la base.
revoke all on function public.resolver_qr(text, text, text, text, text)
  from public, anon, authenticated;

commit;
