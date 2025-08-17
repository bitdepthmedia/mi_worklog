/**
 * PARSService
 * - Classifies worklog entries into PARS categories.
 * - Closes a week by aggregating entries and generating an immutable report sheet.
 *
 * Sheet dependencies:
 * - CONFIG.SHEETS.WORKLOG for source data
 * - CONFIG.SHEETS.REPORTS_PREFIX for naming report tabs
 * - SettingsService.listActivities() for classification rules (pars_category, allowable, etc.)
 *
 * Report format:
 * Sheet name: "Reports - Week {YYYY-MM-DD}"
 * Rows:
 *   A1:B5  => Metadata (key/value rows)
 *   A6     => Blank spacer
 *   A7:D7  => Headers: Staff | PARS Category | Total Minutes | Entry Count
 *   A8..   => Aggregated rows
 */
var PARSService = (function () {
  /**
   * Classify a worklog entry using Settings activities.
   * Uses activity code to look up PARS category and allowability, and determines billable/inGrant.
   *
   * @param {{activity:string, minutes:number}} entry
   * @returns {{
   *   category: string,
   *   subcategory: string|null,
   *   billable: boolean,
   *   inGrant: boolean,
   *   minutes: number,
   *   activity_code: string,
   *   activity_label: string
   * }}
   *
   * Example:
   * const c = PARSService.classify({ activity: 'INSTR', minutes: 30 });
   * // -> { category: 'IN_GRANT', subcategory: 'INSTR', billable: true, inGrant: true, ... }
   */
  function classify(entry) {
    var activities = [];
    try {
      activities = SettingsService.listActivities();
    } catch (e) {
      // Fallback to empty; will result in UNCLASSIFIED
      activities = [];
      safeAudit_('pars.classify.error', { stage: 'settings', message: e && e.message ? e.message : String(e) });
    }

    var code = entry && entry.activity != null ? String(entry.activity).trim() : '';
    var minutes = entry && typeof entry.minutes === 'number' ? entry.minutes : 0;

    var map = buildActivityMap_(activities);
    var act = map[code] || null;

    var parsCategoryRaw = act && act.pars_category != null ? String(act.pars_category).trim() : '';
    var category = normalizeCategory_(parsCategoryRaw, code);

    // Determine inGrant and billable based on category + allowable flag
    var allowable = act && typeof act.allowable === 'boolean' ? act.allowable : false;
    var inGrant = category === 'IN_GRANT';
    var billable = inGrant && allowable === true;

    return {
      category: category,
      subcategory: code || null,
      billable: billable,
      inGrant: inGrant,
      minutes: minutes,
      activity_code: code,
      activity_label: act && act.label ? String(act.label) : (code || 'Unclassified')
    };
  }

  /**
   * Close a week: aggregate Worklog entries for the 7-day period ending on weekEnding,
   * generate a protected report sheet, and write an audit trail.
   *
   * @param {string} weekEnding - ISO date string "YYYY-MM-DD". Treated as inclusive end of week.
   * @returns {{ ok: boolean, message?: string, sheetName?: string }}
   */
  function closeWeek(weekEnding) {
    var lock = LockService.getDocumentLock();
    lock.waitLock(20000);

    var result = { ok: false };
    var ss = SpreadsheetApp.getActive();
    var S = CONFIG.SHEETS;
    var reportsPrefix = (S && S.REPORTS_PREFIX) ? S.REPORTS_PREFIX : null;
    if (!reportsPrefix) { throw new Error('CONFIG.SHEETS.REPORTS_PREFIX is not defined'); }

    var startIso, endIso, startDate, endDate, sheetName;
    try {
      // Validate and compute date range (7 days: start = end - 6)
      endDate = parseIsoDateStrict_(weekEnding);
      endIso = toIsoDate_(endDate);
      startDate = addDays_(endDate, -6);
      startIso = toIsoDate_(startDate);

      // Log start of process with computed range
      AuditService.log('pars.closeWeek.start', {
        requestedWeekEnding: weekEnding,
        startIso: startIso,
        endIso: endIso
      });

      // Prevent duplicate closures
      sheetName = reportsPrefix + ' - Week ' + endIso;
      if (ss.getSheetByName(sheetName)) {
        var msgDup = 'Week already closed for ' + endIso + ' (' + sheetName + ' exists).';
        AuditService.log('pars.closeWeek.already_exists', { sheetName: sheetName });
        result.ok = false;
        result.message = msgDup;
        return result;
      }

      // Read Worklog rows in batch
      var src = ss.getSheetByName(S.WORKLOG);
      if (!src) {
        throw new Error('Worklog sheet not found: ' + S.WORKLOG);
      }

      var lastRow = src.getLastRow();
      var lastCol = src.getLastColumn();
      if (lastRow < 2) {
        // No data rows, still produce an empty report
      }

      // Columns as written by WorklogService.saveEntry:
      // [0]=id, [1]=user_email, [2]=date, [3]=minutes, [4]=student_id, [5]=activity, [6]=notes, [7]=created_at
      var values = lastRow >= 2 ? src.getRange(2, 1, lastRow - 1, Math.max(8, lastCol)).getValues() : [];

      var includedIds = [];
      var aggregation = Object.create(null); // key: staff|category
      var staffSet = Object.create(null);
      var entryCount = 0;

      for (var i = 0; i < values.length; i++) {
        var row = values[i];
        var id = safeString_(row[0]);
        var staff = safeString_(row[1]).toLowerCase();
        var dateCell = row[2];
        var minutes = toNumber_(row[3]);
        var activityCode = safeString_(row[5]);

        if (!id || !staff || !minutes || minutes <= 0) continue;

        var d = coerceToDate_(dateCell);
        if (!d) continue;

        var iso = toIsoDate_(d);
        if (!inRangeIso_(iso, startIso, endIso)) continue;

        // Classify
        var classification = classify({ activity: activityCode, minutes: minutes });

        var category = classification.category || 'UNCLASSIFIED';
        var key = staff + '|' + category;

        if (!aggregation[key]) {
          aggregation[key] = { staff: staff, category: category, minutes: 0, count: 0 };
        }
        aggregation[key].minutes += minutes;
        aggregation[key].count += 1;

        includedIds.push(id);
        staffSet[staff] = true;
        entryCount++;
      }

      // Prepare report sheet
      var sh = ss.insertSheet(sheetName);
      try {
        sh.setTabColor('#607d8b'); // blue-grey
      } catch (eColor) { /* ignore */ }

      // Metadata block
      var meta = [
        ['Week Start', startIso],
        ['Week Ending', endIso],
        ['Generated At', new Date().toISOString()],
        ['Staff Count', Object.keys(staffSet).length],
        ['Entries Included', includedIds.length]
      ];
      sh.getRange(1, 1, meta.length, 2).setValues(meta);
      sh.getRange(1, 1, meta.length, 2).setFontWeight('bold').setBackground('#f8f9fa');
      sh.getRange(1, 1, meta.length, 1).setFontColor('#202124');

      // Spacer
      sh.getRange(6, 1).setValue('');

      // Table headers
      var headers = [['Staff', 'PARS Category', 'Total Minutes', 'Entry Count']];
      sh.getRange(7, 1, 1, 4).setValues(headers).setFontWeight('bold').setBackground('#e8eaed');
      sh.setFrozenRows(7);

      // Build data rows, sorted by staff then category
      var rows = Object.keys(aggregation)
        .map(function (k) { return aggregation[k]; })
        .sort(function (a, b) {
          if (a.staff < b.staff) return -1;
          if (a.staff > b.staff) return 1;
          if (a.category < b.category) return -1;
          if (a.category > b.category) return 1;
          return 0;
        })
        .map(function (r) { return [r.staff, r.category, r.minutes, r.count]; });

      if (rows.length > 0) {
        sh.getRange(8, 1, rows.length, 4).setValues(rows);
        sh.getRange(8, 3, Math.max(1, rows.length), 1).setNumberFormat('0'); // minutes
        sh.getRange(8, 4, Math.max(1, rows.length), 1).setNumberFormat('0'); // count
      }

      // Column widths
      try {
        sh.setColumnWidths(1, 1, 220);
        sh.setColumnWidths(2, 1, 160);
        sh.setColumnWidths(3, 2, 120);
        sh.hideGridlines();
      } catch (eWidths) { /* ignore */ }

      // Protection: lock the whole sheet (immutable)
      try {
        var protection = sh.protect();
        protection.setDescription('Immutable weekly report ' + endIso);
        protection.setWarningOnly(false);
        // Ensure no editors by default (owner retains access)
        protection.removeEditors(protection.getEditors());
        // No unprotected ranges: entire sheet is read-only
        protection.setUnprotectedRanges([]);
      } catch (eProt) {
        AuditService.log('pars.closeWeek.protection.error', { message: eProt && eProt.message ? eProt.message : String(eProt) });
      }

      // Audit details (record included IDs)
      AuditService.log('pars.closeWeek.finish', {
        weekStart: startIso,
        weekEnding: endIso,
        sheetName: sheetName,
        staffCount: Object.keys(staffSet).length,
        groupCount: Object.keys(aggregation).length,
        entryCount: entryCount,
        includedIds: includedIds
      });

      result.ok = true;
      result.sheetName = sheetName;
      return result;
    } catch (e) {
      var msg = e && e.message ? e.message : String(e);
      AuditService.log('pars.closeWeek.error', {
        weekEnding: weekEnding,
        message: msg,
        stack: e && e.stack ? e.stack : null
      });
      result.ok = false;
      result.message = msg;
      return result;
    } finally {
      try { lock.releaseLock(); } catch (eRel) { /* ignore */ }
    }
  }

  // ===== Helpers (private) =====

  /**
   * Build a map from activity code to activity object.
   * @param {Array<{code:string,label?:string,allowable?:boolean,pars_category?:string}>} list
   * @returns {Object<string,object>}
   */
  function buildActivityMap_(list) {
    var m = Object.create(null);
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      var code = a && a.code != null ? String(a.code).trim() : '';
      if (!code) continue;
      m[code] = a;
    }
    return m;
  }

  /**
   * Normalize Settings pars_category into a canonical value.
   * Supported in-grant tokens: 'IN', 'IN_GRANT', 'IN-GRANT', 'INGRANT'
   * Supported out-of-grant tokens: 'OUT', 'OUT_OF_GRANT', 'OUT-OF-GRANT', 'OOG', 'NON_GRANT'
   * Default: 'UNCLASSIFIED'
   * @param {string} raw
   * @param {string} activityCode
   * @returns {string} One of: 'IN_GRANT' | 'OUT_OF_GRANT' | 'UNCLASSIFIED'
   */
  function normalizeCategory_(raw, activityCode) {
    var v = (raw || '').toUpperCase().replace(/\s+/g, '');
    if (v === 'IN' || v === 'IN_GRANT' || v === 'IN-GRANT' || v === 'INGRANT') return 'IN_GRANT';
    if (v === 'OUT' || v === 'OUT_OF_GRANT' || v === 'OUT-OF-GRANT' || v === 'OOG' || v === 'NONGRANT' || v === 'NON_GRANT') return 'OUT_OF_GRANT';
    // Heuristic: special activity codes
    var ac = (activityCode || '').toUpperCase();
    if (ac === 'NON_GRANT' || ac === 'OTHER') return 'OUT_OF_GRANT';
    return 'UNCLASSIFIED';
  }

  /**
   * Parse ISO date strictly (YYYY-MM-DD) and return Date at local midnight.
   * @param {string} iso
   * @returns {Date}
   * @throws {Error} on invalid format or NaN date
   */
  function parseIsoDateStrict_(iso) {
    var s = String(iso || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      throw new Error('Invalid weekEnding date format; expected YYYY-MM-DD');
    }
    var parts = s.split('-');
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (isNaN(d.getTime())) throw new Error('Invalid weekEnding date value');
    // normalize to date-only (local)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  /**
   * Convert Date to ISO YYYY-MM-DD (local).
   * @param {Date} d
   * @returns {string}
   */
  function toIsoDate_(d) {
    var y = d.getFullYear();
    var m = (d.getMonth() + 1);
    var day = d.getDate();
    return y + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
  }

  /**
   * Return a new Date offset by given days.
   * @param {Date} d
   * @param {number} days
   * @returns {Date}
   */
  function addDays_(d, days) {
    var nd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    nd.setDate(nd.getDate() + days);
    return nd;
  }

  /**
   * Try to coerce a cell value into a Date (date or string).
   * Returns null if not parseable.
   * @param {*} v
   * @returns {Date|null}
   */
  function coerceToDate_(v) {
    if (v instanceof Date) {
      return new Date(v.getFullYear(), v.getMonth(), v.getDate());
    }
    var s = safeString_(v);
    if (!s) return null;
    // Try ISO first
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      try { return parseIsoDateStrict_(s); } catch (e) { return null; }
    }
    // Fallback
    var d = new Date(s);
    if (isNaN(d.getTime())) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  /**
   * Inclusive ISO date range test.
   * @param {string} iso - YYYY-MM-DD
   * @param {string} startIso - YYYY-MM-DD
   * @param {string} endIso - YYYY-MM-DD
   * @returns {boolean}
   */
  function inRangeIso_(iso, startIso, endIso) {
    return iso >= startIso && iso <= endIso;
  }

  function safeString_(v) {
    return v == null ? '' : String(v).trim();
  }

  function toNumber_(v) {
    var n = Number(v);
    return isNaN(n) ? 0 : n;
  }

  function safeAudit_(action, payload) {
    try {
      AuditService.log(action, payload);
    } catch (e) { /* swallow */ }
  }

  return { classify: classify, closeWeek: closeWeek };
})();
