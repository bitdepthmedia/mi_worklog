/**
 * Returns task options for the dropdown.
 * Attempts (in order): NamedRange "TaskOptions", Sheet "settings" A3:A (defaults),
 * then legacy sheets: "task_options"/"Reference"/"Ref" Col A, else fallback list.
 * @returns {string[]}
 */
function getTaskOptions() {
  var ss = SpreadsheetApp.getActive();
  // 1) Named range
  try {
    var nr = ss.getRangeByName(NAMED_RANGES.taskOptions);
    if (nr) {
      return (nr.getValues() || []).map(function(r){return r[0];}).filter(Boolean);
    }
  } catch (e) {
    // ignore named range lookup errors
  }
  // 2) settings!A3:A (default options live here)
  var settings = ss.getSheetByName(SHEETS.settings);
  if (settings) {
    var lastRow = settings.getLastRow();
    if (lastRow >= 3) {
      var vals2 = settings.getRange(3, 1, lastRow - 2, 1).getValues()
        .map(function(r){ return r[0]; })
        .filter(function(v){ return !!v; });
      if (vals2.length) return vals2;
    }
  }
  // 3) Legacy reference sheets (for backward compatibility)
  var ref = ss.getSheetByName('task_options') || ss.getSheetByName('Reference') || ss.getSheetByName('Ref');
  if (ref) {
    var last = ref.getLastRow();
    if (last > 0) {
      var vals = ref.getRange(1,1,last,1).getValues().map(function(r){return r[0];}).filter(Boolean);
      if (vals.length) return vals;
    }
  }
  // 4) Fallback starter set
  return ['Lesson planning','Student support','Assessment','Data entry','Meeting'];
}

/**
 * Returns available Grant Sources from settings!B3:B.
 * If the settings sheet or range is missing, returns an empty array.
 * @returns {string[]}
 */
function getGrantSources() {
  var ss = SpreadsheetApp.getActive();
  var settings = ss.getSheetByName(SHEETS.settings);
  if (!settings) return [];
  var lastRow = settings.getLastRow();
  if (lastRow < 3) return [];
  var vals = settings.getRange(3, 2, lastRow - 2, 1).getValues() // Col B starting at row 3
    .map(function(r){ return String(r[0] || '').trim(); })
    .filter(function(v){ return !!v; });
  return vals;
}

