// ============================================================
//  BACKEND — Registro de visitantes EXPOMINA 2026
//  Frontend: web-astro/src/pages/formulario/expomina.astro
//
//  Hoja destino:
//  docs.google.com/spreadsheets/d/1fwU-fOSgvrFG1CkoUuKSKdOWZUuZjUDu3JXlynCzoFk
//
//  DESPLIEGUE (hacer una sola vez):
//   1. Abrir esa hoja → Extensiones → Apps Script.
//   2. Borrar el "function myFunction() {}" que viene por defecto.
//   3. Pegar ESTE archivo completo y guardar (Ctrl+S).
//   4. Implementar → Nueva implementación → tipo: Aplicación web
//        Ejecutar como:        Yo
//        Quién tiene acceso:   Cualquier usuario
//   5. Autorizar (aparece "Google no verificó la app" →
//      Configuración avanzada → Ir a Registro Expomina).
//   6. Copiar la URL que termina en /exec y pegarla en SCRIPT_URL
//      dentro de src/pages/formulario/expomina.astro.
// ============================================================

var SHEET_ID   = '1fwU-fOSgvrFG1CkoUuKSKdOWZUuZjUDu3JXlynCzoFk';
var SHEET_NAME = 'Leads';

var HEADERS = [
  'Fecha',
  'Hora',
  'Nombre',
  'Empresa',
  'Cargo',
  'Correo',
  'Celular',
  'Servicio de interés',
  'Consentimiento',
  'Origen QR',
  'Dispositivo',
  'Timestamp'
];

// ── POST: recibe el formulario ────────────────────────────────
function doPost(e) {
  try {
    var raw = (e.parameter && e.parameter.data) || (e.postData && e.postData.contents);
    var d   = JSON.parse(raw);

    // Honeypot: si viene lleno es un bot. Respondemos OK para no darle pistas.
    if (d.website) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    guardarLead(d);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── GET: healthcheck / conteo rápido desde el celular ─────────
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';

  if (action === 'count') {
    var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    var total = (!sheet || sheet.getLastRow() < 2) ? 0 : sheet.getLastRow() - 1;
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, total: total }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, status: 'online' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Guardar fila ──────────────────────────────────────────────
function guardarLead(d) {
  var ss    = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

  // Crear cabecera si la hoja está vacía
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length)
         .setBackground('#14172d')
         .setFontColor('#FFFFFF')
         .setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.setColumnWidths(1, HEADERS.length, 160);
  }

  function v(val) { return val == null ? '' : String(val).trim(); }

  var ahora = new Date();
  var tz    = 'America/Lima';

  // Anti-duplicado: si el mismo correo ya se registró, no duplicamos la fila.
  // (Pasa seguido: la gente reenvía por reintento cuando la señal falla.)
  var correo = v(d.correo).toLowerCase();
  if (correo && sheet.getLastRow() > 1) {
    var correos = sheet.getRange(2, 6, sheet.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < correos.length; i++) {
      if (String(correos[i][0]).trim().toLowerCase() === correo) return;
    }
  }

  sheet.appendRow([
    Utilities.formatDate(ahora, tz, 'dd/MM/yyyy'),
    Utilities.formatDate(ahora, tz, 'HH:mm'),
    v(d.nombre),
    v(d.empresa),
    v(d.cargo),
    v(d.correo),
    v(d.celular),
    v(d.servicio),
    d.consentimiento ? 'Sí' : 'No',
    v(d.origen) || 'directo',
    v(d.dispositivo),
    ahora.toISOString()
  ]);
}

// ── PRUEBA MANUAL ─────────────────────────────────────────────
//  doGet y doPost NO se pueden ejecutar desde el editor: son
//  puntos de entrada web y esperan el objeto de evento `e` que
//  solo llega en una petición HTTP real. Ejecutarlos a mano da
//  "Se ha producido un error desconocido".
//
//  Esta función sí. Ejecútala desde el editor para:
//    1. Disparar la pantalla de autorización (obligatoria).
//    2. Verificar que el SHEET_ID es correcto.
//    3. Confirmar que se escribe la fila con sus cabeceras.
//
//  Debe aparecer una fila de prueba en la hoja "Leads".
//  Bórrala a mano antes del evento.
function probar() {
  guardarLead({
    nombre:         'PRUEBA — borrar esta fila',
    empresa:        'INACONS',
    cargo:          'Test',
    correo:         'prueba@inacons.com.pe',
    celular:        '999999999',
    servicio:       'Minería',
    consentimiento: true,
    origen:         'prueba-editor',
    dispositivo:    'Apps Script editor'
  });
  Logger.log('OK — revisa la hoja "Leads", debe haber una fila de prueba.');
}
