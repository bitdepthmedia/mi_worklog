/**
 * Bootstrap the blank workbook with required tabs, headers, and basic protections.
 * Safe to run multiple times (idempotent).
 */
function bootstrapWorkbook() {
  const ss = SpreadsheetApp.getActive();
  const sheets = getSheetsMap_(ss);

  // 1) Ensure required sheets exist
  const S = (typeof CONFIG !== 'undefined' && CONFIG.SHEETS) ? CONFIG.SHEETS : {};
  const REQ = {
    SETTINGS: ensureSheet_(ss, sheets, S.SETTINGS),
    STAFF: ensureSheet_(ss, sheets, S.STAFF),
    STUDENTS: ensureSheet_(ss, sheets, S.STUDENTS),
    CASELOAD: ensureSheet_(ss, sheets, S.CASELOAD),
    WORKLOG: ensureSheet_(ss, sheets, S.WORKLOG),
    PARS_OVERRIDES: ensureSheet_(ss, sheets, S.PARS_OVERRIDES),
    AUDIT: ensureSheet_(ss, sheets, S.AUDIT),
  };

  // 2) Seed headers (only if sheet is empty or headers missing)
  seedHeaders_(REQ.SETTINGS, [
    ['key','value','notes'],
    ['school_year','','e.g., 2025-26'],
    ['default_min_increment','5','minutes'],
    ['activities_json','[{"code":"INSTR","label":"Instruction","allowable":true},{"code":"PREP","label":"Preparation","allowable":true},{"code":"OTHER","label":"Other","allowable":false}]','Edit with caution']
  ]);

  seedHeaders_(REQ.STAFF, [
    ['staff_id','name','email','building_id','role','active'],
  ]);

  seedHeaders_(REQ.STUDENTS, [
    ['student_id','name','grade','building_id','flags','active'],
  ]);

  seedHeaders_(REQ.CASELOAD, [
    ['staff_id','student_id','start_date','end_date','services','notes'],
  ]);

  seedHeaders_(REQ.WORKLOG, [
    ['id','user_email','date_iso','minutes','student_id','activity_code','notes','created_at'],
  ]);

  seedHeaders_(REQ.PARS_OVERRIDES, [
    ['id','staff_id','date_iso','minutes','reason_code','notes','created_at'],
  ]);

  // Audit sheet: append-only log headers
  seedHeaders_(REQ.AUDIT, [
    ['Timestamp','User','Action','Payload','Checksum'],
  ]);

  // 3) Basic formatting
  autoSize_(REQ.SETTINGS, 1, 3);
  autoSize_(REQ.STAFF, 1, 6);
  autoSize_(REQ.STUDENTS, 1, 6);
  autoSize_(REQ.CASELOAD, 1, 6);
  autoSize_(REQ.WORKLOG, 1, 8);
  autoSize_(REQ.PARS_OVERRIDES, 1, 7);
  autoSize_(REQ.AUDIT, 1, 5);

  boldHeader_(REQ.SETTINGS);
  boldHeader_(REQ.STAFF);
  boldHeader_(REQ.STUDENTS);
  boldHeader_(REQ.CASELOAD);
  boldHeader_(REQ.WORKLOG);
  boldHeader_(REQ.PARS_OVERRIDES);
  boldHeader_(REQ.AUDIT);

  // 4) Minimal validations (date columns)
  addDateValidation_(REQ.CASELOAD, 'C2:D1000');       // start_date, end_date
  addDateValidation_(REQ.WORKLOG, 'C2:C200000');      // date_iso
  addDateValidation_(REQ.PARS_OVERRIDES, 'C2:C20000');// date_iso

  // 5) Protections (lock headers on all sheets)
  protectHeaderRow_(REQ.SETTINGS);
  protectHeaderRow_(REQ.STAFF);
  protectHeaderRow_(REQ.STUDENTS);
  protectHeaderRow_(REQ.CASELOAD);
  protectHeaderRow_(REQ.WORKLOG);
  protectHeaderRow_(REQ.PARS_OVERRIDES);
  protectHeaderRow_(REQ.AUDIT);

  // 6) Named ranges (optional, helpful later)
  setNamedRange_(ss, 'WORKLOG_TABLE', REQ.WORKLOG.getRange(1,1,REQ.WORKLOG.getMaxRows(), REQ.WORKLOG.getMaxColumns()));
  setNamedRange_(ss, 'CASELOAD_TABLE', REQ.CASELOAD.getRange(1,1,REQ.CASELOAD.getMaxRows(), REQ.CASELOAD.getMaxColumns()));
  setNamedRange_(ss, 'STUDENTS_TABLE', REQ.STUDENTS.getRange(1,1,REQ.STUDENTS.getMaxRows(), REQ.STUDENTS.getMaxColumns()));
  setNamedRange_(ss, 'STAFF_TABLE', REQ.STAFF.getRange(1,1,REQ.STAFF.getMaxRows(), REQ.STAFF.getMaxColumns()));
  setNamedRange_(ss, 'SETTINGS_TABLE', REQ.SETTINGS.getRange(1,1,REQ.SETTINGS.getMaxRows(), REQ.SETTINGS.getMaxColumns()));

  // 7) Freeze header rows
  [REQ.SETTINGS, REQ.STAFF, REQ.STUDENTS, REQ.CASELOAD, REQ.WORKLOG, REQ.PARS_OVERRIDES, REQ.AUDIT]
    .forEach(sh => sh.setFrozenRows(1));

  // 8) Confirm
  SpreadsheetApp.getUi().alert('Worklog setup complete.\nTabs and headers are ready.');
}

/* ========== helpers ========== */

function getSheetsMap_(ss) {
  const map = {};
  ss.getSheets().forEach(sh => map[sh.getName()] = sh);
  return map;
}

function ensureSheet_(ss, map, name) {
  if (!name || typeof name !== 'string') {
    throw new Error('CONFIG.SHEETS is missing a required sheet name.');
  }
  if (map[name]) return map[name];
  return ss.insertSheet(name);
}

function seedHeaders_(sheet, rows) {
  const header = rows[0];
  const range = sheet.getRange(1,1,1,header.length);
  const existing = range.getValues()[0];
  const needHeaders = existing.every(v => v === '' || v === null);
  if (needHeaders) {
    sheet.clear();
    sheet.getRange(1,1,rows.length, rows[0].length).setValues(rows);
  }
}

function boldHeader_(sheet) {
  const lastCol = sheet.getLastColumn() || 1;
  sheet.getRange(1,1,1,lastCol).setFontWeight('bold').setBackground('#f1f3f4');
}

function autoSize_(sheet, startCol, endCol) {
  for (let c = startCol; c <= endCol; c++) sheet.autoResizeColumn(c);
}

function addDateValidation_(sheet, a1) {
  const r = sheet.getRange(a1);
  const rule = SpreadsheetApp.newDataValidation()
    .requireDate()
    .setAllowInvalid(false)
    .build();
  r.setDataValidation(rule);
}

function protectHeaderRow_(sheet) {
  const p = sheet.protect();
  p.removeEditors(p.getEditors()); // default: only owner can edit
  p.setDescription('Protected: structure & headers');
  // Unprotect everything except header
  const range = sheet.getRange(2,1, sheet.getMaxRows()-1, sheet.getMaxColumns());
  const unprot = sheet.protect();
  unprot.setUnprotectedRanges([range]);
  unprot.setDescription('Unprotected: data entry area');
  // Remove sheet-level protection to avoid double-protecting the whole sheet
  p.remove();
}

function setNamedRange_(ss, name, range) {
  const existing = ss.getNamedRanges().find(nr => nr.getName() === name);
  if (existing) {
    existing.setRange(range);
  } else {
    ss.setNamedRange(name, range);
  }
}