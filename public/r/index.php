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

if ($codigo === '') {
    paginaSobria('Falta el codigo', 'Esta direccion necesita un codigo. Revisa el enlace o escanea de nuevo.');
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
        'No pudimos resolver el enlace',
        'Hubo un problema momentaneo de nuestro lado. Vuelve a escanear en unos segundos.'
    );
}

$fila = $respuesta[0] ?? null;
$destino = $fila['destino'] ?? null;

if ($destino) {
    /* El codigo de origen viaja al destino. Es lo que despues permite cruzar
       escaneos con inscripciones y saber que QR del stand funciono. En
       Expomina existia a medias y habia que acordarse de ponerlo a mano en
       cada enlace. */
    $destino .= (strpos($destino, '?') === false ? '?' : '&') . 'o=' . rawurlencode($codigo);

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
    $existe ? 'Este enlace ya no esta disponible' : 'Enlace no encontrado',
    $existe
        ? 'El codigo fue dado de baja. Si llegaste desde material impreso, es probable que haya una version mas reciente.'
        : 'El codigo no existe. Revisa que lo hayas escrito bien, o escanea de nuevo.'
);


/* ── Funciones ──────────────────────────────────────────────────────────── */

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

/** Clasificacion gruesa, suficiente para un tablero. No es analitica. */
function dispositivo(): string
{
    $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
    if ($ua === '') return 'desconocido';
    if (preg_match('/iPad|Tablet/i', $ua)) return 'tablet';
    if (preg_match('/Mobile|Android|iPhone/i', $ua)) return 'movil';
    return 'escritorio';
}

/** Pais aproximado, si el hosting o un proxy lo aportan. Nunca se adivina. */
function pais(): ?string
{
    foreach (['HTTP_CF_IPCOUNTRY', 'GEOIP_COUNTRY_CODE', 'HTTP_X_COUNTRY_CODE'] as $cabecera) {
        if (!empty($_SERVER[$cabecera])) {
            return substr($_SERVER[$cabecera], 0, 2);
        }
    }
    return null;
}

/**
 * Pagina de error. Sobria: logo, una frase que explica y un camino de salida.
 *
 * Nunca un 404 crudo de Apache ni un error de servidor. Quien llega aca acaba
 * de escanear un QR impreso en algo que le dieron en la mano: una pagina de
 * error del servidor le dice que el problema es suyo, cuando no lo es.
 *
 * Los estilos van embebidos, duplicando valores del sistema de diseno a
 * proposito. Es la unica pagina del sitio que tiene que verse bien aunque nada
 * mas cargue: si dependiera de una hoja externa, un fallo de red le sumaria un
 * segundo problema al que ya tiene.
 */
function paginaSobria(string $titulo, string $mensaje): void
{
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    $t = htmlspecialchars($titulo, ENT_QUOTES, 'UTF-8');
    $m = htmlspecialchars($mensaje, ENT_QUOTES, 'UTF-8');
    $sitio = SITIO;

    echo <<<HTML
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>$t — INACONS</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       padding:24px;background:#14172d;
       font-family:'Montserrat',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
  .c{width:100%;max-width:400px;text-align:center}
  .c img{height:38px;width:auto;margin-bottom:40px}
  h1{font-size:22px;line-height:1.3;color:rgba(255,255,255,.92);margin:0 0 12px;font-weight:700}
  p{font-size:15px;line-height:1.6;color:rgba(255,255,255,.72);margin:0 0 32px}
  a{display:inline-block;padding:14px 32px;min-height:44px;background:#1b5278;color:#fff;
    text-decoration:none;border-radius:2px;font-size:13px;font-weight:600;
    letter-spacing:.14em;text-transform:uppercase}
</style>
</head>
<body>
  <div class="c">
    <img src="$sitio/assets/imagenes/logos/logo_inacons_white.svg" alt="INACONS" width="140" height="38">
    <h1>$t</h1>
    <p>$m</p>
    <a href="$sitio/">Ir al sitio</a>
  </div>
</body>
</html>
HTML;
    exit;
}
