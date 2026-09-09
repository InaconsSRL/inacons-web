<?php
// ============================================================
//  PANEL ADMIN — Gestión de QR dinámicos
// ============================================================

require_once __DIR__ . '/config.php';

// Cookie de sesión endurecida (debe ir ANTES de session_start)
session_set_cookie_params([
  'lifetime' => 0,
  'path'     => '/empresa/',
  'secure'   => true,    // solo viaja por HTTPS
  'httponly' => true,    // inaccesible desde JavaScript
  'samesite' => 'Strict',
]);
session_start();

header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

// ── RATE LIMITING (máx. 5 intentos de login por IP en 10 min) ─
function check_rate_limit(): bool {
    $key     = 'login_attempts_' . md5($_SERVER['REMOTE_ADDR'] ?? '');
    $file    = sys_get_temp_dir() . '/' . $key . '.json';
    $now     = time();
    $window  = 600; // 10 minutos
    $max     = 5;

    $fh = fopen($file, 'c+');
    if ($fh === false) {
        return true; // no se pudo abrir el archivo de control; no bloquear el login por esto
    }
    flock($fh, LOCK_EX);

    $raw  = stream_get_contents($fh);
    $data = $raw ? (json_decode($raw, true) ?: []) : [];

    // Filtrar intentos fuera de la ventana
    $data = array_values(array_filter($data, fn($t) => ($now - $t) < $window));

    $allowed = count($data) < $max;
    if ($allowed) {
        $data[] = $now;
    }

    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($data));
    fflush($fh);
    flock($fh, LOCK_UN);
    fclose($fh);

    return $allowed;
}

// ── CSRF TOKEN ────────────────────────────────────────────────
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

function verify_csrf(): bool {
    $token = $_POST['csrf_token'] ?? '';
    return hash_equals($_SESSION['csrf_token'] ?? '', $token);
}

// ── AUTENTICACIÓN ─────────────────────────────────────────────
$login_error = '';

if (($_POST['action'] ?? '') === 'login') {
    if (!verify_csrf()) {
        $login_error = 'Token inválido. Recarga la página.';
    } elseif (!check_rate_limit()) {
        $login_error = 'Demasiados intentos. Espera 10 minutos.';
    } elseif (password_verify($_POST['password'] ?? '', ADMIN_PASS_HASH)) {
        $_SESSION['admin_ok'] = true;
        // Regenerar session ID tras login exitoso
        session_regenerate_id(true);
        header('Location: admin.php');
        exit;
    } else {
        $login_error = 'Contraseña incorrecta.';
    }
}

if (($_POST['action'] ?? '') === 'logout') {
    if (verify_csrf()) {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
        }
        session_destroy();
    }
    header('Location: admin.php');
    exit;
}

// ── PANTALLA DE LOGIN ─────────────────────────────────────────
if (empty($_SESSION['admin_ok'])) { ?>
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Admin QR — INACONS</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', sans-serif; background: #f0f4f8; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
  .card { background: white; border-radius: 12px; padding: 40px; width: 360px; box-shadow: 0 4px 20px rgba(0,0,0,.1); }
  .logo { text-align: center; margin-bottom: 28px; }
  .logo h1 { font-size: 22px; color: #1a3a5c; }
  .logo p { color: #888; font-size: 13px; margin-top: 4px; }
  label { display: block; font-size: 13px; font-weight: 600; color: #555; margin-bottom: 6px; }
  input[type=password] { width: 100%; padding: 10px 14px; border: 1.5px solid #ddd; border-radius: 8px; font-size: 15px; outline: none; }
  input[type=password]:focus { border-color: #1a3a5c; }
  button { width: 100%; padding: 12px; background: #1a3a5c; color: white; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; margin-top: 16px; }
  button:hover { background: #244f7a; }
  .error { background: #fff0f0; color: #c0392b; padding: 10px; border-radius: 6px; font-size: 13px; margin-bottom: 16px; }
</style>
</head>
<body>
<div class="card">
  <div class="logo">
    <h1>🔒 Panel QR</h1>
    <p>INACONS — Gestión de QR dinámicos</p>
  </div>
  <?php if ($login_error): ?>
    <div class="error"><?= htmlspecialchars($login_error, ENT_QUOTES, 'UTF-8') ?></div>
  <?php endif; ?>
  <form method="POST">
    <input type="hidden" name="action" value="login">
    <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($_SESSION['csrf_token'], ENT_QUOTES, 'UTF-8') ?>">
    <label>Contraseña</label>
    <input type="password" name="password" autofocus placeholder="••••••••" autocomplete="current-password">
    <button type="submit">Ingresar</button>
  </form>
</div>
</body>
</html>
<?php exit; }

// ── CONEXIÓN DB ───────────────────────────────────────────────
try {
    $pdo = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER,
        DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch (PDOException $e) {
    error_log('Admin DB error: ' . $e->getMessage());
    die('<p style="font-family:sans-serif;color:red;padding:40px;">Error de conexión. Contacta al administrador.</p>');
}

// ── ACCIONES CRUD ─────────────────────────────────────────────
$msg = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    if (!verify_csrf()) {
        $msg = '❌ Token de seguridad inválido. Recarga la página.';
    } else {
        $action = $_POST['action'] ?? '';

        if ($action === 'crear' || $action === 'editar') {
            $codigo = preg_replace('/[^a-zA-Z0-9\-_]/', '', trim($_POST['codigo'] ?? ''));
            $url    = trim($_POST['url_destino'] ?? '');
            $desc   = trim($_POST['descripcion'] ?? '');

            // Validar URL
            $parsed = parse_url($url);
            $host   = strtolower($parsed['host'] ?? '');

            if (!$codigo || !$url) {
                $msg = '❌ El código y la URL son obligatorios.';
            } elseif (!in_array($host, ALLOWED_REDIRECT_HOSTS, true)) {
                $msg = '❌ Dominio no permitido: ' . $host . '. Agrega el dominio a config.php si es legítimo.';
            } else {
                if ($action === 'crear') {
                    $stmt = $pdo->prepare('INSERT INTO qr_links (codigo, url_destino, descripcion) VALUES (:c, :u, :d)');
                    $stmt->execute([':c' => $codigo, ':u' => $url, ':d' => $desc]);
                    $msg = '✅ QR "' . $codigo . '" creado correctamente.';
                } else {
                    $id = (int)($_POST['id'] ?? 0);
                    $stmt = $pdo->prepare('UPDATE qr_links SET url_destino=:u, descripcion=:d WHERE id=:id');
                    $stmt->execute([':u' => $url, ':d' => $desc, ':id' => $id]);
                    $msg = '✅ QR actualizado correctamente.';
                }
            }
        }

        if ($action === 'toggle') {
            $id = (int)($_POST['id'] ?? 0);
            $pdo->prepare('UPDATE qr_links SET activo = 1 - activo WHERE id = :id')->execute([':id' => $id]);
        }

        if ($action === 'eliminar') {
            $id = (int)($_POST['id'] ?? 0);
            $pdo->prepare('DELETE FROM qr_links WHERE id = :id')->execute([':id' => $id]);
            $msg = '🗑️ QR eliminado.';
        }
    }
}

// ── LISTAR ────────────────────────────────────────────────────
$links = $pdo->query('SELECT * FROM qr_links ORDER BY creado_en DESC')->fetchAll(PDO::FETCH_ASSOC);
?>
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Panel QR — INACONS</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"
  integrity="sha512-CNgIRecGo7nphbeZ04Sc13ka07paqdeTu0WR1IM4kNcpmBAUSHSQX0FslNhTDadL4O5SAGapGt4FodqL8My0mA=="
  crossorigin="anonymous" referrerpolicy="no-referrer"></script>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Segoe UI', sans-serif; background: #f0f4f8; color: #333; }
header { background: #1a3a5c; color: white; padding: 14px 28px; display: flex; align-items: center; justify-content: space-between; }
header h1 { font-size: 18px; font-weight: 700; }
header form button { background: rgba(255,255,255,.15); color: white; border: none; padding: 7px 14px; border-radius: 6px; cursor: pointer; font-size: 13px; }
header form button:hover { background: rgba(255,255,255,.25); }
.container { max-width: 1100px; margin: 0 auto; padding: 28px 20px; }
.msg { padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; background: #e8f5e9; border: 1px solid #a5d6a7; font-size: 14px; }
.card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 2px 10px rgba(0,0,0,.07); margin-bottom: 28px; }
.card h2 { font-size: 16px; color: #1a3a5c; margin-bottom: 18px; padding-bottom: 10px; border-bottom: 2px solid #e8edf2; }
.form-grid { display: grid; grid-template-columns: 1fr 2fr 2fr auto; gap: 12px; align-items: end; }
label { display: block; font-size: 12px; font-weight: 600; color: #666; margin-bottom: 5px; text-transform: uppercase; letter-spacing: .4px; }
input[type=text], input[type=url] { width: 100%; padding: 9px 12px; border: 1.5px solid #ddd; border-radius: 7px; font-size: 14px; outline: none; }
input:focus { border-color: #1a3a5c; }
.prefix { font-size: 11px; color: #999; margin-top: 4px; }
.btn { padding: 10px 20px; border: none; border-radius: 7px; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap; }
.btn-primary { background: #1a3a5c; color: white; }
.btn-primary:hover { background: #244f7a; }
.btn-danger { background: #e74c3c; color: white; }
.btn-success { background: #27ae60; color: white; }
.btn-sm { padding: 6px 12px; font-size: 12px; border-radius: 5px; }
.btn-outline { background: transparent; border: 1.5px solid #1a3a5c; color: #1a3a5c; }
.btn-outline:hover { background: #1a3a5c; color: white; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th { text-align: left; padding: 10px 14px; background: #f7f9fb; border-bottom: 2px solid #e0e7ef; font-size: 12px; text-transform: uppercase; letter-spacing: .4px; color: #888; }
td { padding: 12px 14px; border-bottom: 1px solid #f0f0f0; vertical-align: middle; }
tr:hover td { background: #fafbfc; }
.codigo { font-family: monospace; font-weight: 700; color: #1a3a5c; font-size: 15px; }
.url-dest { color: #555; font-size: 13px; max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
.badge-on  { background: #e8f5e9; color: #2e7d32; }
.badge-off { background: #fce4ec; color: #c62828; }
.actions { display: flex; gap: 6px; flex-wrap: wrap; }
.fecha { font-size: 12px; color: #aaa; }
.scans { font-size: 12px; color: #1a3a5c; font-weight: 700; }
.modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.5); z-index: 100; align-items: center; justify-content: center; }
.modal-overlay.open { display: flex; }
.modal { background: white; border-radius: 14px; padding: 32px; text-align: center; min-width: 320px; box-shadow: 0 8px 40px rgba(0,0,0,.2); }
.modal h3 { font-size: 18px; color: #1a3a5c; margin-bottom: 6px; }
.modal .qr-url { font-size: 12px; color: #999; margin-bottom: 20px; word-break: break-all; }
#qrcode { display: flex; justify-content: center; margin-bottom: 20px; }
.modal-actions { display: flex; gap: 10px; justify-content: center; }
@media(max-width: 700px) {
  .form-grid { grid-template-columns: 1fr; }
  table { font-size: 13px; }
  .actions { flex-direction: column; }
}
</style>
</head>
<body>

<header>
  <h1>📱 Panel QR Dinámico — INACONS</h1>
  <form method="POST">
    <input type="hidden" name="action" value="logout">
    <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($_SESSION['csrf_token'], ENT_QUOTES, 'UTF-8') ?>">
    <button type="submit">Cerrar sesión</button>
  </form>
</header>

<div class="container">

<?php if ($msg): ?>
<div class="msg"><?= htmlspecialchars($msg, ENT_QUOTES | ENT_HTML5, 'UTF-8') ?></div>
<?php endif; ?>

<!-- FORMULARIO CREAR -->
<div class="card">
  <h2>➕ Crear nuevo QR</h2>
  <form method="POST">
    <input type="hidden" name="action" value="crear">
    <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($_SESSION['csrf_token'], ENT_QUOTES, 'UTF-8') ?>">
    <div class="form-grid">
      <div>
        <label>Código *</label>
        <input type="text" name="codigo" placeholder="brochure-2025" pattern="[a-zA-Z0-9\-_]+" required>
        <div class="prefix">/empresa/?c=<strong>codigo</strong></div>
      </div>
      <div>
        <label>URL de destino *</label>
        <input type="url" name="url_destino" placeholder="https://drive.google.com/..." required>
      </div>
      <div>
        <label>Descripción (opcional)</label>
        <input type="text" name="descripcion" placeholder="Brochure institucional">
      </div>
      <div>
        <button type="submit" class="btn btn-primary">Crear QR</button>
      </div>
    </div>
  </form>
</div>

<!-- TABLA -->
<div class="card">
  <h2>📋 QRs registrados (<?= count($links) ?>)</h2>
  <?php if (empty($links)): ?>
    <p style="color:#aaa;text-align:center;padding:30px;">Aún no hay QRs creados. ¡Crea el primero!</p>
  <?php else: ?>
  <table>
    <thead>
      <tr>
        <th>Código</th>
        <th>URL Destino</th>
        <th>Descripción</th>
        <th>Estado</th>
        <th>Scans</th>
        <th>Creado</th>
        <th>Acciones</th>
      </tr>
    </thead>
    <tbody>
    <?php foreach ($links as $row): ?>
    <tr>
      <td class="codigo">
        <a href="<?= htmlspecialchars(BASE_URL . '?c=' . $row['codigo'], ENT_QUOTES, 'UTF-8') ?>" target="_blank" style="color:#1a3a5c;text-decoration:none;">
          <?= htmlspecialchars($row['codigo'], ENT_QUOTES, 'UTF-8') ?> ↗
        </a>
      </td>
      <td><div class="url-dest" title="<?= htmlspecialchars($row['url_destino'], ENT_QUOTES, 'UTF-8') ?>"><?= htmlspecialchars($row['url_destino'], ENT_QUOTES, 'UTF-8') ?></div></td>
      <td style="font-size:13px;color:#666;"><?= htmlspecialchars($row['descripcion'], ENT_QUOTES, 'UTF-8') ?></td>
      <td><span class="badge <?= $row['activo'] ? 'badge-on' : 'badge-off' ?>"><?= $row['activo'] ? 'Activo' : 'Pausado' ?></span></td>
      <td class="scans"><?= (int)($row['scan_count'] ?? 0) ?></td>
      <td class="fecha"><?= date('d/m/Y', strtotime($row['creado_en'])) ?></td>
      <td>
        <div class="actions">
          <button class="btn btn-success btn-sm"
            onclick="mostrarQR('<?= htmlspecialchars($row['codigo'], ENT_QUOTES, 'UTF-8') ?>', '<?= htmlspecialchars(BASE_URL . '?c=' . $row['codigo'], ENT_QUOTES, 'UTF-8') ?>')">
            Ver QR
          </button>
          <button class="btn btn-outline btn-sm"
            onclick="abrirEditar(<?= (int)$row['id'] ?>, '<?= htmlspecialchars(addslashes($row['codigo']), ENT_QUOTES, 'UTF-8') ?>', '<?= htmlspecialchars(addslashes($row['url_destino']), ENT_QUOTES, 'UTF-8') ?>', '<?= htmlspecialchars(addslashes($row['descripcion']), ENT_QUOTES, 'UTF-8') ?>')">
            Editar URL
          </button>
          <form method="POST" style="display:inline;">
            <input type="hidden" name="action" value="toggle">
            <input type="hidden" name="id" value="<?= (int)$row['id'] ?>">
            <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($_SESSION['csrf_token'], ENT_QUOTES, 'UTF-8') ?>">
            <button type="submit" class="btn btn-sm" style="background:#f39c12;color:white;">
              <?= $row['activo'] ? 'Pausar' : 'Activar' ?>
            </button>
          </form>
          <form method="POST" style="display:inline;" onsubmit="return confirm('¿Eliminar este QR? Esta acción no se puede deshacer.')">
            <input type="hidden" name="action" value="eliminar">
            <input type="hidden" name="id" value="<?= (int)$row['id'] ?>">
            <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($_SESSION['csrf_token'], ENT_QUOTES, 'UTF-8') ?>">
            <button type="submit" class="btn btn-danger btn-sm">Eliminar</button>
          </form>
        </div>
      </td>
    </tr>
    <?php endforeach; ?>
    </tbody>
  </table>
  <?php endif; ?>
</div>

</div>

<!-- MODAL VER QR -->
<div class="modal-overlay" id="modalQR">
  <div class="modal">
    <h3 id="qr-titulo">QR: codigo</h3>
    <div class="qr-url" id="qr-url-texto"></div>
    <div id="qrcode"></div>
    <div style="margin-bottom:16px;text-align:left;font-size:13px;">
      <label style="display:block;margin-bottom:6px;color:#aaa;">Destino del archivo</label>
      <select id="qr-modo" onchange="refrescarQR()"
              style="width:100%;padding:9px;border-radius:6px;border:1px solid #444;background:#222;color:#eee;">
        <option value="pantalla">Pantalla / video — negro puro, ECC M</option>
        <option value="impresion">Impresión — azul corporativo, ECC H</option>
      </select>
      <p id="qr-modo-hint" style="margin:8px 0 0;color:#888;font-size:11.5px;line-height:1.5;"></p>
    </div>
    <div class="modal-actions">
      <button class="btn btn-primary" onclick="descargarQR()">⬇ Descargar PNG 1200px</button>
      <button class="btn btn-outline" onclick="cerrarModal()">Cerrar</button>
    </div>
  </div>
</div>

<!-- MODAL EDITAR -->
<div class="modal-overlay" id="modalEditar">
  <div class="modal" style="min-width:420px;text-align:left;">
    <h3 style="margin-bottom:18px;">✏️ Editar URL de destino</h3>
    <form method="POST">
      <input type="hidden" name="action" value="editar">
      <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($_SESSION['csrf_token'], ENT_QUOTES, 'UTF-8') ?>">
      <input type="hidden" name="id" id="edit_id">
      <input type="hidden" name="codigo" id="edit_codigo_hidden">
      <div style="margin-bottom:14px;">
        <label>Código</label>
        <input type="text" id="edit_codigo_display" disabled style="background:#f5f5f5;width:100%;padding:9px 12px;border:1.5px solid #ddd;border-radius:7px;font-size:14px;">
      </div>
      <div style="margin-bottom:14px;">
        <label>Nueva URL de destino *</label>
        <input type="url" name="url_destino" id="edit_url" required style="width:100%;padding:9px 12px;border:1.5px solid #ddd;border-radius:7px;font-size:14px;">
      </div>
      <div style="margin-bottom:18px;">
        <label>Descripción</label>
        <input type="text" name="descripcion" id="edit_desc" style="width:100%;padding:9px 12px;border:1.5px solid #ddd;border-radius:7px;font-size:14px;">
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button type="button" class="btn btn-outline" onclick="document.getElementById('modalEditar').classList.remove('open')">Cancelar</button>
        <button type="submit" class="btn btn-primary">Guardar cambios</button>
      </div>
    </form>
  </div>
</div>

<script>
let qrInstance = null;
let qrActual   = { codigo: '', url: '' };

/*  Dos destinos, dos configuraciones distintas:
 *
 *  Pantalla/video → negro puro (máximo contraste; el azul corporativo recorta
 *    el margen de lectura) y ECC M (H mete ~30% más módulos, y en pantalla no
 *    hay suciedad ni desgaste contra los que proteger). Menos módulos = módulos
 *    más grandes = sobreviven a la compresión del códec de video.
 *
 *  Impresión → azul corporativo y ECC H, que sí tolera manchas y desgaste.
 */
const QR_MODOS = {
  pantalla:  { color: '#000000', ecc: 'M', hint: 'Negro puro y ECC M: la máxima legibilidad tras la compresión de video. Colócalo sobre fondo blanco sólido, sin nada en movimiento detrás, y déjalo fijo al menos 8 segundos.' },
  impresion: { color: '#1a3a5c', ecc: 'H', hint: 'Azul corporativo y ECC H: tolera manchas y desgaste del papel. No lo uses para video.' }
};

function modoActual() {
  const sel = document.getElementById('qr-modo');
  return QR_MODOS[sel ? sel.value : 'pantalla'] || QR_MODOS.pantalla;
}

function mostrarQR(codigo, url) {
  qrActual = { codigo: codigo, url: url };
  document.getElementById('qr-titulo').textContent = 'QR: ' + codigo;
  document.getElementById('qr-url-texto').textContent = url;
  refrescarQR();
  document.getElementById('modalQR').classList.add('open');
}

function refrescarQR() {
  const modo = modoActual();
  document.getElementById('qr-modo-hint').textContent = modo.hint;
  const cont = document.getElementById('qrcode');
  cont.innerHTML = '';
  qrInstance = new QRCode(cont, {
    text: qrActual.url, width: 220, height: 220,
    colorDark: modo.color, colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel[modo.ecc]
  });
}

function cerrarModal() {
  document.getElementById('modalQR').classList.remove('open');
}

/*  El PNG NO se saca del preview de 220px: se rerenderiza a 1200px fuera de
 *  pantalla. Un QR de 220px escalado a pantalla de stand se ve como una mancha. */
function descargarQR() {
  const modo = modoActual();
  const off  = document.createElement('div');
  off.style.cssText = 'position:absolute;left:-9999px;top:0;';
  document.body.appendChild(off);

  new QRCode(off, {
    text: qrActual.url, width: 1200, height: 1200,
    colorDark: modo.color, colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel[modo.ecc]
  });

  setTimeout(() => {
    const canvas = off.querySelector('canvas');
    const img    = off.querySelector('img');
    const nombre = 'qr-' + qrActual.codigo + '-' +
                   (document.getElementById('qr-modo').value) + '.png';
    const link = document.createElement('a');
    link.download = nombre;

    if (canvas) {
      link.href = canvas.toDataURL('image/png');
    } else if (img && img.src) {
      link.href = img.src;   // respaldo: qrcodejs cae a <img> en navegadores viejos
    } else {
      alert('No se pudo generar el PNG. Reintenta.');
      off.remove();
      return;
    }
    link.click();
    off.remove();
  }, 250);
}

function abrirEditar(id, codigo, url, desc) {
  document.getElementById('edit_id').value = id;
  document.getElementById('edit_codigo_display').value = codigo;
  document.getElementById('edit_codigo_hidden').value = codigo;
  document.getElementById('edit_url').value = url;
  document.getElementById('edit_desc').value = desc;
  document.getElementById('modalEditar').classList.add('open');
}

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', function(e) {
    if (e.target === this) this.classList.remove('open');
  });
});
</script>

</body>
</html>