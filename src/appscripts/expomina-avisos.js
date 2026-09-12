// ============================================================
//  AVISOS POR CORREO — Leads de EXPOMINA 2026
//
//  Vigila la hoja "Leads" y avisa por correo cuando entran
//  registros nuevos. Agrupa: 10 leads en 5 minutos = 1 correo.
//
//  ─── POR QUÉ ES UN SCRIPT APARTE ───────────────────────────
//  Lo natural sería meter el MailApp.sendEmail dentro de
//  guardarLead() en expomina.js. NO se hace así mientras la
//  feria está en curso.
//
//  Tocar expomina.js obliga a publicar una versión nueva del
//  Web App. Si en ese paso se elige "Nueva implementación" en
//  vez de "Nueva versión" de la existente, la URL /exec cambia
//  y el formulario que está en el QR deja de funcionar — en
//  medio del evento, sin que nadie se entere hasta contar los
//  leads al final del día.
//
//  Este archivo se instala como proyecto independiente con un
//  disparador por tiempo. No tiene doPost, no se publica como
//  Web App, y no puede romper la captura. Después de la feria
//  se puede fusionar con expomina.js con calma.
//
//  ─── INSTALACIÓN (5 minutos, se puede hacer con la feria en curso) ───
//   1. Abrir la hoja de leads:
//      docs.google.com/spreadsheets/d/1fwU-fOSgvrFG1CkoUuKSKdOWZUuZjUDu3JXlynCzoFk
//   2. Extensiones → Apps Script. Se abre el proyecto de expomina.js.
//   3. Añadir un archivo nuevo (+ → Secuencia de comandos) llamado
//      "avisos" y pegar ESTE contenido. NO borres ni edites el
//      archivo que ya está.
//   4. Ajustar AVISAR_A con los correos que deben recibir el aviso.
//   5. Seleccionar la función "probarAviso" y Ejecutar.
//      → autoriza los permisos (Gmail aparece ahora en la lista)
//      → debe llegar un correo de prueba
//   6. Seleccionar "crearDisparador" y Ejecutar una sola vez.
//      → desde ese momento revisa cada 5 minutos, solo.
//
//  NO hay que volver a publicar el Web App en ningún paso.
//  La URL /exec del formulario no se toca.
// ============================================================

var SHEET_ID   = '1fwU-fOSgvrFG1CkoUuKSKdOWZUuZjUDu3JXlynCzoFk';
var SHEET_NAME = 'Leads';

// Quién recibe el aviso. Separar con comas dentro del mismo string.
var AVISAR_A = 'ventas@inacons.com.pe, gerencia.proyectos@inacons.com.pe';

// Cada cuántos minutos revisar. 5 es lo mínimo razonable en feria.
var CADA_MINUTOS = 5;

// Máximo de leads detallados en un correo. El resto se resume.
var MAX_DETALLE = 40;

// Columnas de la hoja "Leads" (1-indexadas, según HEADERS de expomina.js)
var COL = {
  FECHA: 1, HORA: 2, NOMBRE: 3, EMPRESA: 4, CARGO: 5, CORREO: 6,
  CELULAR: 7, SERVICIO: 8, CONSENT: 9, ORIGEN: 10, DISPOSITIVO: 11
};
var TOTAL_COLS = 12;

// Dónde se recuerda hasta qué fila ya se avisó. Se guarda en las
// propiedades del script, NO en la hoja: así no se altera ni una
// celda de lo que el formulario está escribiendo.
var PROP_ULTIMA_FILA = 'expomina_ultima_fila_avisada';


// ── Función principal — la que llama el disparador ────────────
function revisarYAvisar() {
  // Si una ejecución anterior todavía corre, salir sin hacer nada.
  // Evita correos duplicados cuando una revisión se demora.
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;

  try {
    var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) return;

    var ultimaFila = sheet.getLastRow();
    if (ultimaFila < 2) return; // solo cabecera, nada que avisar

    var props    = PropertiesService.getScriptProperties();
    var avisadaS = props.getProperty(PROP_ULTIMA_FILA);

    // Primera ejecución: arrancamos desde la cabecera para que el
    // primer correo traiga los leads que ya están y nadie vio.
    var avisada = avisadaS ? parseInt(avisadaS, 10) : 1;
    if (!(avisada >= 1)) avisada = 1;

    // La hoja se encogió (alguien borró filas de prueba). Reajustar.
    if (avisada > ultimaFila) {
      props.setProperty(PROP_ULTIMA_FILA, String(ultimaFila));
      return;
    }

    if (ultimaFila <= avisada) return; // nada nuevo

    var desde  = avisada + 1;
    var cuanto = ultimaFila - avisada;
    var filas  = sheet.getRange(desde, 1, cuanto, TOTAL_COLS).getValues();

    var enviado = enviarAviso(filas, ultimaFila);

    // Solo movemos el puntero si el correo salió. Si Gmail falla
    // (cuota diaria, caída), en la próxima pasada se reintenta:
    // preferimos un aviso repetido antes que un lead sin avisar.
    if (enviado) props.setProperty(PROP_ULTIMA_FILA, String(ultimaFila));

  } catch (err) {
    Logger.log('revisarYAvisar: ' + err.toString());
  } finally {
    lock.releaseLock();
  }
}


// ── Armado y envío del correo ─────────────────────────────────
function enviarAviso(filas, ultimaFila) {
  var n       = filas.length;
  var totales = ultimaFila - 1; // filas de datos en la hoja
  var asunto  = n === 1
    ? 'Expomina: 1 lead nuevo — ' + txt(filas[0][COL.NOMBRE - 1])
    : 'Expomina: ' + n + ' leads nuevos';

  var detalle = filas.slice(0, MAX_DETALLE).map(tarjetaLead).join('');
  var resto   = n > MAX_DETALLE
    ? '<p style="font:13px/1.5 Arial,sans-serif;color:#6b7494;margin:14px 0 0;">' +
      'Y ' + (n - MAX_DETALLE) + ' más. Están todos en la hoja.</p>'
    : '';

  var html =
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;">' +
      '<p style="font:600 15px/1.4 Arial,sans-serif;color:#14172d;margin:0 0 4px;">' +
        (n === 1 ? 'Entró 1 lead nuevo' : 'Entraron ' + n + ' leads nuevos') +
      '</p>' +
      '<p style="font:13px/1.4 Arial,sans-serif;color:#6b7494;margin:0 0 18px;">' +
        'Total acumulado en la feria: ' + totales + '.' +
      '</p>' +
      detalle + resto +
      '<p style="margin:22px 0 0;">' +
        '<a href="https://docs.google.com/spreadsheets/d/' + SHEET_ID + '" ' +
           'style="font:600 13px Arial,sans-serif;color:#1b5278;">Abrir la hoja completa →</a>' +
      '</p>' +
      '<p style="font:11px/1.5 Arial,sans-serif;color:#b0b6c8;margin:18px 0 0;">' +
        'Aviso automático del registro de Expomina 2026.' +
      '</p>' +
    '</div>';

  try {
    MailApp.sendEmail({
      to:       AVISAR_A,
      subject:  asunto,
      htmlBody: html,
      name:     'Registro Expomina — INACONS'
    });
    return true;
  } catch (err) {
    Logger.log('enviarAviso: ' + err.toString());
    return false;
  }
}


// ── Una tarjeta por lead, con acciones en un toque ────────────
//  El vendedor lee esto en el celular, en el stand. Los enlaces
//  de WhatsApp y correo evitan tener que copiar el número a mano.
function tarjetaLead(f) {
  var nombre   = txt(f[COL.NOMBRE - 1]);
  var empresa  = txt(f[COL.EMPRESA - 1]);
  var cargo    = txt(f[COL.CARGO - 1]);
  var correo   = txt(f[COL.CORREO - 1]);
  var celular  = txt(f[COL.CELULAR - 1]);
  var servicio = txt(f[COL.SERVICIO - 1]);
  var hora     = txt(f[COL.HORA - 1]);
  var origen   = txt(f[COL.ORIGEN - 1]);

  var wa = waLink(celular);

  var acciones = [];
  if (wa)     acciones.push('<a href="' + wa + '" style="font:600 12px Arial,sans-serif;color:#1b5278;">WhatsApp</a>');
  if (correo) acciones.push('<a href="mailto:' + correo + '" style="font:600 12px Arial,sans-serif;color:#1b5278;">Correo</a>');

  return '' +
    '<div style="border:1px solid #edf0f5;border-left:3px solid #d9822b;padding:13px 15px;margin:0 0 10px;">' +
      '<p style="font:700 14px/1.3 Arial,sans-serif;color:#14172d;margin:0 0 3px;">' + esc(nombre || '(sin nombre)') + '</p>' +
      '<p style="font:13px/1.5 Arial,sans-serif;color:#3d4460;margin:0 0 6px;">' +
        esc([cargo, empresa].filter(Boolean).join(' · ') || '—') +
      '</p>' +
      '<p style="font:12px/1.6 Arial,sans-serif;color:#6b7494;margin:0;">' +
        'Interés: <strong style="color:#3d4460;">' + esc(servicio || '—') + '</strong><br>' +
        esc(celular || 'sin celular') + ' · ' + esc(correo || 'sin correo') + '<br>' +
        hora + (origen ? ' · origen: ' + esc(origen) : '') +
      '</p>' +
      (acciones.length
        ? '<p style="margin:9px 0 0;">' + acciones.join(' &nbsp;|&nbsp; ') + '</p>'
        : '') +
    '</div>';
}


// ── Utilidades ────────────────────────────────────────────────
function txt(v) { return v == null ? '' : String(v).trim(); }

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

//  Normaliza a formato wa.me. Los visitantes escriben el celular
//  de todas las formas posibles: "999 888 777", "+51 999888777",
//  "051999888777". Nueve dígitos sueltos = número peruano.
function waLink(celular) {
  var d = String(celular || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 9)  d = '51' + d;
  if (d.length === 11 && d.indexOf('051') === 0) d = '51' + d.slice(3);
  if (d.length < 10 || d.length > 15) return '';
  return 'https://wa.me/' + d;
}


// ── Disparador ────────────────────────────────────────────────
function crearDisparador() {
  borrarDisparador(); // nunca dejar dos corriendo
  ScriptApp.newTrigger('revisarYAvisar')
    .timeBased()
    .everyMinutes(CADA_MINUTOS)
    .create();
  Logger.log('Listo — revisa cada ' + CADA_MINUTOS + ' minutos.');
}

function borrarDisparador() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'revisarYAvisar') ScriptApp.deleteTrigger(t);
  });
}


// ── Prueba manual ─────────────────────────────────────────────
//  Ejecutar esta primero: dispara la pantalla de autorización de
//  Gmail y confirma que el correo llega y se ve bien. No mueve el
//  puntero, así que el aviso real sigue pendiente.
function probarAviso() {
  var falso = new Array(TOTAL_COLS).fill('');
  falso[COL.FECHA - 1]    = '10/09/2026';
  falso[COL.HORA - 1]     = '11:42';
  falso[COL.NOMBRE - 1]   = 'PRUEBA — Juan Pérez';
  falso[COL.EMPRESA - 1]  = 'Minera Ejemplo S.A.';
  falso[COL.CARGO - 1]    = 'Jefe de Proyectos';
  falso[COL.CORREO - 1]   = 'prueba@inacons.com.pe';
  falso[COL.CELULAR - 1]  = '999 888 777';
  falso[COL.SERVICIO - 1] = 'Minería';
  falso[COL.ORIGEN - 1]   = 'prueba-editor';

  var ok = enviarAviso([falso], 2);
  Logger.log(ok ? 'Correo de prueba enviado a: ' + AVISAR_A
                : 'No se pudo enviar. Revisa el registro de ejecuciones.');
}

//  Reinicia el puntero para que el próximo aviso incluya TODOS los
//  leads de la hoja. Útil si querés recibir de nuevo el resumen
//  completo de la feria.
function reiniciarPuntero() {
  PropertiesService.getScriptProperties().deleteProperty(PROP_ULTIMA_FILA);
  Logger.log('Puntero reiniciado. El próximo aviso trae todos los leads.');
}
