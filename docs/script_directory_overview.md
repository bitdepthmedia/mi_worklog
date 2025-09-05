miWorklog – Script Directory Overview

Last updated: 2025-09-05 04:45 (added coding conventions link)

Files
- scripts/core.gs: Core business logic. Finds the weekday block, writes entries, and sorts by start time. Public: `addTask`. Private: `findDayBlock_`.
- scripts/ui_menu.gs: Sheets UI glue for menus. Public: `onOpen`.
- scripts/ui_sidebar.gs: Sidebar composition helpers. Public: `showSidebar`, `include`.
- scripts/data_refs.gs: Data access for sidebar/reference tabs. Public: `getTaskOptions`, `getGrantSources`.
- scripts/utils_time.gs: Time/date utilities. Private: `parseUserTimeToSerial_`, `getTodayWeekday_`, `parseDateOverrideToWeekday_`.
- scripts/constants.gs: Shared constants for sheet structure and names. Public objects: `COLUMNS`, `SHEETS`, `NAMED_RANGES`.
- scripts/Sidebar.html: Sidebar UI (HTML/CSS/JS). Provides Start/End time pickers (`<input type="time">` producing 24‑hour `HH:MM`), optional Day/Date picker, a dropdown of task options, and a free‑text field. Calls `addTask` via `google.script.run`.

Key flows
- onOpen → adds “Worklog” menu, shows a toast; does not auto-open UI (simple trigger limitation).
- showSidebar → displays the sidebar (no data reads at open).
- Sidebar.html → lazily loads task options via `google.script.run.getTaskOptions()` and Grant Sources via `getGrantSources()` after render.
- addTask → parses/validates inputs, resolves target weekday (mapping weekend to Monday), locates the day block, writes values, and sorts by Start Time (column B).

Assumptions and discovery
- Day blocks are labeled with uppercase weekday names (e.g., MONDAY). Each day’s block uses the same columns across the sheet.
- A header row near the day label contains: “Start Time”, “End Time”, and “What did you work on?”.
- The bottom of each block contains a row with the phrase “Total Daily Hrs”. The script bounds the block using that row.
- Task options are loaded from, in order: named range `TaskOptions`, sheet `settings` (A3:A), legacy `task_options`/`Reference`/`Ref` (column A), or a small fallback list.
- Grant sources are loaded from `settings!B3:B`.

Fixed columns (sheet-wide)
- Start Time: column B (2)
- End Time: column C (3)
- Grant Source: column E (5)
- Students: column F (6) [reserved]
- What did you work on?: column G (7)

How to install in Apps Script
- In the target Google Sheet, open Extensions → Apps Script.
- Create files in the `scripts/` directory corresponding to this repo: `core.gs`, `ui_menu.gs`, `ui_sidebar.gs`, `data_refs.gs`, `utils_time.gs`, `constants.gs`, and `Sidebar.html`. Paste contents accordingly.
- Reload the spreadsheet → use the Worklog menu to open the sidebar.

Notes
- Sorting uses the Start Time column (fixed to column B). Blank rows remain at the bottom after sort.
- Times are stored as time-only serial fractions (no timezone dependency). Use your preferred time number format in the sheet.
- Day/Date override is optional. Leaving it blank posts the entry to Today’s weekday; weekend entries map to Monday.

Conventions
- See `docs/coding_conventions.md` for naming, JSDoc, SoC, validation, security, and style rules.

Grant Source behavior
- `settings!B3:B` defines available grant sources.
- If more than one grant source is defined, the sidebar shows a dropdown and the selected value is written to column E during insertion.
- If zero or one grant source is defined, the dropdown is hidden and no value is written.
