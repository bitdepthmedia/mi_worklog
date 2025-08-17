
/**
 * CaseloadService
 * - Resolves active staff context from Session
 * - Reads Caseload + Students sheets
 * - Applies effective-dated filtering (start_date <= today <= end_date; empty end = indefinite)
 * - Joins student details
 * - Caches per staff+date for performance
 *
 * Returned student object shape (compat + enriched):
 *   {
 *     id: string,                 // alias of studentId for legacy UI bindings
 *     studentId: string,          // canonical ID
 *     name: string,
 *     building: string,           // alias of building_id for UI
 *     building_id: string,
 *     grade: string|number,
 *     flags: string,
 *     active: boolean,            // from Students.active
 *     caseloadStartDate: string,  // YYYY-MM-DD or ''
 *     caseloadEndDate: string,    // YYYY-MM-DD or ''
 *     services: string|undefined  // from Caseload.services
 *   }
 */
var CaseloadService = (function () {
  var CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
  var S = (typeof CONFIG !== 'undefined' && CONFIG.SHEETS) ? CONFIG.SHEETS : {};

  /**
   * List students on the active user's caseload effective today.
   * - Never throws. Logs errors via AuditService and returns [] on failure.
   * - Uses document properties cache with per-staff+date key to avoid cross-user leakage.
   *
   * @returns {Array<Object>}
   */
  function listStudents() {
    try {
      // Resolve active user email
      var email = '';
      try {
        email = Session.getActiveUser().getEmail() || '';
      } catch (eSession) {
        // continue with empty
      }

      // Staff lookup
      var staff = findStaffByEmail_(email);
      if (!email || !staff) {
        safeAudit_('caseload.staff.not_found', { email: email || '(empty)' });
        return [];
      }
      if (isFalseyActive_(staff.active)) {
        safeAudit_('caseload.staff.inactive', { staff_id: staff.staff_id || '', email: email });
        // Conservative: treat inactive staff as no caseload
        return [];
      }

      // Cache key (scoped to staff + today's date)
      var today = new Date();
      var dateKey = toYMD_(today);
      var cacheKey = 'caseload_students_' + String(staff.staff_id || email) + '_' + dateKey;
      var cached = cacheGet_(cacheKey, CACHE_TTL_MS);
      if (cached && Array.isArray(cached)) return cached;

      // Read tables
      var caseloadRows = readTable_(S.CASELOAD);
      var studentRows = readTable_(S.STUDENTS);
      if (!Array.isArray(caseloadRows) || !Array.isArray(studentRows)) {
        safeAudit_('caseload.read.error', { reason: 'table_read_failed' });
        cacheSet_(cacheKey, []);
        return [];
      }

      // Build student index
      var stuIdx = {};
      for (var i = 0; i < studentRows.length; i++) {
        var s = studentRows[i] || {};
        var sid = (s.student_id != null ? String(s.student_id) : '').trim();
        if (sid) stuIdx[sid] = s;
      }

      // Filter caseload by staff + effective date; if multiple effective rows per student,
      // choose the one with the latest start_date (most specific current assignment).
      var nowT = today.getTime();
      var pickedByStudent = {}; // student_id -> chosen caseload row
      for (var j = 0; j < caseloadRows.length; j++) {
        var r = caseloadRows[j] || {};
        if (String(r.staff_id || '') !== String(staff.staff_id || '')) continue;

        var start = coerceDate_(r.start_date);
        var end = coerceDate_(r.end_date);
        var startOk = !start || start.getTime() <= nowT;
        var endOk = !end || nowT <= end.getTime();
        if (!startOk || !endOk) continue;

        var stuId = (r.student_id != null ? String(r.student_id) : '').trim();
        if (!stuId) continue;

        var prev = pickedByStudent[stuId];
        if (!prev) {
          pickedByStudent[stuId] = r;
        } else {
          // prefer the row with the later start_date
          var prevStart = coerceDate_(prev.start_date);
          var thisStartT = start ? start.getTime() : -Infinity;
          var prevStartT = prevStart ? prevStart.getTime() : -Infinity;
          if (thisStartT > prevStartT) pickedByStudent[stuId] = r;
        }
      }

      // Join with student info and shape result
      var out = [];
      for (var studentId in pickedByStudent) {
        if (!Object.prototype.hasOwnProperty.call(pickedByStudent, studentId)) continue;
        var cRow = pickedByStudent[studentId];
        var stu = stuIdx[studentId];

        if (!stu) {
          // Student record missing; log and skip to avoid broken dropdowns
          safeAudit_('caseload.student_missing', { student_id: studentId, staff_id: staff.staff_id });
          continue;
        }

        var startDate = coerceDate_(cRow.start_date);
        var endDate = coerceDate_(cRow.end_date);

        var obj = {
          id: studentId, // legacy alias
          studentId: studentId,
          name: stu.name != null ? String(stu.name) : '',
          building: stu.building_id != null ? String(stu.building_id) : '',
          building_id: stu.building_id != null ? String(stu.building_id) : '',
          grade: stu.grade != null ? stu.grade : '',
          flags: stu.flags != null ? String(stu.flags) : '',
          active: isTruthyActive_(stu.active),
          caseloadStartDate: startDate ? toYMD_(startDate) : '',
          caseloadEndDate: endDate ? toYMD_(endDate) : '',
          services: cRow.services != null ? String(cRow.services) : undefined
        };
        out.push(obj);
      }

      // Sort by student name for stable UX
      out.sort(function (a, b) {
        var an = (a.name || '').toString().toLowerCase();
        var bn = (b.name || '').toString().toLowerCase();
        if (an < bn) return -1;
        if (an > bn) return 1;
        return 0;
      });

      cacheSet_(cacheKey, out);
      return out;
    } catch (e) {
      safeAudit_('caseload.listStudents.error', {
        message: (e && e.message) || String(e)
      });
      return [];
    }
  }
  // Confidence: 4/5 — relies on sheet headers as bootstrapped and Apps Script Session.

  /* ===================== helpers (module-private) ===================== */

  /**
   * Find staff by email (Staff sheet headers: staff_id,name,email,building_id,role,active[,funding_source])
   * @param {string} email
   * @returns {{staff_id:string,name:string,email:string,building_id:string,role:string,active:any,funding_source?:string}|null}
   */
  function findStaffByEmail_(email) {
    if (!email) return null;
    var rows = readTable_(S.STAFF);
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i] || {};
      if (String(r.email || '').toLowerCase() === String(email).toLowerCase()) {
        if (typeof r.funding_source === 'undefined' || r.funding_source === null) r.funding_source = '';
        return r;
      }
    }
    return null;
  }

  /**
   * Generic sheet reader returning array of row objects keyed by header.
   * Skips completely blank rows.
   * @param {string} sheetName
   * @returns {Object[]}
   */
  function readTable_(sheetName) {
    try {
      var ss = SpreadsheetApp.getActive();
      if (!ss) return [];
      var sh = ss.getSheetByName(sheetName);
      if (!sh) return [];
      var values = sh.getDataRange().getValues();
      if (!values || values.length < 2) return [];
      var header = values[0];
      var out = [];
      for (var r = 1; r < values.length; r++) {
        var row = values[r];
        var allBlank = true;
        for (var c = 0; c < header.length; c++) {
          if (row[c] !== '' && row[c] !== null) { allBlank = false; break; }
        }
        if (allBlank) continue;
        var obj = {};
        for (var c2 = 0; c2 < header.length; c2++) {
          obj[String(header[c2])] = row[c2];
        }
        out.push(obj);
      }
      return out;
    } catch (e) {
      safeAudit_('caseload.read.exception', { sheet: sheetName, message: (e && e.message) || String(e) });
      return [];
    }
  }

  /**
   * Convert input to Date or null. Accepts Date or date-like string.
   * @param {*} d
   * @returns {Date|null}
   */
  function coerceDate_(d) {
    if (!d && d !== 0) return null;
    if (Object.prototype.toString.call(d) === '[object Date]') {
      return isNaN(d.getTime()) ? null : d;
    }
    var t = new Date(d);
    return isNaN(t.getTime()) ? null : t;
  }

  /**
   * YYYY-MM-DD from Date
   * @param {Date} d
   * @returns {string}
   */
  function toYMD_(d) {
    var y = d.getFullYear();
    var m = (d.getMonth() + 1);
    var day = d.getDate();
    return y + '-' + pad2_(m) + '-' + pad2_(day);
  }

  function pad2_(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function isTruthyActive_(val) {
    var s = String(val).toLowerCase();
    return val === true || val === 1 || s === 'true' || s === 'yes' || s === 'y' || s === '1';
  }

  function isFalseyActive_(val) {
    return !isTruthyActive_(val);
  }

  /**
   * Cache getter with TTL using DocumentProperties (per-spreadsheet).
   * @param {string} key
   * @param {number} ttlMs
   * @returns {*|null}
   */
  function cacheGet_(key, ttlMs) {
    try {
      var props = PropertiesService.getDocumentProperties();
      var raw = props.getProperty(key);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || typeof obj.ts !== 'number') return null;
      var age = Date.now() - obj.ts;
      if (age > ttlMs) return null;
      return obj.data;
    } catch (e) {
      safeAudit_('caseload.cache.error', { op: 'get', key: key, message: (e && e.message) || String(e) });
      return null;
    }
  }

  /**
   * Cache setter using DocumentProperties (per-spreadsheet).
   * @param {string} key
   * @param {*} data
   */
  function cacheSet_(key, data) {
    try {
      var props = PropertiesService.getDocumentProperties();
      props.setProperty(key, JSON.stringify({ ts: Date.now(), data: data }));
    } catch (e) {
      safeAudit_('caseload.cache.error', { op: 'set', key: key, message: (e && e.message) || String(e) });
    }
  }

  /**
   * Log via AuditService.log if available; otherwise Logger.log.
   * @param {string} action
   * @param {object} payload
   */
  function safeAudit_(action, payload) {
    try {
      if (typeof AuditService !== 'undefined' && AuditService && typeof AuditService.log === 'function') {
        AuditService.log(action, payload);
      } else {
        Logger.log(action + ' ' + (function () {
          try { return JSON.stringify(payload); } catch (e) { return String(payload); }
        })());
      }
    } catch (e) {
      // swallow
    }
  }

  return { listStudents: listStudents };
})();
