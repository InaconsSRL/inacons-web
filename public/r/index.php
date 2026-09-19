<?php
/* ============================================================================
   REDIRECTOR DE QR — home.inacons.com.pe/r/CODIGO

   Resuelve, registra y redirige. Nada mas: no tiene logica de negocio, no
   decide nada y no sabe que es un evento o un empleado.

   Por que sigue habiendo PHP en un sitio estatico. Es la unica forma de dar un
   302 real del servidor con dominio propio sin meter Cloudflare delante. Un
   sitio estatico no puede redirigir: solo puede servir una pagina que despues
   redirige con JavaScript, y eso mete una pantalla en blanco justo despues del
   escaneo, que es el peor momento posible para dudar.

   Medido en este mismo servidor: la consulta a Supabase tarda 69-87 ms. Por
   eso consulta en vivo y no cachea. Una sola fuente de verdad, y ninguna
   ventana en la que un destino recien cambiado siga mandando al sitio viejo.
   Si algun dia eso empeora, la sonda de diagnostico esta en el historial de
   git y la decision se vuelve a tomar con numeros.
   ============================================================================ */

/* ── Configuracion ──────────────────────────────────────────────────────────
   La clave va escrita aca, en claro, y esta bien que asi sea: es la clave
   PUBLICABLE, la misma que ya viaja dentro del JavaScript que descarga
   cualquier visitante del sitio. No hay nada que ocultar que no este ya
   publicado.

   Lo que la vuelve inofensiva es que el servidor no consulta tablas: llama a
   resolver_qr(), que es SECURITY DEFINER y solo responde por un codigo que ya
   conoces. No hay forma de pedirle la lista. Con un SELECT sobre qr_codes
   bastaria una peticion para llevarse el catalogo entero de destinos.

   La clave `sb_secret_` NO va aca ni en ningun archivo de este repositorio.

   OJO: si cambia el proyecto de Supabase, hay que actualizar estos dos valores
   tambien en .env y en los secrets de GitHub. Son los tres sitios. */
const SUPABASE_URL  = 'https://mmzdxscxtvxqeapsyxdq.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_cXVhe7nsBVboiIviykBiSw_tBtnw0VY';
const SITIO         = 'https://home.inacons.com.pe';

/* Generosos: lo medido son 87 ms. Existen para que un Supabase caido devuelva
   una pagina en dos segundos en vez de dejar el telefono girando. */
const TIMEOUT_CONEXION = 3;
const TIMEOUT_TOTAL    = 5;


/* ── Entrada ────────────────────────────────────────────────────────────── */

$codigo = $_GET['c'] ?? '';
$codigo = preg_replace('/[^A-Za-z0-9_-]/', '', $codigo);
$codigo = substr($codigo, 0, 24);

/* ── Limite de tasa ─────────────────────────────────────────────────────────
   Antes de gastar la llamada a Supabase, no despues: resolver_qr() inserta un
   escaneo en CADA llamada, exista el codigo o no (0007), y nada mas lo
   frenaba. Un bucle de peticiones podia llenar `escaneos` hasta poner el
   proyecto en solo lectura -- y ahi resolver_qr() empieza a fallar para
   TODOS, no solo para quien abuso. La purga de 0011 bajo el dano; esto ataca
   la causa: la peticion ni siquiera llega a Supabase. */
if (limiteExcedido(ipVisitante())) {
    http_response_code(429);
    header('Retry-After: 60');
    paginaSobria('Demasiadas solicitudes', 'Espera un momento',
        'Se hicieron muchas peticiones desde tu conexion en poco tiempo. Vuelve a intentarlo en un minuto.', '429');
}

if ($codigo === '') {
    http_response_code(404);
    paginaSobria('Enlace incompleto', 'Falta el codigo',
        'Esta direccion necesita un codigo. Revisa el enlace o escanea de nuevo.', '404');
}


/* ── Resolucion ─────────────────────────────────────────────────────────── */

$respuesta = llamarRpc('resolver_qr', [
    'p_codigo'      => $codigo,
    'p_user_agent'  => substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 400),
    'p_referrer'    => substr($_SERVER['HTTP_REFERER'] ?? '', 0, 400),
    'p_dispositivo' => dispositivo(),
    'p_pais'        => pais(),
]);

if ($respuesta === null) {
    /* No se pudo hablar con la base. No es culpa de quien escaneo, asi que no
       se le dice "codigo invalido": se le dice que reintente. El escaneo se
       pierde sin registrar, y es el precio de no tener cola local -- que
       tendria su propio conjunto de problemas para un caso que deberia ser
       excepcional. */
    http_response_code(503);
    paginaSobria(
        'Servicio no disponible',
        'No pudimos resolver el enlace',
        'Hubo un problema momentaneo de nuestro lado. Vuelve a escanear en unos segundos.',
        '503'
    );
}

$fila = $respuesta[0] ?? null;
$destino = $fila['destino'] ?? null;

if ($destino) {
    /* El codigo de origen viaja al destino, pero SOLO si el destino es nuestro.
     *
     * Para que sirve: si en una feria hay tres QR -- stand, pendon, folleto --
     * los tres llevando al mismo formulario, `?o=` es lo unico que despues
     * dice cual de los tres trajo las inscripciones. El escaneo ya queda
     * registrado en `escaneos`, pero eso solo cuenta que alguien escaneo; no
     * lo conecta con lo que esa persona hizo en la pagina siguiente.
     *
     * Por que solo en lo propio: un sitio de terceros no sabe que es `o=`, no
     * lo va a leer y no lo necesita. Anadirlo no aporta nada y modifica la URL
     * de otro, que es algo que no hay que hacer sin motivo. El motivo existe
     * para nuestras paginas; para las de afuera, no.
     */
    if (esDominioPropio($destino)) {
        $destino .= (strpos($destino, '?') === false ? '?' : '&') . 'o=' . rawurlencode($codigo);
    }

    /* Sin cache: el destino de un codigo puede cambiar, y un 302 cacheado por
       el navegador seguiria mandando al anterior sin volver a preguntar. */
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Location: ' . $destino, true, 302);
    exit;
}

/* Existe pero no lleva a ningun lado: dado de baja, o con un destino fuera de
   los dominios permitidos. Al visitante le da igual cual de las dos: lo unico
   util que podemos decirle es que el enlace ya no sirve y donde ir. La
   distincion queda registrada en `escaneos.resultado`, que es donde le sirve a
   quien administra. */
$existe = !empty($fila['encontrado']);

http_response_code(404);
paginaSobria(
    $existe ? 'Enlace dado de baja' : 'Enlace no encontrado',
    $existe ? 'Este enlace ya no esta disponible' : 'No encontramos ese codigo',
    $existe
        ? 'El codigo fue dado de baja. Si llegaste desde material impreso, es probable que haya una version mas reciente.'
        : 'El codigo no existe. Revisa que lo hayas escrito bien, o escanea de nuevo.',
    '404'
);


/* ── Funciones ──────────────────────────────────────────────────────────── */

/**
 * IP real del visitante.
 *
 * Solo REMOTE_ADDR: no hay Cloudflare ni proxy delante de este servidor (ver
 * la cabecera del archivo), asi que una cabecera tipo X-Forwarded-For la pone
 * el propio visitante y no hay nadie confiable adelante que la reescriba.
 * Confiar en ella seria dejar que cualquiera elija bajo que IP lo limitan.
 */
function ipVisitante(): string
{
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

/**
 * Limite de tasa por IP: MAX_PETICIONES cada LIMITE_VENTANA segundos.
 *
 * Un archivo por IP en el directorio temporal del sistema, no APCu ni Redis:
 * este es un cPanel compartido y no hay forma de confirmar desde aqui que
 * APCu este habilitado. sys_get_temp_dir() esta garantizado donde corre PHP,
 * sin depender de una extension que puede faltar.
 *
 * flock() evita que dos peticiones simultaneas de la misma IP lean el mismo
 * contador viejo y las dos escriban "1" en vez de "1" y "2".
 *
 * Si el directorio temporal no fuera escribible, se deja pasar la peticion:
 * negarle el paso a todo el mundo por no poder contar seria un dano mayor que
 * el que este limite trata de evitar.
 */
const LIMITE_PETICIONES = 30;
const LIMITE_VENTANA    = 60; // segundos

function limiteExcedido(string $ip): bool
{
    $ruta = sys_get_temp_dir() . '/inacons_qr_rl_' . hash('sha256', $ip) . '.json';

    $fp = @fopen($ruta, 'c+');
    if ($fp === false) {
        return false;
    }

    flock($fp, LOCK_EX);

    $contenido = stream_get_contents($fp);
    $datos = $contenido !== false && $contenido !== '' ? json_decode($contenido, true) : null;

    $ahora = time();
    if (!is_array($datos) || !isset($datos['inicio'], $datos['total']) || ($ahora - $datos['inicio']) >= LIMITE_VENTANA) {
        $datos = ['inicio' => $ahora, 'total' => 0];
    }

    $datos['total']++;
    $excedido = $datos['total'] > LIMITE_PETICIONES;

    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($datos));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);

    return $excedido;
}

/**
 * Llama a una funcion de Postgres por la API REST.
 * Devuelve el array decodificado, o null si la llamada no se pudo completar.
 */
function llamarRpc(string $funcion, array $parametros)
{
    $ch = curl_init(SUPABASE_URL . '/rest/v1/rpc/' . $funcion);

    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => TIMEOUT_CONEXION,
        CURLOPT_TIMEOUT        => TIMEOUT_TOTAL,
        CURLOPT_POSTFIELDS     => json_encode($parametros),
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'apikey: ' . SUPABASE_KEY,
            'Authorization: Bearer ' . SUPABASE_KEY,
        ],
    ]);

    $cuerpo = curl_exec($ch);
    $estado = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error  = curl_error($ch);
    curl_close($ch);

    if ($error !== '' || $estado !== 200) {
        error_log("QR redirect: fallo RPC $funcion — estado $estado — $error");
        return null;
    }

    $datos = json_decode($cuerpo, true);
    return is_array($datos) ? $datos : null;
}

/** Si la URL apunta a un host de INACONS. */
function esDominioPropio(string $url): bool
{
    $host = strtolower(parse_url($url, PHP_URL_HOST) ?? '');
    if ($host === '') return false;

    $propio = strtolower(parse_url(SITIO, PHP_URL_HOST) ?? '');

    return $host === $propio
        || $host === 'inacons.com.pe'
        || substr($host, -strlen('.inacons.com.pe')) === '.inacons.com.pe';
}

/** Clasificacion gruesa, suficiente para un tablero. No es analitica. */
function dispositivo(): string
{
    $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
    if ($ua === '') return 'desconocido';
    if (preg_match('/iPad|Tablet/i', $ua)) return 'tablet';
    if (preg_match('/Mobile|Android|iPhone/i', $ua)) return 'movil';
    return 'escritorio';
}

/**
 * Pais aproximado, solo si el propio servidor lo aporta. Nunca se adivina.
 *
 * Antes tambien leia HTTP_CF_IPCOUNTRY y HTTP_X_COUNTRY_CODE. Los dos son
 * cabeceras HTTP, y este sitio no tiene Cloudflare delante (ver la cabecera
 * del archivo): cualquiera que escanee el QR puede mandar
 * `X-Country-Code: FR` en la peticion y esa mentira quedaba escrita en
 * `escaneos.pais_aprox` como si fuera un dato. GEOIP_COUNTRY_CODE es distinto:
 * lo pone el modulo de geolocalizacion del propio Apache, no algo que viaje
 * en la peticion, asi que el visitante no lo puede falsificar.
 */
function pais(): ?string
{
    $valor = $_SERVER['GEOIP_COUNTRY_CODE'] ?? '';
    return preg_match('/^[A-Z]{2}$/', $valor) ? $valor : null;
}

/**
 * Pagina de error.
 *
 * Es el MISMO diseno que src/pages/404.astro: fondo claro, el numero enorme
 * detras, el logo arriba y el rotulo en azul. Habia dos paginas de "no
 * encontrado" con dos esteticas distintas, y al visitante le da igual cual de
 * los dos sistemas fallo -- ve el mismo sitio, o deberia.
 *
 * Los estilos van embebidos, duplicando valores del sistema de diseno a
 * proposito. Es la unica pagina que tiene que verse bien aunque nada mas
 * cargue: quien llega aca acaba de escanear un QR impreso en algo que le
 * dieron en la mano, y si dependiera de una hoja externa un fallo de red le
 * sumaria un segundo problema al que ya tiene.
 *
 * La tipografia si se pide a Google, sin bloquear, y con la pila del sistema
 * detras: si no llega, la pagina se ve igual de bien con otra letra.
 */
function paginaSobria(string $rotulo, string $titulo, string $mensaje, string $numero = '404'): void
{
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');

    $r = htmlspecialchars($rotulo,  ENT_QUOTES, 'UTF-8');
    $t = htmlspecialchars($titulo,  ENT_QUOTES, 'UTF-8');
    $m = htmlspecialchars($mensaje, ENT_QUOTES, 'UTF-8');
    $n = htmlspecialchars($numero,  ENT_QUOTES, 'UTF-8');
    $sitio = SITIO;

    echo <<<HTML
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>$t — INACONS</title>
<link rel="icon" type="image/svg+xml" href="$sitio/favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" media="print" onload="this.media='all'"
      href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;800&display=swap&subset=latin">
<style>
  *,*::before,*::after { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    padding: clamp(24px, 5vw, 48px) 20px;
    background: #f0f3f7;
    font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  /* El numero enorme detras, igual que en el 404 del sitio. */
  body::before {
    content: '$n';
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    font-size: clamp(12rem, 30vw, 22rem);
    font-weight: 800;
    color: rgba(20, 23, 45, 0.045);
    line-height: 1;
    letter-spacing: -0.02em;
    pointer-events: none;
    user-select: none;
  }
  .logo { margin-bottom: clamp(24px, 4vw, 40px); z-index: 1; }
  .logo img { height: 32px; width: auto; display: block; opacity: .85; }
  .contenido { text-align: center; position: relative; z-index: 1; max-width: 560px; width: 100%; }
  .rotulo {
    display: block;
    font-size: .6875rem;
    font-weight: 600;
    letter-spacing: .14em;
    text-transform: uppercase;
    color: #1b5278;
    margin-bottom: 1.25rem;
  }
  h1 {
    font-size: clamp(1.8rem, 4vw, 3rem);
    font-weight: 800;
    color: #14172d;
    line-height: 1.15;
    letter-spacing: -0.03em;
    margin: 0 0 1.25rem;
  }
  p { font-size: 1rem; color: #5a6280; line-height: 1.75; margin: 0 0 2.5rem; }
  a.btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 12px 24px;
    background: #1b5278;
    border: 1.5px solid #1b5278;
    border-radius: 2px;
    color: #fff;
    text-decoration: none;
    font-size: .8125rem;
    font-weight: 600;
    letter-spacing: .06em;
    text-transform: uppercase;
    transition: background .24s ease, border-color .24s ease;
  }
  a.btn:hover { background: #14172d; border-color: #14172d; }
</style>
</head>
<body>
  <a href="$sitio/" class="logo"><img src="$sitio/assets/imagenes/logos/logo_inacons.svg" alt="INACONS" width="120" height="32"></a>
  <div class="contenido">
    <span class="rotulo">$r</span>
    <h1>$t</h1>
    <p>$m</p>
    <a href="$sitio/" class="btn">Ir al inicio</a>
  </div>
</body>
</html>
HTML;
    exit;
}
