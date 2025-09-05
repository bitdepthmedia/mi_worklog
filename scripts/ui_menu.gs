/**
 * Adds a single "Open Sidebar" menu with entries for Worklog and Students.
 * Simple triggers cannot open sidebars; provide menu + toast guidance.
 * @param {GoogleAppsScript.Events.SheetsOnOpen} e - Open event payload
 * @returns {void}
 */
function onOpen(e) {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Open Sidebar')
    .addItem('Open Worklog', 'showSidebar')
    .addItem('Add/Exit Student', 'showStudentSidebar')
    .addToUi();
  SpreadsheetApp.getActive().toast('Use Open Sidebar to launch Worklog or Students.', 'miWorklog', 6);
}
