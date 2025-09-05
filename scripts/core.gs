/**
 * @typedef {{ startTime:string, endTime:string, taskOption?:string, taskText?:string, dateOverride?: (string|null), grantSource?: (string|null), studentNames?: string[], studentGroup?: (string|null) }} TaskEntry
 */

/**
 * Attempts to find the day block in the active sheet by scanning for the header label
 * (e.g., MONDAY) and the following header row with column labels.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {string} dayName - e.g., "MONDAY"
 * @returns {{startRow:number,endRow:number,startCol:number,cols:{startTime:number,endTime:number,grantSource:number,students:number,whatDidYouWorkOn:number}}}
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
  var searchDepth = 6;
  for (var rr = dayRow; rr <= Math.min(dayRow + searchDepth, data.length); rr++) {
    var rowU = data[rr-1].map(function(v){ return String(v).toUpperCase(); });
    var idxStart = rowU.indexOf('START TIME');
    var idxEnd = rowU.indexOf('END TIME');
    var idxWork = rowU.indexOf('WHAT DID YOU WORK ON?');
    if (idxWork === -1) idxWork = rowU.indexOf('WHAT DID YOU WORK ON');
    if (idxStart !== -1 && idxEnd !== -1 && idxWork !== -1) {
      headerRow = rr;
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
    startCol: COLUMNS.startTime,
    cols: {
      startTime: COLUMNS.startTime,
      endTime: COLUMNS.endTime,
      grantSource: COLUMNS.grantSource,
      students: COLUMNS.students,
      whatDidYouWorkOn: COLUMNS.work
    }
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

  // Resolve target week sheet from date override or today (creates if missing)
  var entryDate;
  if (entry.dateOverride && String(entry.dateOverride).trim()) {
    // Reuse weekly manager's parser for reliability
    entryDate = parseYyyyMmDd_(String(entry.dateOverride).trim());
  } else {
    entryDate = getTodayDateInTz_();
  }
  // Ensure named range exists and week sheet is available
  ensureNamedRange_();
  var weekIdx = getWeekIndexForDate_(entryDate);
  var sheet = getOrCreateWeekSheet_(weekIdx);
  var day;
  if (entry.dateOverride && String(entry.dateOverride).trim()) {
    // Use user override; if weekend, map to MONDAY to fit grid
    var chosen = parseDateOverrideToWeekday_(String(entry.dateOverride).trim());
    day = (chosen === 'SATURDAY' || chosen === 'SUNDAY') ? 'MONDAY' : chosen;
  } else {
    day = getTodayWeekday_();
    if (day === 'SATURDAY' || day === 'SUNDAY') day = 'MONDAY';
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
  sheet.getRange(targetRow, block.cols.startTime).setValue(start.fraction);
  sheet.getRange(targetRow, block.cols.endTime).setValue(end.fraction);
  sheet.getRange(targetRow, block.cols.whatDidYouWorkOn).setValue(taskText);

  // Grant Source: only write when more than one source exists
  try {
    var grantSources = getGrantSources();
    if (grantSources && grantSources.length > 1) {
      var gsVal = (entry.grantSource || '').trim();
      // If client didn't provide, default to first available (defensive)
      if (!gsVal && grantSources.length) gsVal = grantSources[0];
      sheet.getRange(targetRow, block.cols.grantSource).setValue(gsVal);
    }
  } catch (e) {
    // Do not fail task insertion due to grant source write; log instead
    console && console.warn && console.warn('Grant source write skipped:', e);
  }

  // Resolve and write Student IDs (Column F) based on optional selections
  var warnings = [];
  try {
    var namesSel = Array.isArray(entry.studentNames) ? entry.studentNames.filter(function(s){ return !!String(s||'').trim(); }) : [];
    var groupSel = (entry.studentGroup || '').trim();
    if (namesSel.length && groupSel) {
      throw new Error('Please choose either specific student names or a group, not both.');
    }
    var idsCsv = '';
    if (namesSel.length || groupSel) {
      var ref = getActiveStudentsAndGroups();
      var nameToId = {};
      (ref.students || []).forEach(function(s){ nameToId[String(s.name)] = String(s.id); });
      if (namesSel.length) {
        var ids = [];
        var seen = {};
        namesSel.forEach(function(n){
          var key = String(n);
          var id = nameToId[key];
          if (!id) { warnings.push('Name not found or inactive: ' + key); return; }
          if (seen[id]) return; seen[id] = true; ids.push(id);
        });
        idsCsv = ids.join(',');
      } else if (groupSel) {
        var idsFromGroup = (ref.groupToStudentIds && ref.groupToStudentIds[groupSel]) || [];
        if (!idsFromGroup.length) {
          warnings.push('Selected group has no active students: ' + groupSel);
          idsCsv = '';
        } else {
          // Already sorted by name asc and deduped during build
          idsCsv = idsFromGroup.join(',');
        }
      }
    }
    var studentCell = sheet.getRange(targetRow, block.cols.students);
    // Force text format so comma-separated IDs are not coerced into a large number
    try { studentCell.setNumberFormat("@"); } catch (fmtErr) { /* ignore format errors */ }
    studentCell.setValue(idsCsv);
  } catch (e2) {
    // Surface validation errors (dual selection) as throw; soft issues as warnings
    if (String(e2 && e2.message || e2).indexOf('either specific student') !== -1) {
      throw e2;
    }
    console && console.warn && console.warn('Student ID resolution warning:', e2);
  }

  // Sort the block by Start Time ascending (blanks last). Use exact day width.
  var sortWidth = Math.max(block.cols.startTime, block.cols.endTime, block.cols.whatDidYouWorkOn) - block.cols.startTime + 1;
  sheet.getRange(block.startRow, block.cols.startTime, block.endRow - block.startRow + 1, sortWidth)
    .sort([{column: block.cols.startTime, ascending: true}]);

  // Optionally focus the target week for user clarity
  try { SpreadsheetApp.getActive().setActiveSheet(sheet); } catch (ignore) {}
  var msg = 'Task added to ' + day + ' in ' + sheet.getName() + '.';
  if (warnings.length) msg += ' ' + warnings.join(' ');
  return {ok:true, day:day, placedRow:targetRow, message: msg };
}
