
var SettingsService = (function(){
  function listActivities(){
    // TODO: read Settings sheet
    return [{code:'INSTR', label:'Instruction'}, {code:'PREP', label:'Preparation'}, {code:'OTHER', label:'Other'}];
  }
  return { listActivities: listActivities };
})();
