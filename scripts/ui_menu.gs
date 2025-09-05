/**
 * Adds a single "Open Sidebars" menu with entries for Worklog and Students.
 * Simple triggers cannot open sidebars; provide menu + toast guidance.
 * @param {GoogleAppsScript.Events.SheetsOnOpen} e - Open event payload
 * @returns {void}
 */
function onOpen(e) {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Open Sidebars')
    .addItem('User Details', 'showStartHereSidebar')
    .addItem('Edit Worklog', 'showSidebar')
    .addItem('Add/Exit Students', 'showStudentSidebar')
    .addToUi();
  // Register the Worklog week management menu
  if (typeof registerWorklogMenu_ === 'function') {
    registerWorklogMenu_(ui);
  }
  SpreadsheetApp.getActive().toast('Use Open Sidebars → User Details / Worklog / Students.', 'miWorklog', 6);
}
