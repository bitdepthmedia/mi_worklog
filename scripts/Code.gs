// == onOpen menu ==
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Worklog')
    .addItem('Run Setup', 'runSetupRouter')              // <-- added
    .addItem('Open Sidebar', 'showSidebar')
    .addItem('Close Week', 'WorklogService.closeWeekPrompt')
    .addItem('Rebuild Reports', 'ReportService.rebuildAll')
    .addToUi();
}

function showSidebar() {
  const html = HtmlService.createTemplateFromFile('Sidebar').evaluate()
    .setTitle('Worklog Entry')
    .setWidth(380);
  SpreadsheetApp.getUi().showSidebar(html);
}

// Route the setup call to bootstrapWorkbook if present; otherwise guide the dev.
function runSetupRouter() {
  const ui = SpreadsheetApp.getUi();
  if (typeof bootstrapWorkbook === 'function') {
    try {
      bootstrapWorkbook();
      ui.alert('Setup complete. Required tabs and headers are ready.');
    } catch (e) {
      ui.alert('Setup error: ' + (e && e.message ? e.message : e));
    }
  } else {
    ui.alert(
      'bootstrapWorkbook() not found.\n\n' +
      'Add a bootstrap file with the bootstrapWorkbook() function (and helpers),\n' +
      'or paste the provided bootstrap implementation into your project.'
    );
  }
}

// == HTML includes ==
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// == Config ==
const CONFIG = {
  VERSION: '0.1.0',
  SHEETS: {
    SETTINGS: 'Settings',
    STAFF: 'Staff',
    STUDENTS: 'Students',
    CASELOAD: 'Caseload',
    WORKLOG: 'Worklog',
    PARS_OVERRIDES: 'PARS Overrides',
    AUDIT: 'Audit',
    REPORTS_PREFIX: 'Reports'
  }
};