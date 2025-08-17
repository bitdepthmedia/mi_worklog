
var ReportService = (function(){
  function rebuildAll(){
    // TODO: recompute summaries from Worklog and PARS overrides
    AuditService.log('report.rebuildAll', {});
  }
  return { rebuildAll: rebuildAll };
})();
