/**
 * Shows the Start Here sidebar for initial user details.
 * @returns {void}
 */
function showStartHereSidebar() {
  var output = HtmlService.createHtmlOutputFromFile('StartHereSidebar')
    .setTitle('Start Here: User Details');
  SpreadsheetApp.getUi().showSidebar(output);
}

/**
 * Returns initialization payload for the Start Here sidebar.
 * Loads buildings (settings!F3:F), funding (settings!G3:G), share emails (settings!H3:H),
 * and previously saved values from the Start Here sheet.
 * @returns {{buildings:string[], funding:string[], shareEmails:string[], saved:{name:string,email:string,buildings:string[], funding:Array<{name:string,percent:number}>}}}
 */
function getStartHereInit() {
  var ss = SpreadsheetApp.getActive();
  var settings = ss.getSheetByName(SHEETS.settings);
  var startHere = ss.getSheetByName(SHEETS.startHere);

  var buildings = [];
  var funding = [];
  var shareEmails = [];
  if (settings) {
    var last = settings.getLastRow();
    if (last >= 3) {
      // F3:F → buildings
      buildings = settings.getRange(3, 6, last - 2, 1).getValues()
        .map(function(r){ return String(r[0] || '').trim(); })
        .filter(function(v){ return !!v; });
      // G3:G → funding
      funding = settings.getRange(3, 7, last - 2, 1).getValues()
        .map(function(r){ return String(r[0] || '').trim(); })
        .filter(function(v){ return !!v; });
      // H3:H → share emails
      shareEmails = settings.getRange(3, 8, last - 2, 1).getValues()
        .map(function(r){ return String(r[0] || '').trim(); })
        .filter(function(v){ return !!v; });
    }
  }

  var saved = { name: '', email: '', buildings: [], funding: [] };
  if (startHere) {
    try {
      var name = String(startHere.getRange('B4').getValue() || '').trim();
      var email = String(startHere.getRange('B5').getValue() || '').trim();
      var bldgCsv = String(startHere.getRange('B6').getValue() || '').trim();
      var bldgs = bldgCsv ? bldgCsv.split(',').map(function(s){return s.trim();}).filter(Boolean) : [];
      // Funding entries A10:A18 and percents B10:B18
      var names = startHere.getRange('A10:A18').getValues().map(function(r){ return String(r[0] || '').trim(); });
      var pcts = startHere.getRange('B10:B18').getValues().map(function(r){ var n=Number(r[0]); return isFinite(n)? n : 0; });
      var pairs = [];
      for (var i = 0; i < Math.max(names.length, pcts.length); i++) {
        if (names[i]) pairs.push({ name: names[i], percent: pcts[i] || 0 });
      }
      saved = { name: name, email: email, buildings: bldgs, funding: pairs };
    } catch (e) { /* ignore */ }
  }

  return { buildings: buildings, funding: funding, shareEmails: shareEmails, saved: saved };
}

/**
 * Appends a funding source value into settings!G3:G at the first empty row.
 * Returns the inserted value.
 * @param {string} newFunding - New funding source name
 * @returns {{ok:boolean, value:string}}
 */
function addFundingSource(newFunding) {
  var val = String(newFunding || '').trim();
  if (!val) throw new Error('Please enter a funding source.');
  var ss = SpreadsheetApp.getActive();
  var settings = ss.getSheetByName(SHEETS.settings);
  if (!settings) throw new Error('settings sheet not found.');
  var last = settings.getLastRow();
  var row = Math.max(3, last + 1);
  if (last >= 3) {
    var vals = settings.getRange(3, 7, last - 2, 1).getValues();
    for (var i = 0; i < vals.length; i++) {
      var curr = String(vals[i][0] || '').trim();
      if (!curr) { row = 3 + i; break; }
    }
  }
  settings.getRange(row, 7).setValue(val);
  return { ok: true, value: val };
}

/**
 * Saves Start Here details into the sheet.
 * Writes Name B4, Email B5, Buildings B6 (comma-separated), Funding A10:A18, Percents B10:B18.
 * Rejects when funding percentages do not total 100.
 * Shows initial-insert flag if B4 was blank prior to save.
 * @param {{name:string,email:string,buildings:string[], funding:Array<{name:string,percent:(number|string)}>} } payload
 * @returns {{ok:boolean,message:string,initial:boolean,shareEmails:string[]}}
 */
function saveStartHereDetails(payload) {
  if (!payload) throw new Error('No data provided.');
  var name = String(payload.name || '').trim();
  var email = String(payload.email || '').trim();
  var buildings = Array.isArray(payload.buildings) ? payload.buildings.map(function(s){return String(s||'').trim();}).filter(Boolean) : [];
  var funding = Array.isArray(payload.funding) ? payload.funding : [];

  if (!name) throw new Error('Full Name is required.');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('A valid District Email is required.');
  if (!buildings.length) throw new Error('Please select at least one Reporting Building.');
  if (!funding.length) throw new Error('Please select at least one Funding source.');
  if (funding.length > 9) throw new Error('Please select at most 9 funding sources.');

  // Validate percentages sum to 100
  var sum = 0;
  var cleaned = [];
  for (var i = 0; i < funding.length; i++) {
    var f = funding[i];
    var nm = String(f.name || '').trim();
    if (!nm) continue;
    var pct = Number(f.percent);
    if (!isFinite(pct) || pct < 0) throw new Error('Percentages must be numeric and non-negative.');
    cleaned.push({ name: nm, percent: pct });
    sum += pct;
  }
  // Allow tiny float error tolerance
  if (Math.abs(sum - 100) > 0.01) throw new Error('Funding percentages must total 100%.');

  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(SHEETS.startHere) || ss.getActiveSheet();
  if (!sheet) throw new Error('Start Here sheet not found.');

  var wasBlank = !String(sheet.getRange('B4').getValue() || '').trim();

  // Write basics
  sheet.getRange('B4').setValue(name);
  sheet.getRange('B5').setValue(email);
  sheet.getRange('B6').setValue(buildings.join(', '));

  // Clear previous funding block then write new
  sheet.getRange('A10:B18').clearContent();
  var rows = cleaned.length;
  if (rows) {
    var names = cleaned.map(function(x){ return [x.name]; });
    var pcts = cleaned.map(function(x){ return [x.percent / 100]; });
    sheet.getRange(10, 1, rows, 1).setValues(names);
    sheet.getRange(10, 2, rows, 1).setValues(pcts);
  }

  // Fetch share emails for potential reminder
  var init = getStartHereInit();
  return { ok: true, message: 'Details saved.', initial: !!wasBlank, shareEmails: init.shareEmails || [] };
}
