<?php
/* ============================================================================
   SONDA TEMPORAL — borrar al terminar la Fase 2.

   El redirector /r/ va a resolver cada codigo contra Supabase por HTTPS. Eso
   depende de tres cosas del hosting que no se pueden comprobar desde fuera:

     1. que la extension cURL este disponible,
     2. que cPanel permita conexiones salientes (muchos alojamientos
        compartidos las bloquean, y entonces todo este diseno no sirve),
     3. cuanto tarda el viaje de ida y vuelta hasta Sao Paulo.

   El tercer punto no es curiosidad. Decide si el redirector puede consultar en
   vivo o necesita una cache local: es la diferencia entre un escaneo que
   redirige al instante y uno que se queda medio segundo en blanco. Preferimos
   medirlo antes de construir sobre una suposicion.

   No expone ninguna clave: la URL del proyecto ya viaja en el JavaScript del
   sitio, y la peticion se hace SIN credenciales a proposito -- un 401 de vuelta
   ya demuestra que la conexion llego.
   ============================================================================ */

header('Content-Type: text/plain; charset=utf-8');

$destino = 'https://mmzdxscxtvxqeapsyxdq.supabase.co/rest/v1/';

echo "SONDA DE CONECTIVIDAD\n";
echo "=====================\n\n";

echo "PHP               : " . PHP_VERSION . "\n";
echo "cURL              : " . (extension_loaded('curl') ? 'disponible' : 'NO DISPONIBLE') . "\n";
echo "OpenSSL           : " . (extension_loaded('openssl') ? 'disponible' : 'NO DISPONIBLE') . "\n";
echo "allow_url_fopen   : " . (ini_get('allow_url_fopen') ? 'si' : 'no') . "\n";
echo "pdo_pgsql         : " . (extension_loaded('pdo_pgsql') ? 'disponible' : 'no') . "\n";
echo "pdo_mysql         : " . (extension_loaded('pdo_mysql') ? 'disponible' : 'no') . "\n\n";

if (!extension_loaded('curl')) {
    echo "Sin cURL no se puede seguir. Habilitarlo en cPanel > Select PHP Version > Extensions.\n";
    exit;
}

/* Tres intentos: el primero paga DNS y el handshake TLS, los siguientes
   reutilizan lo que el sistema haya cacheado. La diferencia entre el primero y
   los otros dice cuanto de la demora es arranque y cuanto es el viaje. */
echo "Midiendo contra Supabase (3 intentos)\n";
echo "-------------------------------------\n";

$tiempos = [];

for ($i = 1; $i <= 3; $i++) {
    $ch = curl_init($destino);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_NOBODY         => true,
    ]);

    $inicio = microtime(true);
    curl_exec($ch);
    $ms = (microtime(true) - $inicio) * 1000;

    $codigo = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $dns    = curl_getinfo($ch, CURLINFO_NAMELOOKUP_TIME) * 1000;
    $conn   = curl_getinfo($ch, CURLINFO_CONNECT_TIME) * 1000;
    $tls    = curl_getinfo($ch, CURLINFO_APPCONNECT_TIME) * 1000;
    $error  = curl_error($ch);
    curl_close($ch);

    if ($error !== '') {
        echo "  intento $i: FALLO — $error\n";
        continue;
    }

    $tiempos[] = $ms;
    printf(
        "  intento %d: HTTP %d en %.0f ms   (dns %.0f · tcp %.0f · tls %.0f)\n",
        $i, $codigo, $ms, $dns, $conn, $tls
    );
}

echo "\n";

if (count($tiempos) === 0) {
    echo "VEREDICTO: sin salida a internet.\n";
    echo "El redirector no puede consultar Supabase en vivo. Hay que cambiar de\n";
    echo "enfoque: mantener MySQL local como almacen del redirector y sincronizar.\n";
    exit;
}

$peor = max($tiempos);
$mejor = min($tiempos);

printf("VEREDICTO: hay salida. Mejor %.0f ms, peor %.0f ms.\n\n", $mejor, $peor);

if ($peor < 250) {
    echo "Por debajo de 250 ms: el redirector puede consultar en vivo, sin cache.\n";
    echo "Una fuente de verdad, cero complejidad extra.\n";
} elseif ($peor < 600) {
    echo "Entre 250 y 600 ms: se nota pero se tolera. Empezar sin cache y medir\n";
    echo "con escaneos reales antes de agregarla.\n";
} else {
    echo "Por encima de 600 ms: demasiado para ponerlo delante de un escaneo.\n";
    echo "Conviene cache local de destinos y registro del escaneo despues de\n";
    echo "redirigir, no antes.\n";
}
