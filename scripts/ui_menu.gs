/**
 * Adds the Worklog menu and shows a toast on open.
 * Simple triggers cannot open sidebars; provide menu + toast guidance.
 * @param {GoogleAppsScript.Events.SheetsOnOpen} e - Open event payload
 * @returns {void}
 */
function onOpen(e) {
  SpreadsheetApp.getUi()
    .createMenu('Worklog')
    .addItem('Open Sidebar', 'showSidebar')
    .addToUi();
  SpreadsheetApp.getActive().toast('Use Worklog → Open Sidebar to add a task.', 'miWorklog', 6);
}

