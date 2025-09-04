miWorklog – Script Directory Overview

Last updated: 2025-09-04 13:57 (settings!A3:A task options)

Files
- scripts/Code.gs: Core Apps Script entry points. Adds custom menu, renders sidebar, validates inputs, locates the weekday block in the sheet, writes the entry, and sorts by start time. Contains helper utilities and JSDoc for each function.
- scripts/Sidebar.html: Sidebar UI (HTML/CSS/JS). Provides Start/End time pickers (`<input type="time">` producing 24‑hour `HH:MM`), optional Day/Date picker (blank defaults to Today), a dropdown of task options, and a free‑text field. Calls `addTask` via `google.script.run`.

Key flows
- onOpen → adds “Worklog” menu, shows a toast; does not auto-open UI (simple trigger limitation).
- showSidebar → displays the sidebar (no data reads at open).
- Sidebar.html → lazily loads task options via `google.script.run.getTaskOptions()` after render.

Notes on buttons
- Google Sheets cannot run Apps Script from a cell click or hyperlink, and triggers can’t open UI. The supported approach is an image/drawing with “Assign script…” to `showSidebar`.
- addTask → parses and validates times (accepts 24‑hour `HH:MM` or `HH:MM AM/PM`), determines target day using the optional date override when provided (blank → Today); weekend dates map to Monday to fit the weekly grid. Then it finds the sheet block headed by the weekday label, inserts the row, and sorts the block ascending by “Start Time”. Sorting width is restricted to the day’s columns only.

Assumptions and discovery
- Day blocks are labeled with uppercase weekday names (e.g., MONDAY). Each day’s block uses the same columns across the sheet.
- Within a few rows below the label, a header row contains: “Start Time”, “End Time”, and “What did you work on?”.
- The bottom of each block contains a row with the phrase “Total Daily Hrs”. The script bounds the block using that row.
- Task options are loaded from, in order: Named range `TaskOptions`, sheet `settings` (A3:A), legacy `task_options`/`Reference`/`Ref` (column A), or a small fallback list.

How to install in Apps Script
- In the target Google Sheet, open Extensions → Apps Script.
- Create files `Code.gs` and `Sidebar.html` and paste the contents from this repository’s `scripts/` directory.
- Reload the spreadsheet → the Worklog sidebar opens automatically; use the Worklog menu to reopen later if needed.

Notes
- Sorting uses the “Start Time” column detected on the header row. Blank rows remain at the bottom after sort.
- Times are stored as time-only serial fractions (no timezone dependency). Use your preferred time number format in the sheet.
- The script is conservative and throws clear validation errors for bad inputs.
 - Day/Date override is optional. Leaving it blank posts the entry to Today’s weekday.
