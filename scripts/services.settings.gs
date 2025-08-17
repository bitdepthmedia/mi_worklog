
/**
 * SettingsService
 * - Reads configuration from the Settings sheet.
 * - Provides typed getters with caching and robust error handling.
 */
var SettingsService = (function () {
  var CACHE_KEY_ACTIVITIES = 'settings_activities_cache';
  var CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

  /**
   * List activity definitions for entry UI and validation.
   * Reads "activities_json" from the Settings sheet, caches results, and
   * falls back to a safe default if anything goes wrong.
   *
   * Returned object format:
   * [
   *   { code: string, label: string, name: string, allowable: boolean, ...extras }
   * ]
   *
   * - Includes both label and name (aliases) for UI compatibility.
   * - Never throws; logs errors via AuditService and returns a fallback.
   *
   * @returns {Array<{code:string,label:string,name:string,allowable:boolean}>}
   */
  function listActivities() {
    // Attempt cache
    var cached = cacheGet_(CACHE_KEY_ACTIVITIES, CACHE_TTL_MS);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      return cached;
    }

    var activities = null;

    try {
      // Read raw JSON string from Settings sheet
      var raw = readSettingsValue_('activities_json');
      if (raw && typeof raw === 'string' && raw.trim()) {
        activities = parseActivitiesJson_(raw);
      }
    } catch (e) {
      safeAudit_('settings.activities.error', {
        stage: 'read',
        message: e && e.message ? e.message : String(e)
      });
    }

    // Validate and fallback
    if (!activities || !Array.isArray(activities) || activities.length === 0) {
      activities = getDefaultActivities_();
      safeAudit_('settings.activities.fallback', {
        reason: 'missing_or_invalid',
        usedDefault: true
      });
    }

    // Cache and return
    cacheSet_(CACHE_KEY_ACTIVITIES, activities);
    return activities;
  }

  /**
   * Parse activities JSON string and normalize each item.
   * @param {string} json
   * @returns {Array<object>}
   */
  function parseActivitiesJson_(json) {
    var data;
    try {
      data = JSON.parse(json);
    } catch (e) {
      safeAudit_('settings.activities.error', {
        stage: 'parse',
        message: e && e.message ? e.message : String(e)
      });
      return [];
    }
    if (!Array.isArray(data)) {
      safeAudit_('settings.activities.error', {
        stage: 'parse',
        message: 'activities_json is not an array'
      });
      return [];
    }
    var out = [];
    for (var i = 0; i < data.length; i++) {
      var a = normalizeActivity_(data[i]);
      if (a) out.push(a);
    }
    return out;
  }

  /**
   * Ensure activity object has required fields and sane defaults.
   * - Ensures code (string, trimmed)
   * - Derives label/name
   * - Defaults allowable = true if unspecified
   *
   * @param {object} raw
   * @returns {object|null}
   */
  function normalizeActivity_(raw) {
    if (!raw || typeof raw !== 'object') return null;

    var code = (raw.code != null ? String(raw.code) : '').trim();
    if (!code) return null;

    var label =
      raw.label != null
        ? String(raw.label).trim()
        : raw.name != null
        ? String(raw.name).trim()
        : code;

    var allowable =
      typeof raw.allowable === 'boolean' ? raw.allowable : true;

    var result = {
      code: code,
      label: label,
      name: label, // alias for compatibility
      allowable: allowable
    };

    // Pass through common optional fields if present
    var extraFields = ['pars_category', 'min_increment', 'description', 'category'];
    for (var i = 0; i < extraFields.length; i++) {
      var k = extraFields[i];
      if (Object.prototype.hasOwnProperty.call(raw, k) && raw[k] !== undefined) {
        result[k] = raw[k];
      }
    }

    return result;
  }

  /**
   * Generic reader for Settings sheet key/value rows.
   * Looks up the provided key in column A and returns the column B value.
   *
   * @param {string} key
   * @returns {string|null}
   * @throws {Error} if the Settings sheet is missing or ss unavailable
   */
  function readSettingsValue_(key) {
    var ss = SpreadsheetApp.getActive();
    if (!ss) throw new Error('No active spreadsheet');

    var sheetName = (typeof CONFIG !== 'undefined' && CONFIG.SHEETS && CONFIG.SHEETS.SETTINGS) ? CONFIG.SHEETS.SETTINGS : null;
    if (!sheetName) throw new Error('CONFIG.SHEETS.SETTINGS is not defined');

    var sh = ss.getSheetByName(sheetName);
    if (!sh) throw new Error('Settings sheet not found: ' + sheetName);

    var lastRow = sh.getLastRow();
    if (lastRow < 2) return null;

    // Columns: A=key, B=value
    var vals = sh.getRange(2, 1, lastRow - 1, 2).getValues();
    for (var i = 0; i < vals.length; i++) {
      var k = (vals[i][0] != null ? String(vals[i][0]) : '').trim();
      if (!k) continue;
      if (k === key) {
        var v = vals[i][1];
        return v != null ? String(v) : '';
      }
    }
    return null;
  }

  /**
   * Read a JSON object from Settings by key.
   * Best-effort parsing with error logging.
   * @param {string} key
   * @returns {*|null}
   */
  function readSettingsJsonKey_(key) {
    try {
      var raw = readSettingsValue_(key);
      if (!raw || !String(raw).trim()) return null;
      return JSON.parse(String(raw));
    } catch (e) {
      safeAudit_('settings.json.read.error', {
        key: key,
        message: e && e.message ? e.message : String(e)
      });
      return null;
    }
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
      safeAudit_('settings.cache.error', {
        op: 'get',
        key: key,
        message: e && e.message ? e.message : String(e)
      });
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
      props.setProperty(
        key,
        JSON.stringify({ ts: Date.now(), data: data })
      );
    } catch (e) {
      safeAudit_('settings.cache.error', {
        op: 'set',
        key: key,
        message: e && e.message ? e.message : String(e)
      });
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

  /**
   * Reasonable default activities if Settings read fails.
   * @returns {Array<object>}
   */
  function getDefaultActivities_() {
    return [
      { code: 'INSTR', label: 'Instruction', name: 'Instruction', allowable: true },
      { code: 'PREP',  label: 'Preparation', name: 'Preparation', allowable: true },
      { code: 'OTHER', label: 'Other',       name: 'Other',       allowable: false }
    ];
    }

  // Additional typed getters and config accessors

  var CACHE_KEY_BUILDINGS = 'settings_buildings_cache';
  var CACHE_KEY_FUNDING_SOURCES = 'settings_funding_sources_cache';
  var CACHE_KEY_STAFF_FIELDS = 'settings_staff_fields_cache';

  /**
   * Get building options from Settings (key: "buildings_json").
   * Accepts either an array of strings or array of objects with {id,label}.
   * Caches the normalized array of strings for 10 minutes.
   * @returns {Array<string>}
   */
  function getBuildings() {
    var cached = cacheGet_(CACHE_KEY_BUILDINGS, CACHE_TTL_MS);
    if (cached && Array.isArray(cached)) return cached;

    var raw = readSettingsJsonKey_('buildings_json');
    var list = [];
    if (Array.isArray(raw)) {
      for (var i = 0; i < raw.length; i++) {
        var item = raw[i];
        if (item == null) continue;
        if (typeof item === 'string') {
          var s = String(item).trim();
          if (s) list.push(s);
        } else if (typeof item === 'object') {
          var id = item.id != null ? String(item.id).trim() : '';
          var label = item.label != null ? String(item.label).trim() : '';
          var val = (id || label || '').trim();
          if (val) list.push(val);
        }
      }
    }
    // no strict fallback for buildings; empty list is acceptable
    cacheSet_(CACHE_KEY_BUILDINGS, list);
    return list;
  }

  /**
   * Get funding source options from Settings (key: "funding_sources_json").
   * Returns array of strings; falls back to common options if missing.
   * Caches for 10 minutes.
   * @returns {Array<string>}
   */
  function getFundingSources() {
    var cached = cacheGet_(CACHE_KEY_FUNDING_SOURCES, CACHE_TTL_MS);
    if (cached && Array.isArray(cached) && cached.length) return cached;

    var raw = readSettingsJsonKey_('funding_sources_json');
    var list = [];
    if (Array.isArray(raw)) {
      for (var i = 0; i < raw.length; i++) {
        var v = raw[i];
        if (v == null) continue;
        var s = String(v).trim();
        if (s) list.push(s);
      }
    }
    if (list.length === 0) {
      list = [
        'Title I',
        'Title III',
        '31A',
        'Section 41',
        'GSRP',
        'General Funds'
      ];
    }
    cacheSet_(CACHE_KEY_FUNDING_SOURCES, list);
    return list;
  }

  /**
   * Get staff configuration fields model (key: "staff_config_fields_json").
   * Expected shape:
   *   { required: ["name","email","building_id","funding_source"], optional: [] }
   * Returns a normalized object with arrays; provides sensible defaults.
   * Caches for 10 minutes.
   * @returns {{required:string[], optional:string[]}}
   */
  function getStaffConfigFields() {
    var cached = cacheGet_(CACHE_KEY_STAFF_FIELDS, CACHE_TTL_MS);
    if (cached && cached.required && cached.optional) return cached;

    var raw = readSettingsJsonKey_('staff_config_fields_json');
    var model = { required: ['name','email','building_id','funding_source'], optional: [] };
    try {
      if (raw && typeof raw === 'object') {
        var req = Array.isArray(raw.required) ? raw.required.filter(Boolean) : model.required;
        var opt = Array.isArray(raw.optional) ? raw.optional.filter(Boolean) : [];
        model = { required: req, optional: opt };
      }
    } catch (e) {
      // ignore and use default
    }
    cacheSet_(CACHE_KEY_STAFF_FIELDS, model);
    return model;
  }

  // public API
  return {
    listActivities: listActivities,
    getBuildings: getBuildings,
    getFundingSources: getFundingSources,
    getStaffConfigFields: getStaffConfigFields
  };
})();
