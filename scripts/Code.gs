
// == onOpen menu ==
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Worklog')
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
    REPORTS_PREFIX: 'Reports'
  }
};
