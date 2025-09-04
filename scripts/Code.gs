/**
 * miWorklog – Core Apps Script
 * Sidebar-driven UX for adding time entries to the weekly worklog.
 * Follows project rules in AGENTS.md (modular, SoC, JSDoc, validation).
 */

/** @typedef {{ startTime:string, endTime:string, taskOption?:string, taskText?:string }} TaskEntry */

/**
 * Adds the Worklog menu and auto-opens the sidebar.
 * @param {GoogleAppsScript.Events.SheetsOnOpen} e - Open event payload
 * @returns {void}
 */
function onOpen(e) {
  SpreadsheetApp.getUi()
    .createMenu('Worklog')
    .addItem('Open Sidebar', 'showSidebar')
    .addToUi();
  // Auto-display the sidebar on load for convenience
  showSidebar();
}

/**
 * Builds and shows the sidebar UI.
 * @returns {void}
 */
function showSidebar() {
  var html = HtmlService.createTemplateFromFile('Sidebar');
  html.taskOptions = getTaskOptions();
  var output = html.evaluate().setTitle('Add Worklog Task');
  SpreadsheetApp.getUi().showSidebar(output);
}

/**
 * Returns task options for the dropdown.
 * Attempts (in order): NamedRange "TaskOptions", Sheet "task_options" Col A, fallback.
 * @returns {string[]}
 */
function getTaskOptions() {
  var ss = SpreadsheetApp.getActive();
  // 1) Named range
  try {
    var nr = ss.getRangeByName('TaskOptions');
    if (nr) {
      return (nr.getValues() || []).map(function(r){return r[0];}).filter(Boolean);
    }
  } catch (e) {
    // ignore
  }
  // 2) Reference sheet
  var ref = ss.getSheetByName('task_options') || ss.getSheetByName('Reference') || ss.getSheetByName('Ref');
  if (ref) {
    var last = ref.getLastRow();
    if (last > 0) {
      var vals = ref.getRange(1,1,last,1).getValues().map(function(r){return r[0];}).filter(Boolean);
      if (vals.length) return vals;
    }
  }
  // 3) Fallback starter set
  return ['Lesson planning','Student support','Assessment','Data entry','Meeting'];
}

/**
 * Parses HH:MM AM/PM to a time-only serial fraction (no timezone issues).
 * @param {string} timeStr - e.g., "7:50 AM" or "12:05 pm".
 * @returns {{minutes:number,fraction:number}}
 */
function parseUserTimeToSerial_(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') throw new Error('Time is required.');
  var s = timeStr.trim().toUpperCase();
  var m = s.match(/^(0?[1-9]|1[0-2]):([0-5][0-9])\s?(AM|PM)$/);
  if (!m) throw new Error('Time must be in HH:MM AM/PM');
  var h = parseInt(m[1],10);
  var min = parseInt(m[2],10);
  var mer = m[3];
  if (mer === 'PM' && h !== 12) h += 12;
  if (mer === 'AM' && h === 12) h = 0;
  var totalMin = h * 60 + min;
  return { minutes: totalMin, fraction: totalMin / (24 * 60) };
}

/**
 * Determines current weekday name in ALL CAPS (MONDAY..FRIDAY).
 * Uses the spreadsheet locale/timezone.
 * @returns {string}
 */
function getTodayWeekday_() {
  var tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone() || Session.getScriptTimeZone() || 'America/New_York';
  var nowTz = new Date(Utilities.formatDate(new Date(), tz, 'yyyy/MM/dd HH:mm:ss'));
  var names = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
  return names[nowTz.getDay()];
}

/**
 * Attempts to find the day block in the active sheet by scanning for the header label
 * (e.g., MONDAY) and the following header row with column labels.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {string} dayName - e.g., "MONDAY"
 * @returns {{startRow:number,endRow:number, startCol:number, cols:{startTime:number,endTime:number,whatDidYouWorkOn:number}}}
 */
function findDayBlock_(sheet, dayName) {
  var rng = sheet.getDataRange();
  var data = rng.getValues();

  // 1) Locate the day label cell
  var dayRow = -1, dayCol = -1;
  for (var r = 0; r < data.length; r++) {
    for (var c = 0; c < data[r].length; c++) {
      if (String(data[r][c]).trim().toUpperCase() === dayName) {
        dayRow = r + 1; // 1-based
        dayCol = c + 1;
        break;
      }
    }
    if (dayRow !== -1) break;
  }
  if (dayRow === -1) throw new Error('Could not locate day section: ' + dayName);

  // 2) Find the header row below the label (single block layout; scan whole row in-memory)
  var headerRow = -1;
  var startColAbs = -1, endColAbs = -1, workColAbs = -1;
  var searchDepth = 6;
  for (var rr = dayRow; rr <= Math.min(dayRow + searchDepth, data.length); rr++) {
    var rowU = data[rr-1].map(function(v){ return String(v).toUpperCase(); });
    var idxStart = rowU.indexOf('START TIME');
    var idxEnd = rowU.indexOf('END TIME');
    var idxWork = rowU.indexOf('WHAT DID YOU WORK ON?');
    if (idxWork === -1) idxWork = rowU.indexOf('WHAT DID YOU WORK ON');
    if (idxStart !== -1 && idxEnd !== -1 && idxWork !== -1) {
      headerRow = rr;
      startColAbs = idxStart + 1;
      endColAbs = idxEnd + 1;
      workColAbs = idxWork + 1;
      break;
    }
  }
  if (headerRow === -1) throw new Error('Could not find header row for ' + dayName);

  // 3) Determine end row by searching for a row containing "Total Daily Hrs"
  var endRow = headerRow + 1;
  for (var rr2 = headerRow + 1; rr2 <= data.length; rr2++) {
    var hasTotal = data[rr2-1].some(function(v){ return String(v).toUpperCase().indexOf('TOTAL DAILY HRS') !== -1; });
    if (hasTotal) { endRow = rr2 - 1; break; }
    endRow = rr2;
  }

  return {
    startRow: headerRow + 1,
    endRow: endRow,
    startCol: startColAbs,
    cols: { startTime: startColAbs, endTime: endColAbs, whatDidYouWorkOn: workColAbs }
  };
}

/**
 * Writes a new entry into the correct day block and sorts by start time.
 * @param {TaskEntry} entry
 * @returns {{ok:boolean, day:string, placedRow?:number, message:string}}
 */
function addTask(entry) {
  if (!entry) return {ok:false, day:'', message:'No data submitted.'};

  // Validate + parse
  var start = parseUserTimeToSerial_(entry.startTime);
  var end = parseUserTimeToSerial_(entry.endTime);
  if (end.minutes <= start.minutes) throw new Error('End Time must be after Start Time.');
  var taskText = (entry.taskText && entry.taskText.trim()) || (entry.taskOption || '').trim();
  if (!taskText) throw new Error('Please provide a task description.');

  var sheet = SpreadsheetApp.getActiveSheet();
  var day = getTodayWeekday_();
  if (['SATURDAY','SUNDAY'].indexOf(day) !== -1) {
    // default to MONDAY if weekend
    day = 'MONDAY';
  }

  var block = findDayBlock_(sheet, day);

  // Identify first empty row within the block by checking the Start Time column
  var col = block.cols.startTime;
  var colVals = sheet.getRange(block.startRow, col, block.endRow - block.startRow + 1, 1).getValues();
  var targetRow = -1;
  for (var i = 0; i < colVals.length; i++) {
    if (!colVals[i][0]) { targetRow = block.startRow + i; break; }
  }
  if (targetRow === -1) {
    // append at last row if full
    targetRow = block.endRow;
  }

  // Batch write key fields. Using time-only serial fractions to avoid timezone shifts.
  // We only know three column indexes; write them individually.
  // If not contiguous, write separately.
  sheet.getRange(targetRow, block.cols.startTime).setValue(start.fraction);
  sheet.getRange(targetRow, block.cols.endTime).setValue(end.fraction);
  sheet.getRange(targetRow, block.cols.whatDidYouWorkOn).setValue(taskText);

  // Sort the block by Start Time ascending (blanks last). Use exact day width.
  var sortWidth = Math.max(block.cols.startTime, block.cols.endTime, block.cols.whatDidYouWorkOn) - block.cols.startTime + 1;
  sheet.getRange(block.startRow, block.cols.startTime, block.endRow - block.startRow + 1, sortWidth)
    .sort([{column: block.cols.startTime, ascending: true}]);

  return {ok:true, day:day, placedRow:targetRow, message:'Task added to ' + day + '.'};
}

/**
 * Includes HTML partials.
 * @param {string} filename
 * @returns {GoogleAppsScript.HTML.HtmlOutput}
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
