/**
 * Builds and shows the sidebar UI.
 * @returns {void}
 */
function showSidebar() {
  var output = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('Add Worklog Task');
  SpreadsheetApp.getUi().showSidebar(output);
}

/**
 * Includes HTML partials for templated Sidebar files.
 * @param {string} filename - Name of an Apps Script HTML file.
 * @returns {string} The HTML content to inline.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

