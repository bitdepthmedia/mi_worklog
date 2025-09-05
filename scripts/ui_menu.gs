/**
 * Adds the Worklog menu and shows a toast on open.
 * Simple triggers cannot open sidebars; provide menu + toast guidance.
 * @param {GoogleAppsScript.Events.SheetsOnOpen} e - Open event payload
 * @returns {void}
 */
function onOpen(e) {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Worklog')
    .addItem('Open Sidebar', 'showSidebar')
    .addToUi();
  ui.createMenu('Students')
    .addItem('Open Caseload Sidebar', 'showStudentSidebar')
    .addToUi();
  SpreadsheetApp.getActive().toast('Use Worklog/Students menus to open sidebars.', 'miWorklog', 6);
}
