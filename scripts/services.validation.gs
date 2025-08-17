
var ValidationService = (function(){
  function validateEntry(e){
    if(!e.date) throw new Error('Date required');
    if(!e.minutes || e.minutes <= 0) throw new Error('Minutes must be > 0');
    if(!e.activity) throw new Error('Activity required');
    // TODO: enforce allowability, overlaps, staff permissions, building context
  }
  return { validateEntry: validateEntry };
})();
