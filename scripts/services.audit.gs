
/**
 * Append-only audit logger service.
 * Schema: [Timestamp ISO, User Email, Action, Payload JSON, Checksum HEX]
 */
var AuditService = (function() {
  /**
   * Log an action with an optional payload to the Audit sheet.
   * Never throws; failures are logged to Logger and swallowed.
   *
   * @param {string} action - Short action code or event name.
   * @param {*} payload - Any serializable object; will be JSON.stringify'd.
   * @example
   * AuditService.log('worklog.save', { id: 'abc123', minutes: 30 });
   */
  function log(action, payload) {
    try {
      var ss = SpreadsheetApp.getActive();
      var sheetName = (typeof CONFIG !== 'undefined' && CONFIG.SHEETS && CONFIG.SHEETS.AUDIT) ? CONFIG.SHEETS.AUDIT : null;
      if (!sheetName) {
        Logger.log('[AuditService.log] CONFIG.SHEETS.AUDIT missing; skipping sheet write');
        return;
      }

      // Ensure sheet exists; create lazily if missing
      var sh = ss.getSheetByName(sheetName);
      if (!sh) {
        sh = ss.insertSheet(sheetName);
        // Seed headers
        sh.getRange(1, 1, 1, 5).setValues([['Timestamp', 'User', 'Action', 'Payload', 'Checksum']]);
        // Basic formatting to match bootstrap patterns
        sh.getRange(1,1,1,5).setFontWeight('bold').setBackground('#f1f3f4');
        sh.setFrozenRows(1);
        // Protect header row pattern (best-effort)
        try {
          var p = sh.protect();
          p.removeEditors(p.getEditors());
          p.setDescription('Protected: structure & headers');
          var dataRange = sh.getRange(2,1, sh.getMaxRows()-1, sh.getMaxColumns());
          var unprot = sh.protect();
          unprot.setUnprotectedRanges([dataRange]);
          unprot.setDescription('Unprotected: data entry area');
          p.remove();
        } catch (protectionErr) {
          // Non-fatal; continue
        }
      }

      var user = '';
      try {
        user = Session.getActiveUser().getEmail() || '';
      } catch (eUser) {
        user = '';
      }

      var ts = new Date().toISOString();

      var jsonPayload;
      try {
        jsonPayload = JSON.stringify(payload);
      } catch (eJson) {
        // Fallback for circulars/non-serializable
        jsonPayload = String(payload);
      }

      var checksumBytes = Utilities.computeDigest(
        Utilities.DigestAlgorithm.SHA_256,
        jsonPayload,
        Utilities.Charset.UTF_8
      );
      var checksumHex = bytesToHex_(checksumBytes);

      sh.appendRow([ts, user, action, jsonPayload, checksumHex]);
    } catch (e) {
      // Never break caller
      Logger.log('[AuditService.log] failed: ' + (e && e.message ? e.message : e));
    }
  }

  /**
   * Convert byte[] to lowercase hex string.
   * @param {number[]} bytes
   * @returns {string}
   */
  function bytesToHex_(bytes) {
    var hex = '';
    for (var i = 0; i < bytes.length; i++) {
      var v = (bytes[i] + 256) % 256; // handle signed bytes
      var h = v.toString(16);
      if (h.length < 2) h = '0' + h;
      hex += h;
    }
    return hex;
  }

  return { log: log };
})();
