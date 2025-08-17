
/**
 * ValidationService
 * Comprehensive server-side validation for Worklog entries.
 * Returns a result object and preserves legacy behavior by throwing on invalid.
 *
 * Validation result format:
 *   { isValid: boolean, errors: string[] }
 */
var ValidationService = (function () {
  var S = (typeof CONFIG !== 'undefined' && CONFIG.SHEETS) ? CONFIG.SHEETS : {};
  /**
   * Validate a worklog entry against basic rules, allowability, overlaps, and permissions.
   *
   * Input entry shape (expected):
   *   {
   *     date: string|Date,            // required; ISO (YYYY-MM-DD) preferred but Date accepted
   *     minutes: number,              // required; > 0, <= 1440
   *     activity: string,             // required; code from Settings activities
   *     studentId?: string,           // optional; must exist if provided
   *     notes?: string,               // optional
   *     // Optional time fields to enable overlap detection (any one):
   *     // startMinutes?: number      // 0-1439 minutes since midnight
   *     // start?: string             // "HH:mm"
   *     // start_time?: string        // "HH:mm" or minutes string
   *   }
   *
   * Behavior:
   *  - Returns { isValid, errors }.
   *  - If invalid, logs via AuditService and throws Error with concatenated messages
   *    to maintain backward compatibility with existing callers.
   *
   * @param {Object} e
   * @returns {{isValid: boolean, errors: string[]}}
   */
  function validateEntry(e) {
    var errors = [];
    var ctx = {};
    try {
      // Resolve active user context
      var userEmail = '';
      try {
        userEmail = Session.getActiveUser().getEmail() || '';
      } catch (ue) {
        // keep empty; will be flagged below
      }
      ctx.userEmail = userEmail;

      // 1) Basic validation
      var dateObj = coerceDate_(e && e.date);
      if (!dateObj) errors.push('Date required and must be a valid date');
      var isoDate = dateObj ? toYMD_(dateObj) : '';
      ctx.date = isoDate;

      if (!e || typeof e.minutes !== 'number') {
        errors.push('Minutes must be a number > 0');
      } else {
        if (e.minutes <= 0) errors.push('Minutes must be > 0');
        if (e.minutes > 1440) errors.push('Minutes cannot exceed 1440 (24 hours)');
      }

      if (!e || !e.activity) errors.push('Activity code is required');

      // 2) Settings-driven activity existence + allowability by role
      var activities = [];
      try {
        activities = (SettingsService && typeof SettingsService.listActivities === 'function')
          ? (SettingsService.listActivities() || [])
          : [];
      } catch (se) {
        // If SettingsService fails, we still continue with sheet reads below
      }

      var activityIndex = buildActivityIndex_(activities); // map by code
      if (e && e.activity && !activityIndex[e.activity]) {
        errors.push('Unknown activity code: ' + e.activity);
      }

      // Load Staff context (permissions + role)
      var staff = userEmail ? findStaffByEmail_(userEmail) : null;
      if (!userEmail) errors.push('Unable to determine active user email (Session.getActiveUser())');
      if (!staff) errors.push('No Staff record found for user ' + userEmail);
      if (staff && isFalseyActive_(staff.active)) errors.push('Staff record is not active for user ' + userEmail);

      // Role/activity allowability mapping
      if (staff && e && e.activity) {
        var role = (staff.role || '').toString().trim();
        var allowedSet = getAllowedActivitiesForRole_(role, activities);
        if (allowedSet && allowedSet.size && !allowedSet.has(e.activity)) {
          errors.push('Activity ' + e.activity + ' is not allowed for role ' + role);
        }
        // Respect global "allowable" boolean when present
        if (activityIndex[e.activity] && activityIndex[e.activity].allowable === false) {
          errors.push('Activity ' + e.activity + ' is marked not allowable in Settings');
        }
      }

      // 3) Permissions and data integrity (Students, Caseload, Building)
      if (e && e.studentId) {
        var student = findStudentById_(e.studentId);
        if (!student) {
          errors.push('Student not found: ' + e.studentId);
        } else {
          if (isFalseyActive_(student.active)) {
            errors.push('Student ' + e.studentId + ' is not active');
          }
          // Building alignment (best-effort)
          if (staff && staff.building_id && student.building_id && staff.building_id !== student.building_id) {
            errors.push('Staff building (' + staff.building_id + ') does not match student building (' + student.building_id + ')');
          }
        }

        // Caseload effective-dated authorization
        if (staff && staff.staff_id && dateObj) {
          if (!isOnCaseload_(staff.staff_id, e.studentId, dateObj)) {
            errors.push('Student ' + e.studentId + ' is not on your caseload for ' + isoDate);
          }
        }
      }

      // Optional: Global roles allowed to log work (from Settings key "worklog_allowed_roles_json")
      if (staff) {
        var allowedRoles = getAllowedRolesForWorklog_(); // array or null
        if (allowedRoles && allowedRoles.length > 0) {
          if (allowedRoles.indexOf((staff.role || '').toString().trim()) === -1) {
            errors.push('Role ' + staff.role + ' is not permitted to create worklog entries');
          }
        }
      }

      // 4) Date reasonableness (future limit)
      if (dateObj) {
        var MAX_FUTURE_DAYS = 7;
        var now = new Date();
        var futureLimit = new Date(now.getFullYear(), now.getMonth(), now.getDate() + MAX_FUTURE_DAYS);
        if (dateObj > futureLimit) {
          errors.push('Date may not be more than ' + MAX_FUTURE_DAYS + ' days in the future');
        }
      }

      // 5) Overlap detection (requires start time info in payload or saved notes)
      var overlapMsg = checkOverlap_(userEmail, isoDate, e);
      if (overlapMsg) errors.push(overlapMsg);

      // Finalize
      if (errors.length > 0) {
        safeAuditLog_('validation.fail', { entry: scrubEntry_(e), errors: errors, ctx: ctx });
        throw new Error('Validation failed: ' + errors.join('; '));
      }

      return { isValid: true, errors: [] };
    } catch (err) {
      if (errors.length === 0) {
        // Internal error path
        safeAuditLog_('validation.exception', {
          entry: scrubEntry_(e),
          error: (err && (err.stack || err.message)) || String(err)
        });
      }
      // Re-throw to preserve legacy behavior for callers expecting exceptions
      throw err;
    }
  }
  // Confidence: 4/5 — depends on Settings data conventions and optional time fields.

  /* ===================== helpers ===================== */

  /**
   * Build index of activity objects keyed by code.
   * @param {Array<{code:string,label?:string,allowable?:boolean}>} list
   */
  function buildActivityIndex_(list) {
    var idx = {};
    if (list && list.forEach) {
      list.forEach(function (a) {
        if (a && a.code) idx[a.code] = a;
      });
    }
    return idx;
  }

  /**
   * Get allowed activity codes for a role.
   * Priority:
   *  1) Settings row key "activities_role_map_json": { "ROLE":[ "INSTR","PREP" ] }
   *  2) Fallback: any activity with allowable !== false
   * @param {string} role
   * @param {Array} activities
   * @returns {Set<string>}
   */
  function getAllowedActivitiesForRole_(role, activities) {
    var map = readSettingsJsonKey_('activities_role_map_json'); // optional
    if (role && map && typeof map === 'object' && map[role]) {
      return new Set((map[role] || []).filter(Boolean));
    }
    // Fallback to "allowable" boolean from activities list
    var set = new Set();
    if (activities && activities.forEach) {
      activities.forEach(function (a) {
        if (!a) return;
        if (a.allowable !== false && a.code) set.add(a.code);
      });
    }
    return set;
  }

  /**
   * Optional whitelist of roles that may create worklogs.
   * Settings key: "worklog_allowed_roles_json" -> ["TEACHER","PARA"]
   * @returns {string[]|null}
   */
  function getAllowedRolesForWorklog_() {
    var arr = readSettingsJsonKey_('worklog_allowed_roles_json');
    return Array.isArray(arr) ? arr : null;
  }

  /**
   * Coerce an input to a Date, or null.
   * @param {*} d
   * @returns {Date|null}
   */
  function coerceDate_(d) {
    if (!d) return null;
    if (Object.prototype.toString.call(d) === '[object Date]') return isNaN(d.getTime()) ? null : d;
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

  /**
   * Find staff by email from Staff sheet.
   * Headers: staff_id,name,email,building_id,role,active
   * @param {string} email
   * @returns {{staff_id:string,name:string,email:string,building_id:string,role:string,active:any}|null}
   */
  function findStaffByEmail_(email) {
    if (!email) return null;
    var rows = readTable_(S.STAFF);
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if ((r.email || '').toString().toLowerCase() === email.toLowerCase()) return r;
    }
    return null;
  }

  /**
   * Find student by ID from Students sheet.
   * Headers: student_id,name,grade,building_id,flags,active
   * @param {string} id
   * @returns {{student_id:string,name:string,grade:string,building_id:string,flags:string,active:any}|null}
   */
  function findStudentById_(id) {
    if (!id) return null;
    var rows = readTable_(S.STUDENTS);
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if ((r.student_id || '').toString() === id) return r;
    }
    return null;
  }

  /**
   * Check caseload effective-dated authorization.
   * Headers: staff_id,student_id,start_date,end_date,services,notes
   * @param {string} staffId
   * @param {string} studentId
   * @param {Date} onDate
   * @returns {boolean}
   */
  function isOnCaseload_(staffId, studentId, onDate) {
    if (!staffId || !studentId || !onDate) return false;
    var rows = readTable_(S.CASELOAD);
    var t = onDate.getTime();
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if ((r.staff_id || '').toString() !== (staffId || '').toString()) continue;
      if ((r.student_id || '').toString() !== (studentId || '').toString()) continue;
      var start = coerceDate_(r.start_date);
      var end = coerceDate_(r.end_date);
      var startOk = !start || start.getTime() <= t;
      var endOk = !end || t <= end.getTime();
      if (startOk && endOk) return true;
    }
    return false;
  }

  /**
   * Overlap detection among existing entries for the same user+date.
   * Requires a start time in the current entry OR parsable from saved notes ("start=HH:MM" or "startMinutes=###").
   * If insufficient data, returns null (non-blocking).
   *
   * @param {string} userEmail
   * @param {string} isoDate
   * @param {Object} e
   * @returns {string|null} error message or null
   */
  function checkOverlap_(userEmail, isoDate, e) {
    if (!userEmail || !isoDate || !e) return null;

    // Derive start minutes for the incoming entry
    var startMin = deriveStartMinutes_(e);
    if (startMin == null) {
      // Not enough information to enforce overlaps
      safeAuditLog_('validation.warn', { type: 'overlap_skipped_no_start', userEmail: userEmail, date: isoDate, entry: scrubEntry_(e) });
      return null;
    }
    if (typeof e.minutes !== 'number' || e.minutes <= 0) return null;
    var endMin = startMin + e.minutes;

    // Scan existing Worklog rows for same user/date with known start
    var rows = readTable_(S.WORKLOG);
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      // date_iso may be a Date or a string; normalize
      var rDate = coerceDate_(r.date_iso);
      var rIso = rDate ? toYMD_(rDate) : (r.date_iso || '').toString().slice(0, 10);
      if (rIso !== isoDate) continue;
      if ((r.user_email || '').toString().toLowerCase() !== userEmail.toLowerCase()) continue;

      var rStart = deriveStartMinutesFromNotes_(r.notes);
      if (rStart == null) continue; // no start info → cannot compare
      var rMinutes = Number(r.minutes) || 0;
      if (rMinutes <= 0) continue;
      var rEnd = rStart + rMinutes;

      // Overlap if max(start) < min(end)
      var latestStart = Math.max(startMin, rStart);
      var earliestEnd = Math.min(endMin, rEnd);
      if (latestStart < earliestEnd) {
        var id = r.id || '(unknown id)';
        return 'Entry overlaps existing log (id ' + id + ') from ' + minutesToHHMM_(rStart) + ' to ' + minutesToHHMM_(rEnd);
      }
    }
    return null;
  }

  /**
   * Derive start minutes from an entry payload.
   * @param {Object} e
   * @returns {number|null}
   */
  function deriveStartMinutes_(e) {
    if (!e) return null;
    if (typeof e.startMinutes === 'number' && e.startMinutes >= 0 && e.startMinutes < 24 * 60) return e.startMinutes;
    if (typeof e.start === 'string') {
      var m = parseHHMM_(e.start);
      if (m != null) return m;
      var asNum = Number(e.start);
      if (!isNaN(asNum)) return clampMinutes_(asNum);
    }
    if (typeof e.start_time === 'string') {
      var m2 = parseHHMM_(e.start_time);
      if (m2 != null) return m2;
      var asNum2 = Number(e.start_time);
      if (!isNaN(asNum2)) return clampMinutes_(asNum2);
    }
    return null;
  }

  /**
   * Attempt to parse start minutes from a notes field (supports "start=HH:MM" or "startMinutes=###").
   * @param {string} notes
   * @returns {number|null}
   */
  function deriveStartMinutesFromNotes_(notes) {
    if (!notes) return null;
    var s = String(notes);

    // startMinutes=###
    var m1 = /start\s*minutes\s*=\s*(\d{1,4})/i.exec(s);
    if (m1 && m1[1]) {
      var n = Number(m1[1]);
      if (!isNaN(n)) return clampMinutes_(n);
    }

    // start=HH:MM
    var m2 = /start\s*=\s*(\d{1,2}):(\d{2})/i.exec(s);
    if (m2 && m2[1] && m2[2]) {
      var hh = Number(m2[1]), mm = Number(m2[2]);
      if (!isNaN(hh) && !isNaN(mm)) return clampMinutes_(hh * 60 + mm);
    }

    return null;
  }

  function clampMinutes_(n) {
    if (n < 0) return 0;
    if (n > 1439) return 1439;
    return Math.floor(n);
    }

  function parseHHMM_(s) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(s).trim());
    if (!m) return null;
    var hh = Number(m[1]), mm = Number(m[2]);
    if (isNaN(hh) || isNaN(mm)) return null;
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
    return hh * 60 + mm;
  }

  function minutesToHHMM_(m) {
    var hh = Math.floor(m / 60);
    var mm = m % 60;
    return pad2_(hh) + ':' + pad2_(mm);
  }

  /**
   * Generic sheet reader returning array of row objects keyed by header.
   * Skips completely blank rows.
   * @param {string} sheetName
   * @returns {Object[]}
   */
  function readTable_(sheetName) {
    var ss = SpreadsheetApp.getActive();
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
  }

  /**
   * Read a JSON value from Settings sheet with key/value schema.
   * Returns parsed object or null if missing/invalid.
   * @param {string} key
   * @returns {*|null}
   */
  function readSettingsJsonKey_(key) {
    try {
      var ss = SpreadsheetApp.getActive();
      var sh = ss.getSheetByName(S.SETTINGS);
      if (!sh) return null;
      var lastRow = sh.getLastRow();
      if (lastRow < 2) return null;
      var rng = sh.getRange(1, 1, lastRow, Math.min(sh.getLastColumn(), 3));
      var values = rng.getValues(); // expect header row then rows of [key,value,notes]
      for (var i = 1; i < values.length; i++) {
        var row = values[i];
        if (!row || !row[0]) continue;
        if (String(row[0]).trim() === key) {
          var raw = row[1];
          if (raw == null || raw === '') return null;
          try {
            return JSON.parse(String(raw));
          } catch (je) {
            return null;
          }
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  function isFalseyActive_(val) {
    if (val === true || val === 1 || String(val).toLowerCase() === 'true') return false;
    return true;
  }

  function scrubEntry_(e) {
    if (!e) return e;
    var copy = {};
    for (var k in e) {
      if (!Object.prototype.hasOwnProperty.call(e, k)) continue;
      // Avoid logging overly large fields verbatim
      if (k === 'notes' && e[k] && String(e[k]).length > 500) {
        copy[k] = String(e[k]).slice(0, 500) + '…';
      } else {
        copy[k] = e[k];
      }
    }
    return copy;
  }

  function safeAuditLog_(action, payload) {
    try {
      if (typeof AuditService !== 'undefined' && AuditService && typeof AuditService.log === 'function') {
        AuditService.log(action, payload);
      }
    } catch (e) {
      // swallow
    }
  }

  return { validateEntry: validateEntry };
})();
