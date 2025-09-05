/**
 * Parses a user time string to a time-only serial fraction (no timezone issues).
 * Accepts either 24-hour "HH:MM" (from <input type="time">) or "HH:MM AM/PM".
 * @param {string} timeStr - e.g., "07:50", "19:10", or "7:50 AM".
 * @returns {{minutes:number,fraction:number}}
 */
function parseUserTimeToSerial_(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') throw new Error('Time is required.');
  var raw = timeStr.trim();
  // Try 24-hour first: HH:MM
  var m24 = raw.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (m24) {
    var h24 = parseInt(m24[1], 10);
    var min24 = parseInt(m24[2], 10);
    var total24 = h24 * 60 + min24;
    return { minutes: total24, fraction: total24 / (24 * 60) };
  }
  // Fallback to AM/PM format
  var s = raw.toUpperCase();
  var m = s.match(/^(0?[1-9]|1[0-2]):([0-5][0-9])\s?(AM|PM)$/);
  if (m) {
    var h = parseInt(m[1],10);
    var min = parseInt(m[2],10);
    var mer = m[3];
    if (mer === 'PM' && h !== 12) h += 12;
    if (mer === 'AM' && h === 12) h = 0;
    var totalMin = h * 60 + min;
    return { minutes: totalMin, fraction: totalMin / (24 * 60) };
  }
  throw new Error('Time must be HH:MM (24h) or HH:MM AM/PM');
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
 * Computes the duration in minutes from start to end (0..1439 minutes).
 * Assumes same-day times; throws if end <= start to avoid negative/zero durations.
 * @param {number} startMinutes - Minutes from midnight for start time (0..1439)
 * @param {number} endMinutes - Minutes from midnight for end time (0..1439)
 * @returns {number} Duration in minutes (integer)
 */
function durationMinutes_(startMinutes, endMinutes) {
  if (typeof startMinutes !== 'number' || typeof endMinutes !== 'number') {
    throw new Error('Start/End minutes must be numbers.');
  }
  if (endMinutes <= startMinutes) {
    throw new Error('End Time must be after Start Time.');
  }
  return Math.round(endMinutes - startMinutes);
}

/**
 * Parses an ISO date string (YYYY-MM-DD) to an uppercase weekday name.
 * If invalid, throws. If weekend, returns 'SATURDAY' or 'SUNDAY'.
 * The weekday for a given calendar date is timezone-agnostic.
 * @param {string} dateStr - ISO date string from `<input type="date">`.
 * @returns {string} Uppercase weekday name
 */
function parseDateOverrideToWeekday_(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') throw new Error('Invalid date override.');
  var m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) throw new Error('Date must be YYYY-MM-DD.');
  var y = parseInt(m[1], 10), mo = parseInt(m[2], 10), d = parseInt(m[3], 10);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) throw new Error('Invalid calendar date.');
  var dt = new Date(y, mo - 1, d); // Calendar date; weekday independent of TZ
  var names = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
  return names[dt.getDay()];
}

/**
 * Returns today's calendar date at local spreadsheet timezone (midnight).
 * @returns {Date}
 */
function getTodayDateInTz_() {
  var tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone() || Session.getScriptTimeZone() || 'America/New_York';
  var y = Utilities.formatDate(new Date(), tz, 'yyyy');
  var m = Utilities.formatDate(new Date(), tz, 'MM');
  var d = Utilities.formatDate(new Date(), tz, 'dd');
  var dt = new Date(parseInt(y,10), parseInt(m,10)-1, parseInt(d,10));
  dt.setHours(0,0,0,0);
  return dt;
}
