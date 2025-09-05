/**
 * Simple wrappers to attach to drawings/buttons for quick access.
 * Assign these functions via Insert → Drawing → Assign script…
 */

/**
 * Opens or creates the current week and hides other Week sheets.
 * @returns {void}
 */
function triggerShowCurrentWeek() {
  showCurrentWeek();
}

/**
 * Opens the centered date picker dialog to jump to a week.
 * @returns {void}
 */
function triggerOpenWeekSelector() {
  openWeekSelectorDialog();
}

