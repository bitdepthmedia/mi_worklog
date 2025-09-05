/* ========= Worklog Weekly Manager ========= */
/* ========= Config ========= */
const WEEK_SHEET_PREFIX = 'Week ';
const MAX_WEEKS = 52;
const START_NAMED_RANGE = 'schoolYearStart';
const START_RANGE_A1 = "'START HERE - DATA ENTRY TAB'!B7";

/**
 * Ensures the named range `schoolYearStart` exists and points to B7.
 * @returns {void}
 */
function ensureNamedRange_() {
  const ss = SpreadsheetApp.getActive();
  const exists = ss.getNamedRanges().some(n => n.getName() === START_NAMED_RANGE);
  if (exists) return;

  const match = START_RANGE_A1.match(/^'?(.*?)'?!([A-Z]+\d+)$/);
  if (!match) throw new Error('Invalid START_RANGE_A1 format.');
  const sheetName = match[1];
  const a1 = match[2];
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error(`Sheet not found: ${sheetName}`);
  const range = sheet.getRange(a1);
  ss.setNamedRange(START_NAMED_RANGE, range);
}

/**
 * Returns the template week sheet: "Week Template" or fallback "Week 1".
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getTemplateSheet_() {
  const ss = SpreadsheetApp.getActive();
  return ss.getSheetByName('Week Template') || ss.getSheetByName('Week 1');
}

/**
 * Formats a week sheet name from index.
 * @param {number} index - 1-based week index.
 * @returns {string}
 */
function weekName_(index) {
  return `${WEEK_SHEET_PREFIX}${index}`;
}

/**
 * Returns the Monday of the week for date (Monday=0).
 * @param {Date} d - Date to normalize.
 * @returns {Date}
 */
function mondayOf_(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // Mon=0..Sun=6
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Computes 1-based week index for a given date relative to the school year start.
 * @param {Date} date - Arbitrary date.
 * @returns {number}
 */
function getWeekIndexForDate_(date) {
  const ss = SpreadsheetApp.getActive();
  const startRange = ss.getRangeByName(START_NAMED_RANGE);
  if (!startRange) throw new Error(`Named range ${START_NAMED_RANGE} not found.`);
  const startVal = startRange.getValue();
  if (!startVal) throw new Error('School year start date is blank.');
  const start = new Date(startVal);

  const startMonday = mondayOf_(start);
  const dateMonday = mondayOf_(date);

  const msInDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.floor((dateMonday - startMonday) / msInDay);
  const index = Math.floor(diffDays / 7) + 1;
  return Math.min(Math.max(index, 1), MAX_WEEKS);
}

/**
 * Creates or returns the sheet for a week index.
 * Duplicates template and configures date formulas.
 * @param {number} index - 1-based week index.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getOrCreateWeekSheet_(index) {
  const ss = SpreadsheetApp.getActive();
  const name = weekName_(index);
  const existing = ss.getSheetByName(name);
  if (existing) return existing;

  const tpl = getTemplateSheet_();
  if (!tpl) throw new Error('No template sheet found: create "Week Template".');
  const newSheet = tpl.copyTo(ss).setName(name);
  configureWeekSheet_(newSheet, index);
  return newSheet;
}

/**
 * Sets E3/E4 formulas to compute Monday/Friday from the start date.
 * No cross-sheet dependencies. Assumes E3 = start Monday, E4 = Friday.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - Target week sheet.
 * @param {number} index - 1-based week index.
 * @returns {void}
 */
function configureWeekSheet_(sheet, index) {
  sheet.getRange('E3')
    .setFormula(`=${START_NAMED_RANGE} - WEEKDAY(${START_NAMED_RANGE}, 3) + 7*(${index}-1)`);
  sheet.getRange('E4')
    .setFormula('=E3 + 4');
}

/**
 * Hides all week sheets except the provided one.
 * @param {string} visibleName - Week sheet name to keep visible.
 * @returns {void}
 */
function hideAllWeeksExcept_(visibleName) {
  const ss = SpreadsheetApp.getActive();
  ss.getSheets().forEach(sh => {
    if (sh.getName().startsWith(WEEK_SHEET_PREFIX)) {
      if (sh.getName() === visibleName) sh.showSheet();
      else sh.hideSheet();
    }
  });
}

/**
 * Shows all week sheets.
 * @returns {void}
 */
function showAllWeeks() {
  const ss = SpreadsheetApp.getActive();
  ss.getSheets().forEach(sh => {
    if (sh.getName().startsWith(WEEK_SHEET_PREFIX)) sh.showSheet();
  });
}

/**
 * Generates all week sheets (1..52) from template if missing.
 * Idempotent: skips existing.
 * @returns {void}
 */
function generateAllWeeks() {
  ensureNamedRange_();
  for (let i = 1; i <= MAX_WEEKS; i++) {
    getOrCreateWeekSheet_(i);
  }
}

/**
 * Shows the week for today's date (creates if missing) and hides others.
 * @returns {void}
 */
function showCurrentWeek() {
  ensureNamedRange_();
  const idx = getWeekIndexForDate_(new Date());
  const target = getOrCreateWeekSheet_(idx);
  const ss = SpreadsheetApp.getActive();
  ss.setActiveSheet(target);
  hideAllWeeksExcept_(target.getName());
}

/**
 * Parses YYYY-MM-DD string into a Date at local midnight.
 * @param {string} text - Date string (YYYY-MM-DD).
 * @returns {Date}
 */
function parseYyyyMmDd_(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text || '').trim());
  if (!m) throw new Error('Invalid date. Use YYYY-MM-DD.');
  const y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3]);
  const dt = new Date(y, mo, d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

/**
 * Shows the week for a specific date string (YYYY-MM-DD).
 * Used by the modal dialog.
 * @param {string} dateStr - Date string (YYYY-MM-DD).
 * @returns {{ok:boolean,message:string}}
 */
function showWeekForDate(dateStr) {
  try {
    ensureNamedRange_();
    const dt = parseYyyyMmDd_(dateStr);
    const idx = getWeekIndexForDate_(dt);
    const target = getOrCreateWeekSheet_(idx);
    SpreadsheetApp.getActive().setActiveSheet(target);
    hideAllWeeksExcept_(target.getName());
    return { ok: true, message: `Showing ${target.getName()}` };
  } catch (e) {
    return { ok: false, message: e && e.message ? e.message : String(e) };
  }
}

/**
 * Opens a centered modal dialog to choose a date/week.
 * @returns {void}
 */
function openWeekSelectorDialog() {
  ensureNamedRange_();
  const html = HtmlService.createHtmlOutputFromFile('WeekDialog')
    .setWidth(420)
    .setHeight(240);
  SpreadsheetApp.getUi().showModalDialog(html, 'Select Week');
}

/**
 * Registers the Worklog menu under the provided UI instance.
 * Call from the project's main onOpen() to avoid duplicate simple triggers.
 * @param {GoogleAppsScript.Base.Ui} ui - Spreadsheet UI instance.
 * @returns {void}
 */
function registerWorklogMenu_(ui) {
  ui.createMenu('Worklog')
    .addItem('Show Current Week', 'showCurrentWeek')
    .addItem('Open Week Selector…', 'openWeekSelectorDialog')
    .addSeparator()
    .addItem('Generate All Weeks (52)', 'generateAllWeeks')
    .addItem('Show All Weeks', 'showAllWeeks')
    .addToUi();
}
