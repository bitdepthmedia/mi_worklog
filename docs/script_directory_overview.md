miWorklog – Script Directory Overview

Last updated: 2025-09-05 10:36 EDT (Worklog clears inputs + auto-hide success; Students disables Add/Exit during operations)

Files
- scripts/core.gs: Core business logic. Finds the weekday block, writes entries, and sorts by start time. Public: `addTask`. Private: `findDayBlock_`.
- scripts/ui_menu.gs: Sheets UI glue for menus. Public: `onOpen`.
- scripts/ui_sidebar.gs: Sidebar composition helpers. Public: `showSidebar`, `include`.
- scripts/ui_student_sidebar.gs: Student Caseload sidebar server. Public: `showStudentSidebar`, `getStudentSidebarInit`, `addStudentToCaseload`, `exitStudentFromCaseload`. Private helpers: `getGroupNames_`, `getExitReasons_`, `getActiveStudents_`, `getStudentIdLength_`, `validateAddPayload_`, `resolveGroupSelection_`, `parseIsoDate_`, `findStudentHeaderRow_`. Validation now allows blank group when adding a student.
- scripts/ui_start_here_sidebar.gs: Start Here sidebar server. Public: `showStartHereSidebar`, `getStartHereInit`, `addFundingSource`, `saveStartHereDetails`. Reads buildings from `settings!F3:F`, funding from `settings!G3:G`, and share emails from `settings!H3:H`. Saves to `START HERE - DATA ENTRY TAB`: Name `B4`, Email `B5`, Buildings `B6` (CSV), Funding `A10:A18`, Percent `B10:B18`.
- scripts/data_refs.gs: Data access for sidebar/reference tabs. Public: `getTaskOptions`, `getGrantSources`, `getActiveStudentsAndGroups` (cached for 10 min). Private: `cacheKeyActiveStudents_`, `invalidateActiveStudentsAndGroupsCache_`, and `onEdit` to invalidate cache on Student Caseload edits.
- scripts/utils_time.gs: Time/date utilities. Private: `parseUserTimeToSerial_`, `getTodayWeekday_`, `parseDateOverrideToWeekday_`.
- scripts/constants.gs: Shared constants for sheet structure and names. Public objects: `COLUMNS`, `SHEETS`, `NAMED_RANGES`.
- scripts/Sidebar.html: Worklog Sidebar UI (HTML/CSS/JS). Provides Start/End time pickers (`<input type="time">` producing 24‑hour `HH:MM`), optional Day/Date picker, a dropdown of task options, and a free‑text field. Adds optional Student selection controls: multi‑select Student Names and single‑select Student Group (mutually exclusive, aria‑described). Calls `addTask` with `studentNames`/`studentGroup`. After a successful add, all inputs are cleared for rapid next entry; the success message remains visible and auto-hides after ~10s.
- scripts/StartHereSidebar.html: Start Here UI (HTML/CSS/JS). Captures Full Name, District Email, Reporting Buildings (multi-select from `settings!F3:F`), Funding sources (multi-select from `settings!G3:G` with an “Add New Funding…” sentinel that enables a text input). Renders a numeric percent input per selected funding. Client validation requires funding percents to total 100%. Calls `saveStartHereDetails`. On first successful save, alerts the user to share the sheet with addresses from `settings!H3:H`. Uses a distinct cool background color (`--bg:#eef7ff`) to differentiate from other sidebars.
- scripts/StudentSidebar.html: Student Caseload Sidebar UI. Two modes: Add Student and Exit Student. Exit mode supports choosing a reason from dropdown or typing a custom reason. Calls `addStudentToCaseload` and `exitStudentFromCaseload`; dynamically loads Groups, Exit Reasons, Student ID length, and current active students list. Group dropdown starts with an explicit empty option (no auto-selection) and allows clearing back to no group. Client-side validation enforces required fields: Add requires Grade, Name, Student ID (numeric, optional length), Service Area, Entrance Date; Group optional. Exit requires Student selection, Exit Date, and Exit Reason (from dropdown or custom text). Uses a distinct warm background color to differentiate from the Worklog sidebar. The “Add Student” and “Exit Student” buttons are disabled during their respective operations to signal progress.

Key flows
- onOpen → adds a single “Open Sidebar” menu with items “Start Here Details”, “Open Worklog”, and “Add/Exit Student”; shows a toast. Does not auto-open UI (simple trigger limitation).
- showSidebar → displays the sidebar (no data reads at open).
- Sidebar.html → lazily loads task options via `google.script.run.getTaskOptions()` and Grant Sources via `getGrantSources()` after render.
- StudentSidebar.html → lazily loads groups from `settings!E3:E`, exit reasons from `settings!C3:C`, expected ID length from `settings!D3`, and active students (no exit date) from the Student Caseload sheet. Supports “Add New Group…” which inserts into the first empty cell of `settings!E3:E` via server helper.
- StartHereSidebar.html → lazily loads buildings from `settings!F3:F`, funding from `settings!G3:G`, and saved values from the Start Here sheet. Supports “Add New Funding…” which inserts into the first empty cell of `settings!G3:G` via server helper.
  - Funding percent inputs accept whole-number percentages (e.g., 50, 25, 25). On save, values are written to `B10:B18` as decimal fractions (e.g., 0.5, 0.25, 0.25).
- addTask → parses/validates inputs, resolves target weekday (mapping weekend to Monday), locates the day block, writes values, and sorts by Start Time (column B). If student names or a group is provided, resolves active Student ID(s) and writes to Column F as comma‑separated IDs (no spaces). Rejects dual selection server‑side.

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

Student selection sources (read-only)
- Student Caseload: B (Student Name), C (Group Name), D (Student ID), G (Exit Date)
- Active students = rows where G is blank.
- `getActiveStudentsAndGroups` caches derived structures for ~10 minutes using CacheService.

How to install in Apps Script
- In the target Google Sheet, open Extensions → Apps Script.
- Create files in the `scripts/` directory corresponding to this repo: `core.gs`, `ui_menu.gs`, `ui_sidebar.gs`, `data_refs.gs`, `utils_time.gs`, `constants.gs`, and `Sidebar.html`. Paste contents accordingly.
- Reload the spreadsheet → use the “Open Sidebar” menu, then choose “Open Worklog” or “Add/Exit Student”. To add a sheet button for Students, insert a Drawing/Image and Assign script `showStudentSidebar`.

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

Start Here behavior
- Buildings come from `settings!F3:F`.
- Funding options come from `settings!G3:G` and support adding a custom option into the first empty row of that range.
- Share reminder pulls emails from `settings!H3:H` and is shown only on the first successful save (when `B4` was previously blank).
