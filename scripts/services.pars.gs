
var PARSService = (function(){
  function classify(entry){
    // TODO: determine in-grant vs out-of-grant based on role/activity/funding
    return { inGrant: entry.activity !== 'NON_GRANT', minutes: entry.minutes };
  }
  function closeWeek(weekEnding){
    // TODO: aggregate Worklog rows between dates, write immutable summary sheet
    AuditService.log('pars.closeWeek', {weekEnding: weekEnding});
    return true;
  }
  return { classify: classify, closeWeek: closeWeek };
})();
