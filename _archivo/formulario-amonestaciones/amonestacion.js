var SHEET_ID   = '1YIGjPiryuaB8m98n8-7_0mRLxabwHd92Meuq2BWLdo4';
var SHEET_NAME = 'Registros';

var HEADERS = [
  // Datos generales
  'Fecha',
  'Tipo Documento',
  'Subtipo',
  'Asunto',

  // Trabajador
  'Nombre Trabajador',

  // Memorando Informativo
  'Memo_Inf: Asunto',
  'Memo_Inf: Descripción',

  // Memorando Recordatorio
  'Memo_Rec: Asunto',
  'Memo_Rec: Descripción',
  'Memo_Rec: Corrección esperada',

  // Amonestación – Inasistencia a reunión
  'Reunión: Fecha',

  // Amonestación – Incumplimiento de Funciones
  'Func: Qué incumplió',
  'Func: Corrección',
  'Func: Falta grave',

  // Amonestación – Incumplimiento de Tareas
  'Tareas: Falta grave',
  'T1: Tarea',     'T1: F. Creación', 'T1: Designado', 'T1: F. Vencimiento', 'T1: Tiempo vencido',
  'T2: Tarea',     'T2: F. Creación', 'T2: Designado', 'T2: F. Vencimiento', 'T2: Tiempo vencido',
  'T3: Tarea',     'T3: F. Creación', 'T3: Designado', 'T3: F. Vencimiento', 'T3: Tiempo vencido',
  'T4: Tarea',     'T4: F. Creación', 'T4: Designado', 'T4: F. Vencimiento', 'T4: Tiempo vencido',
  'T5: Tarea',     'T5: F. Creación', 'T5: Designado', 'T5: F. Vencimiento', 'T5: Tiempo vencido',

  // Timestamp interno
  'Timestamp'
];

// ── POST: recibe el formulario ─────────────────────────────────
function doPost(e) {
  try {
    var raw  = e.parameter.data || e.postData.contents;
    var d    = JSON.parse(raw);
    guardarRegistro(d);
    return HtmlService.createHtmlOutput('<p>OK</p>');
  } catch(err) {
    return HtmlService.createHtmlOutput('<p>Error: ' + err.toString() + '</p>');
  }
}

// ── GET: devuelve registros en JSON ───────────────────────────
function doGet(e) {
  var action = (e.parameter && e.parameter.action) || '';
  if (action === 'get') {
    return ContentService
      .createTextOutput(JSON.stringify(obtenerRegistros()))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Guardar fila ──────────────────────────────────────────────
function guardarRegistro(d) {
  var ss    = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

  // Crear cabecera si la hoja está vacía
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    var hRange = sheet.getRange(1, 1, 1, HEADERS.length);
    hRange.setBackground('#1F3864').setFontColor('#FFFFFF').setFontWeight('bold');
    sheet.setFrozenRows(1);
    // Ajustar ancho de columnas
    sheet.setColumnWidths(1, HEADERS.length, 150);
  }

  // Helper para vacíos
  function v(val) { return val || ''; }

  // Tareas (hasta 5)
  var tareas = d.tareas || [];
  function t(i, campo) {
    return tareas[i] ? v(tareas[i][campo]) : '';
  }

  var fila = [
    // Generales
    v(d.fecha),
    v(d.tipo_doc),
    v(d.subtipo),
    v(d.asunto),

    // Trabajador
    v(d.nombre),

    // Memo Informativo
    v(d.memoinf_asunto),
    v(d.memoinf_desc),

    // Memo Recordatorio
    v(d.memorec_asunto),
    v(d.memorec_desc),
    v(d.memorec_exhort),

    // Reunión
    v(d.reunion_fecha),

    // Funciones
    v(d.func_que),
    v(d.func_exhort),
    v(d.func_fg),

    // Tareas
    v(d.tareas_fg),
    t(0,'tarea'), t(0,'fcreac'), t(0,'design'), t(0,'venc'), t(0,'tvenc'),
    t(1,'tarea'), t(1,'fcreac'), t(1,'design'), t(1,'venc'), t(1,'tvenc'),
    t(2,'tarea'), t(2,'fcreac'), t(2,'design'), t(2,'venc'), t(2,'tvenc'),
    t(3,'tarea'), t(3,'fcreac'), t(3,'design'), t(3,'venc'), t(3,'tvenc'),
    t(4,'tarea'), t(4,'fcreac'), t(4,'design'), t(4,'venc'), t(4,'tvenc'),

    new Date().toISOString()
  ];

  sheet.appendRow(fila);
}

// ── Leer registros para el panel ──────────────────────────────
function obtenerRegistros() {
  var ss    = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return [];

  var data = sheet.getDataRange().getValues();
  var rows = data.slice(1); // quitar cabecera

  return rows.map(function(row) {
    return {
      fecha:         row[0],
      tipo_doc:      row[1],
      subtipo:       row[2],
      asunto:        row[3],
      nombre:        row[4],
      // Campos específicos para el panel de detalle (RRHH)
      memoinf_asunto:  row[5],
      memoinf_desc:    row[6],
      memorec_asunto:  row[7],
      memorec_desc:    row[8],
      memorec_exhort:  row[9],
      reunion_fecha:   row[10],
      func_que:        row[11],
      func_exhort:     row[12],
      func_fg:         row[13],
      tareas_fg:       row[14],
      // Falta grave consolidada para filtros del panel
      falta_grave: row[13] || row[14] || '—',
      // Tareas (para panel RRHH)
      tareas: [
        row[15] ? { tarea:row[15], fcreac:row[16], design:row[17], venc:row[18], tvenc:row[19] } : null,
        row[20] ? { tarea:row[20], fcreac:row[21], design:row[22], venc:row[23], tvenc:row[24] } : null,
        row[25] ? { tarea:row[25], fcreac:row[26], design:row[27], venc:row[28], tvenc:row[29] } : null,
        row[30] ? { tarea:row[30], fcreac:row[31], design:row[32], venc:row[33], tvenc:row[34] } : null,
        row[35] ? { tarea:row[35], fcreac:row[36], design:row[37], venc:row[38], tvenc:row[39] } : null,
      ].filter(Boolean)
    };
  });
}