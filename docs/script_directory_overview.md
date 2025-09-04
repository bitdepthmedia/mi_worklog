miWorklog – Script Directory Overview

Last updated: 2025-09-04 12:58 (single-column-per-day layout)

Files
- scripts/Code.gs: Core Apps Script entry points. Adds custom menu, renders sidebar, validates inputs, locates the weekday block in the sheet, writes the entry, and sorts by start time. Contains helper utilities and JSDoc for each function.
- scripts/Sidebar.html: Sidebar UI (HTML/CSS/JS). Provides Start/End time inputs (HH:MM AM/PM), a dropdown of task options, and a free‑text field. Calls `addTask` via `google.script.run`.

Key flows
- onOpen → adds “Worklog” menu and auto-opens the sidebar on load.
- showSidebar → injects task options and displays the sidebar.
- addTask → parses and validates times, picks today’s weekday (falls back to Monday on weekends), finds the sheet block headed by the weekday label, inserts the row, then sorts the block ascending by “Start Time”. Sorting width is restricted to the day’s columns only.

Assumptions and discovery
- Day blocks are labeled with uppercase weekday names (e.g., MONDAY). Each day’s block uses the same columns across the sheet.
- Within a few rows below the label, a header row contains: “Start Time”, “End Time”, and “What did you work on?”.
- The bottom of each block contains a row with the phrase “Total Daily Hrs”. The script bounds the block using that row.
- Task options are loaded from, in order: Named range `TaskOptions`, sheet `task_options` (column A), or a small fallback list.

How to install in Apps Script
- In the target Google Sheet, open Extensions → Apps Script.
- Create files `Code.gs` and `Sidebar.html` and paste the contents from this repository’s `scripts/` directory.
- Reload the spreadsheet → the Worklog sidebar opens automatically; use the Worklog menu to reopen later if needed.

Notes
- Sorting uses the “Start Time” column detected on the header row. Blank rows remain at the bottom after sort.
- Times are stored as time-only serial fractions (no timezone dependency). Use your preferred time number format in the sheet.
- The script is conservative and throws clear validation errors for bad inputs.
