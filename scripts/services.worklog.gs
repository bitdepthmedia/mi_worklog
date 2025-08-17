var WorklogService = (function(){
  const S = CONFIG.SHEETS;
  function sheet(name){ return SpreadsheetApp.getActive().getSheetByName(name); }
  function _append(row){ sheet(S.WORKLOG).appendRow(row); }

  function saveEntry(entry, userEmail){
    ValidationService.validateEntry(entry);
    const now = new Date();
    const row = [
      Utilities.getUuid(), userEmail, entry.date, entry.minutes, entry.studentId || '', entry.activity, entry.notes, now
    ];
    const lock = LockService.getDocumentLock();
    lock.waitLock(20000);
    try{
      _append(row);
      AuditService.log('worklog.save', {entry});
    } finally {
      lock.releaseLock();
    }
    return true;
  }

  function closeWeekPrompt(){
    const ui = SpreadsheetApp.getUi();
    const resp = ui.prompt('Close Week', 'Enter week ending date (YYYY-MM-DD):', ui.ButtonSet.OK_CANCEL);
    if (resp.getSelectedButton() !== ui.Button.OK) return;
    return PARSService.closeWeek(resp.getResponseText());
  }

  return { saveEntry: saveEntry, closeWeekPrompt: closeWeekPrompt };
})();
