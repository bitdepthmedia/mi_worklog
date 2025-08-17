function SidebarController_boot(){
  return {
    students: CaseloadService.listStudents(),
    activities: SettingsService.listActivities()
  };
}
function SidebarController_save(payload){
  const user = Session.getActiveUser().getEmail();
  return WorklogService.saveEntry(payload, user);
}

/**
 * Load staff configuration data for Settings tab.
 * Returns available buildings, funding sources, field model, and the current user's staff record (or skeleton).
 * Never throws; on error returns empty lists and a minimal staff object.
 * @returns {{buildings:string[], fundingSources:string[], fields:{required:string[],optional:string[]}, staff:Object}}
 */
function SidebarController_loadStaffConfig(){
  try{
    var S = CONFIG.SHEETS;
    var userEmail = '';
    try { userEmail = Session.getActiveUser().getEmail() || ''; } catch (e) {}

    var buildings = (SettingsService.getBuildings && SettingsService.getBuildings()) || [];
    var fundingSources = (SettingsService.getFundingSources && SettingsService.getFundingSources()) || [];
    var fields = (SettingsService.getStaffConfigFields && SettingsService.getStaffConfigFields()) || {required:['name','email','building_id','funding_source'], optional:[]};

    var staff = findStaffByEmail_(S, userEmail) || {
      staff_id: '',
      name: '',
      email: userEmail || '',
      building_id: '',
      role: '',
      active: true,
      funding_source: ''
    };

    return {
      buildings: buildings,
      fundingSources: fundingSources,
      fields: fields,
      staff: staff
    };
  } catch (e){
    // Swallow and return safe defaults
    return {
      buildings: [],
      fundingSources: ['Title I','Title III','31A','Section 41','GSRP','General Funds'],
      fields: { required:['name','email','building_id','funding_source'], optional:[] },
      staff: { staff_id:'', name:'', email:'', building_id:'', role:'', active:true, funding_source:'' }
    };
  }
}

/**
 * Save staff configuration for the active user.
 * Input payload: { name, email, building_id, funding_source }
 * Updates existing Staff row by email or inserts a new one.
 * Returns the persisted staff object.
 */
function SidebarController_saveStaffConfig(payload){
  var lock = LockService.getDocumentLock();
  lock.waitLock(20000);
  try{
    var S = CONFIG.SHEETS;
    var ss = SpreadsheetApp.getActive();
    var sh = ss.getSheetByName(S.STAFF);
    if (!sh) throw new Error('Staff sheet not found');

    var sessionEmail = '';
    try { sessionEmail = Session.getActiveUser().getEmail() || ''; } catch (e) {}
    if (!sessionEmail) throw new Error('Unable to determine active user');

    var fields = (SettingsService.getStaffConfigFields && SettingsService.getStaffConfigFields()) || { required:['name','email','building_id','funding_source'], optional:[] };
    var required = new Set(fields.required || []);

    var name = (payload && payload.name != null) ? String(payload.name).trim() : '';
    var email = (payload && payload.email != null) ? String(payload.email).trim() : sessionEmail;
    var buildingId = (payload && payload.building_id != null) ? String(payload.building_id).trim() : '';
    var funding = (payload && payload.funding_source != null) ? String(payload.funding_source).trim() : '';

    var errors = [];
    if (required.has('name') && !name) errors.push('Full Name is required');
    if (required.has('email') && !email) errors.push('Email is required');
    if (email && email.toLowerCase() !== sessionEmail.toLowerCase()) {
      errors.push('Email must match your signed-in account');
    }
    if (required.has('building_id') && !buildingId) errors.push('Reporting Building is required');
    if (required.has('funding_source') && !funding) errors.push('Funding Source is required');
    if (errors.length) throw new Error('Validation failed: ' + errors.join('; '));

    // Read table
    var range = sh.getDataRange();
    var values = range.getValues();
    if (!values || values.length < 1) throw new Error('Staff sheet has no header');
    var header = values[0];

    // Build header index
    var h = {};
    for (var c=0;c<header.length;c++){ h[String(header[c])] = c; }
    // Ensure required columns exist; append missing headers if needed
    var colsNeeded = ['staff_id','name','email','building_id','role','active','funding_source'];
    var changedHeader = false;
    colsNeeded.forEach(function(k){
      if (!(k in h)) { header.push(k); h[k] = header.length - 1; changedHeader = true; }
    });
    if (changedHeader){
      sh.getRange(1,1,1,header.length).setValues([header]);
    }

    // Find row by email
    var foundRowIndex = -1; // 1-based row index
    for (var r=1;r<values.length;r++){
      var row = values[r];
      var cellEmail = row[h.email] != null ? String(row[h.email]).toLowerCase() : '';
      if (cellEmail && email.toLowerCase() === cellEmail){
        foundRowIndex = r+1; // convert to sheet row
        break;
      }
    }

    if (foundRowIndex === -1){
      // Append new row
      var staffId = Utilities.getUuid();
      var newRow = new Array(header.length).fill('');
      newRow[h.staff_id] = staffId;
      newRow[h.name] = name;
      newRow[h.email] = email;
      newRow[h.building_id] = buildingId;
      newRow[h.role] = ''; // unchanged / unknown
      newRow[h.active] = true;
      newRow[h.funding_source] = funding;
      sh.appendRow(newRow);
      AuditService.log('staff.save.insert', { staff_id: staffId, email: email });
      return { staff_id: staffId, name: name, email: email, building_id: buildingId, role: '', active: true, funding_source: funding };
    } else {
      // Update existing
      var rowVals = sh.getRange(foundRowIndex, 1, 1, header.length).getValues()[0];
      rowVals[h.name] = name;
      rowVals[h.email] = email;
      rowVals[h.building_id] = buildingId;
      rowVals[h.funding_source] = funding;
      // Preserve role/active as-is
      sh.getRange(foundRowIndex, 1, 1, header.length).setValues([rowVals]);
      var staffIdUpd = rowVals[h.staff_id] || '';
      AuditService.log('staff.save.update', { staff_id: staffIdUpd, email: email });
      return { staff_id: staffIdUpd, name: name, email: email, building_id: buildingId, role: rowVals[h.role] || '', active: rowVals[h.active], funding_source: funding };
    }
  } finally {
    lock.releaseLock();
  }
}

// == helpers ==
function findStaffByEmail_(S, email){
  if (!email) return null;
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(S.STAFF);
  if (!sh) return null;
  var values = sh.getDataRange().getValues();
  if (!values || values.length < 2) return null;
  var header = values[0];
  var h = {};
  for (var c=0;c<header.length;c++){ h[String(header[c])] = c; }
  for (var r=1;r<values.length;r++){
    var row = values[r];
    var em = row[h.email] != null ? String(row[h.email]).toLowerCase() : '';
    if (em && em === String(email).toLowerCase()) {
      var obj = {};
      for (var k in h){ obj[k] = row[h[k]]; }
      return obj;
    }
  }
  return null;
}
