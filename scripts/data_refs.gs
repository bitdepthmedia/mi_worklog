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

/**
 * Returns active students and groups with a cached mapping for sidebar population.
 * Reads Student Caseload B:C:D:G, filters where Exit Date (G) is blank.
 * Normalizes whitespace and deduplicates students by ID (latest row wins).
 * Also builds group → student IDs mapping, deduped and sorted by Student Name.
 * Uses CacheService for ~10 minutes to avoid repeated reads.
 * @returns {{students:Array<{name:string,id:string,group:string}>, groups:string[], groupToStudentIds:Object<string,string[]>}}
 */
function getActiveStudentsAndGroups() {
  var cache = CacheService.getScriptCache();
  var key = cacheKeyActiveStudents_();
  try {
    var hit = cache.get(key);
    if (hit) {
      Logger.log('getActiveStudentsAndGroups: cache hit');
      return JSON.parse(hit);
    }
  } catch (e) {
    // ignore cache errors
  }

  Logger.log('getActiveStudentsAndGroups: cache miss → reading sheet');
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(SHEETS.studentCaseload) || ss.getSheetByName('Student Caseload');
  if (!sheet) return { students: [], groups: [], groupToStudentIds: {} };

  var header = findStudentHeaderRow_(sheet);
  var dataStart = header + 1;
  var last = sheet.getLastRow();
  if (last < dataStart) return { students: [], groups: [], groupToStudentIds: {} };

  // Read B:C:D:G (name, group, id, exitDate)
  var height = last - dataStart + 1;
  var rng = sheet.getRange(dataStart, 2, height, 6).getValues();
  // rng cols: B(name), C(group), D(id), E(service), F(entrance), G(exitDate) → indexes 0,1,2,5

  var byId = {};
  var groupsSet = {};
  var groupToList = {};
  for (var i = 0; i < rng.length; i++) {
    var name = String(rng[i][0] || '').trim();
    var group = String(rng[i][1] || '').trim();
    var id = String(rng[i][2] || '').trim();
    var exitDate = rng[i][5];
    if (exitDate) continue; // only active
    if (!name || !id) continue;

    // Latest row wins: overwrite existing byId[id]
    byId[id] = { name: name, id: id, group: group };
    if (group) {
      groupsSet[group] = true;
      if (!groupToList[group]) groupToList[group] = [];
      groupToList[group].push({ name: name, id: id });
    }
  }

  // Students array unique by ID, sort by name asc for stable UI
  var students = Object.keys(byId).map(function(k){ return byId[k]; })
    .sort(function(a,b){ return String(a.name).localeCompare(String(b.name)); });

  // Groups unique, sort asc
  var groups = Object.keys(groupsSet).sort(function(a,b){ return String(a).localeCompare(String(b)); });

  // Build group → unique IDs sorted by student name asc
  var groupToStudentIds = {};
  Object.keys(groupToList).forEach(function(g){
    var arr = groupToList[g] || [];
    // sort by name asc, then map to ids and dedup
    arr.sort(function(a,b){ return String(a.name).localeCompare(String(b.name)); });
    var seen = {};
    var ids = [];
    for (var j = 0; j < arr.length; j++) {
      var sid = arr[j].id;
      if (!sid || seen[sid]) continue;
      seen[sid] = true; ids.push(sid);
    }
    groupToStudentIds[g] = ids;
  });

  var out = { students: students, groups: groups, groupToStudentIds: groupToStudentIds };
  try { cache.put(key, JSON.stringify(out), 600); } catch (e2) { /* ignore */ }
  return out;
}

/**
 * Returns the cache key used for active students/groups.
 * @returns {string}
 */
function cacheKeyActiveStudents_() {
  return 'miw_active_students_groups_v1';
}

/**
 * Invalidates the cached Active Students/Groups structure.
 * @returns {void}
 */
function invalidateActiveStudentsAndGroupsCache_() {
  try { CacheService.getScriptCache().remove(cacheKeyActiveStudents_()); } catch (e) { /* ignore */ }
}

/**
 * Simple trigger: flush cache when edits occur in the Student Caseload sheet.
 * @param {GoogleAppsScript.Events.SheetsOnEdit} e
 * @returns {void}
 */
function onEdit(e) {
  try {
    var sh = (e && e.range && e.range.getSheet()) ? e.range.getSheet() : null;
    if (!sh) return;
    var name = sh.getName();
    if (name === SHEETS.studentCaseload || name === 'Student Caseload') {
      invalidateActiveStudentsAndGroupsCache_();
    }
  } catch (err) {
    // ignore
  }
}
