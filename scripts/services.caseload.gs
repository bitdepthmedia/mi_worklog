
var CaseloadService = (function(){
  function listStudents(){
    // TODO: read Students + Caseload effective date filtering
    return [{id:'S1', name:'Student A'},{id:'S2', name:'Student B'}];
  }
  return { listStudents: listStudents };
})();
