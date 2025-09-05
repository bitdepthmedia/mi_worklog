/**
 * Shows the Student Caseload sidebar.
 * @returns {void}
 */
function showStudentSidebar() {
  var output = HtmlService.createHtmlOutputFromFile('StudentSidebar')
    .setTitle('Student Caseload');
  SpreadsheetApp.getUi().showSidebar(output);
}

/**
 * Returns initialization data for the student sidebar (groups, exit reasons, id length, active students).
 * @returns {{groups:string[], exitReasons:string[], idLength:number, activeStudents:Array<{row:number,name:string,id:string,grade:number,group:string}>}}
 */
function getStudentSidebarInit() {
  return {
    groups: getGroupNames_(),
    exitReasons: getExitReasons_(),
    idLength: getStudentIdLength_(),
    activeStudents: getActiveStudents_()
  };
}

/**
 * Adds a new student to the Student Caseload sheet.
 * Validates inputs and sorts by Entrance Date, Grade, then Student Name.
 * @param {{grade:(number|string), name:string, group:string, newGroup?:string, studentId:(number|string), serviceArea:string, entranceDate:string}} payload
 * @returns {{ok:boolean,message:string,placedRow?:number}}
 */
function addStudentToCaseload(payload) {
  validateAddPayload_(payload);

  // Resolve group name (may insert into settings if requested)
  var groupName = resolveGroupSelection_(payload.group, payload.newGroup || '');

  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(SHEETS.studentCaseload) || ss.getSheetByName('Student Caseload') || ss.getActiveSheet();
  if (!sheet) throw new Error('Student Caseload sheet not found.');

  var header = findStudentHeaderRow_(sheet);
  var dataStart = header + 1;
  var lastRow = Math.max(sheet.getLastRow(), dataStart);

  // Build row values according to columns A..F
  var grade = Number(payload.grade);
  var name = String(payload.name).trim();
  var idStr = String(payload.studentId).trim();
  var service = String(payload.serviceArea).trim();
  var entrance = parseIsoDate_(payload.entranceDate);

  var rowValues = [grade, name, groupName, idStr, service, entrance, '', ''];

  // Insert a new row at the end of the data region, then sort entire data block
  var insertRow = lastRow + 1;
  sheet.getRange(insertRow, 1, 1, rowValues.length).setValues([rowValues]);

  // Sort by Entrance Date (F), Grade (A), Student Name (B)
  var width = Math.max(8, sheet.getLastColumn());
  sheet.getRange(dataStart, 1, sheet.getLastRow() - dataStart + 1, width).sort([
    { column: 6, ascending: true },
    { column: 1, ascending: true },
    { column: 2, ascending: true }
  ]);

  return { ok: true, message: 'Student added to caseload.', placedRow: insertRow };
}

/**
 * Exits an active student by setting Exit Date and Exit Reason.
 * The student may be referenced by a row number (preferred) or by studentId.
 * @param {{row?:number, studentId?:string|number, exitDate:string, exitReason:string}} payload
 * @returns {{ok:boolean,message:string,row:number}}
 */
function exitStudentFromCaseload(payload) {
  if (!payload) throw new Error('No data provided.');
  var exitDate = parseIsoDate_(payload.exitDate);
  var reason = String(payload.exitReason || '').trim();
  if (!reason) throw new Error('Exit Reason is required.');

  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(SHEETS.studentCaseload) || ss.getSheetByName('Student Caseload');
  if (!sheet) throw new Error('Student Caseload sheet not found.');

  var header = findStudentHeaderRow_(sheet);
  var dataStart = header + 1;
  var last = sheet.getLastRow();
  var targetRow = 0;

  if (payload.row && payload.row >= dataStart && payload.row <= last) {
    targetRow = payload.row;
  } else if (payload.studentId) {
    var idStr = String(payload.studentId).trim();
    var idColVals = sheet.getRange(dataStart, 4, last - dataStart + 1, 1).getValues();
    for (var i = 0; i < idColVals.length; i++) {
      if (String(idColVals[i][0]).trim() === idStr) { targetRow = dataStart + i; break; }
    }
  }
  if (!targetRow) throw new Error('Student not found.');

  // Write Exit Date (G) and Exit Reason (H)
  sheet.getRange(targetRow, 7, 1, 2).setValues([[exitDate, reason]]);
  return { ok: true, message: 'Student exited.', row: targetRow };
}

/**
 * Returns group names from settings!E3:E with the special option at the end.
 * @returns {string[]}
 */
function getGroupNames_() {
  var ss = SpreadsheetApp.getActive();
  var settings = ss.getSheetByName(SHEETS.settings);
  var out = [];
  if (settings) {
    var last = settings.getLastRow();
    if (last >= 3) {
      out = settings.getRange(3, 5, last - 2, 1).getValues()
        .map(function(r){ return String(r[0] || '').trim(); })
        .filter(function(v){ return !!v; });
    }
  }
  out.push('Add New Group…');
  return out;
}

/**
 * Returns exit reasons from settings!C3:C.
 * @returns {string[]}
 */
function getExitReasons_() {
  var ss = SpreadsheetApp.getActive();
  var settings = ss.getSheetByName(SHEETS.settings);
  if (!settings) return [];
  var last = settings.getLastRow();
  if (last < 3) return [];
  return settings.getRange(3, 3, last - 2, 1).getValues()
    .map(function(r){ return String(r[0] || '').trim(); })
    .filter(function(v){ return !!v; });
}

/**
 * Returns active students (rows with blank Exit Date).
 * @returns {Array<{row:number,name:string,id:string,grade:number,group:string}>}
 */
function getActiveStudents_() {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(SHEETS.studentCaseload) || ss.getSheetByName('Student Caseload');
  if (!sheet) return [];
  var header = findStudentHeaderRow_(sheet);
  var dataStart = header + 1;
  var last = sheet.getLastRow();
  if (last < dataStart) return [];
  var rng = sheet.getRange(dataStart, 1, last - dataStart + 1, 8).getValues();
  var out = [];
  for (var i = 0; i < rng.length; i++) {
    var row = dataStart + i;
    var grade = Number(rng[i][0] || 0);
    var name = String(rng[i][1] || '').trim();
    var group = String(rng[i][2] || '').trim();
    var id = String(rng[i][3] || '').trim();
    var exitDate = rng[i][6];
    if (!exitDate && name && id) {
      out.push({ row: row, name: name, id: id, grade: grade, group: group });
    }
  }
  return out;
}

/**
 * Returns the expected student ID digit length from settings!D3.
 * @returns {number}
 */
function getStudentIdLength_() {
  var ss = SpreadsheetApp.getActive();
  var settings = ss.getSheetByName(SHEETS.settings);
  if (!settings) return 0;
  var v = settings.getRange('D3').getValue();
  var n = Number(v);
  return isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * Validates the Add Student payload.
 * @param {{grade:(number|string), name:string, group:string, newGroup?:string, studentId:(number|string), serviceArea:string, entranceDate:string}} p
 * @returns {void}
 */
function validateAddPayload_(p) {
  if (!p) throw new Error('No data provided.');
  var grade = Number(p.grade);
  if (!isFinite(grade) || grade < 0 || grade > 12) throw new Error('Grade must be between 0 and 12 (KG=0).');
  if (!String(p.name || '').trim()) throw new Error('Student Name is required.');
  if (!String(p.group || '').trim()) throw new Error('Group selection is required (or Add New).');
  var idStr = String(p.studentId || '').trim();
  if (!/^[0-9]+$/.test(idStr)) throw new Error('Student ID must be numeric.');
  var needLen = getStudentIdLength_();
  if (needLen && idStr.length !== needLen) throw new Error('Student ID must be exactly ' + needLen + ' digits.');
  if (!String(p.serviceArea || '').trim()) throw new Error('Service Area is required.');
  if (!String(p.entranceDate || '').trim()) throw new Error('Entrance Date is required.');
  // Validate ISO date format
  parseIsoDate_(p.entranceDate);
}

/**
 * Resolves the group selection; if "Add New Group…" is chosen, inserts newGroup into settings and returns its value.
 * @param {string} group
 * @param {string} newGroup
 * @returns {string}
 */
function resolveGroupSelection_(group, newGroup) {
  var sel = String(group || '').trim();
  if (sel !== 'Add New Group…') return sel;
  var val = String(newGroup || '').trim();
  if (!val) throw new Error('Please enter a new group name.');
  var ss = SpreadsheetApp.getActive();
  var settings = ss.getSheetByName(SHEETS.settings);
  if (!settings) throw new Error('settings sheet not found.');
  var last = settings.getLastRow();
  var row = Math.max(3, last + 1);
  // Find first empty in E3:E
  var rangeVals = [];
  if (last >= 3) {
    rangeVals = settings.getRange(3, 5, last - 2, 1).getValues();
    for (var i = 0; i < rangeVals.length; i++) {
      if (!String(rangeVals[i][0] || '').trim()) { row = 3 + i; break; }
    }
  }
  settings.getRange(row, 5).setValue(val);
  return val;
}

/**
 * Parses YYYY-MM-DD into a Date object (no time component).
 * @param {string} iso
 * @returns {Date}
 */
function parseIsoDate_(iso) {
  var m = String(iso || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error('Date must be YYYY-MM-DD.');
  var y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) throw new Error('Invalid calendar date.');
  return new Date(y, mo - 1, d);
}

/**
 * Finds the header row in the Student Caseload sheet by scanning for expected labels.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @returns {number} 1-based row index of the header
 */
function findStudentHeaderRow_(sheet) {
  var data = sheet.getDataRange().getValues();
  for (var r = 0; r < data.length; r++) {
    var row = data[r].map(function(v){ return String(v || '').toUpperCase().trim(); });
    if (row[0] === 'GRADE' && row[1] === 'STUDENT NAME' && row[5].indexOf('ENTRANCE DATE') !== -1) {
      return r + 1;
    }
  }
  // Fallback to row 2 as in provided layout
  return 2;
}

/**
 * Adds a custom menu item on open for Student Caseload.
 * This is optional redundancy with the sheet button; the drawing/image button
 * should be assigned to call `showStudentSidebar`.
 * @returns {void}
 */
function onOpenStudentCaseload_() {
  SpreadsheetApp.getUi()
    .createMenu('Students')
    .addItem('Open Caseload Sidebar', 'showStudentSidebar')
    .addToUi();
}

