<?php
// ============================================================
//  MOTOR DE REDIRECCIÓN — home.inacons.com.pe/empresa/?c=CODIGO
//  Fase 2: se reemplaza por /r/CODIGO y esta ruta queda como 301 de
//  compatibilidad, porque /recursos/ ya generó códigos con la forma larga.
// ============================================================

require_once __DIR__ . '/config.php';

// Leer el código de la URL
$codigo = trim($_GET['c'] ?? '');

// Sin código → home del sitio. Se deriva de BASE_URL, que ya existe en el
// config del servidor: el sitio vive en home.inacons.com.pe y el dominio
// corto solo redirige la raiz, asi que mandar ahi sumaba un salto de mas.
if ($codigo === '') {
    header('Location: ' . preg_replace('#/empresa/?$#', '/', BASE_URL), true, 302);
    exit;
}

// Sanitizar: solo letras, números, guiones y guiones bajos
$codigo = preg_replace('/[^a-zA-Z0-9\-_]/', '', $codigo);

if ($codigo === '') {
    header('HTTP/1.0 400 Bad Request');
    exit('Código inválido.');
}

try {
    $pdo = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER,
        DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    $stmt = $pdo->prepare(
        'SELECT url_destino FROM qr_links WHERE codigo = :codigo AND activo = 1 LIMIT 1'
    );
    $stmt->execute([':codigo' => $codigo]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($row) {
        // Validar que el destino sea un dominio permitido (open redirect protection)
        $parsed = parse_url($row['url_destino']);
        $host   = strtolower($parsed['host'] ?? '');

        if (!in_array($host, ALLOWED_REDIRECT_HOSTS, true)) {
            header('HTTP/1.0 403 Forbidden');
            exit('URL de destino no permitida.');
        }

        // Registrar el scan
        $pdo->prepare('UPDATE qr_links SET scan_count = scan_count + 1 WHERE codigo = :c')
            ->execute([':c' => $codigo]);

            header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
            header('Location: ' . $row['url_destino'], true, 302);
        exit;

    } else {
        header('HTTP/1.0 404 Not Found');
        echo '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
        <title>Enlace no encontrado — INACONS</title>
        <style>body{font-family:sans-serif;text-align:center;padding:80px 20px;color:#333;}
        h1{color:#c0392b;}a{color:#1a3a5c;}</style></head>
        <body><h1>404 — Enlace no encontrado</h1>
        <p>El código <strong>' . htmlspecialchars($codigo, ENT_QUOTES, 'UTF-8') . '</strong> no existe o fue desactivado.</p>
        <a href="' . htmlspecialchars(preg_replace('#/empresa/?$#', '/', BASE_URL), ENT_QUOTES, 'UTF-8') . '">← Volver al inicio</a></body></html>';
        exit;
    }

} catch (PDOException $e) {
    // No exponer detalles del error en producción
    error_log('QR redirect error: ' . $e->getMessage());
    header('HTTP/1.0 500 Internal Server Error');
    echo 'Error interno. Contacta al administrador.';
    exit;
}