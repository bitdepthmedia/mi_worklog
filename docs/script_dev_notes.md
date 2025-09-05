miWorklog – Script Dev Notes

Last updated: 2025-09-05 08:18 EDT

Design
- Adopted strict SoC across multiple script files:
- UI/menu glue in `ui_menu.gs`, `ui_sidebar.gs` (Worklog), and `ui_student_sidebar.gs` (Students sidebar server functions).
  - Business logic in `core.gs`.
  - Data access for references in `data_refs.gs`.
  - Time/date helpers in `utils_time.gs`.
  - Shared constants in `constants.gs`.
- All functions include JSDoc and input validation where applicable.
- Batch writes where possible; sorting is scoped to the day block only.
- Simple triggers can’t open sidebars/dialogs. `onOpen` only adds menu + toast. `Sidebar.html` lazily loads data via `google.script.run`.

Detection logic
- Single-column-per-day layout: `findDayBlock_` scans down from the weekday label to locate the nearby header row (in‑memory only).
- The end of the block is the row containing “Total Daily Hrs”.
- Columns are fixed using `COLUMNS`: Start(B), End(C), Grant(E), Students(F), Work(G).

Task options
- Loaded from named range `TaskOptions` if present; otherwise from `settings!A3:A`. Falls back to `task_options`/`Reference`/`Ref` (col A), then a default list.

Grant sources
- Loaded from `settings!B3:B` via `getGrantSources()`.
- Sidebar shows the Grant Source dropdown only when multiple sources exist.
- On insertion, when multiple sources exist, the chosen value is written to column E. If the client did not provide a value, the first source is used defensively. When zero or one source exists, nothing is written.

Validation
- Client: `<input type="time">` ensures `HH:MM` values. Server also accepts `HH:MM AM/PM` for backward compatibility. End must be after Start.
- Times are written as time‑only serial fractions (minutes/1440) to avoid timezone shifts and improve sort stability.
- Task description uses the user’s free‑text if provided; else the dropdown value.

Edge cases
- Day/Date override: If a date is chosen, its weekday is used. Weekend dates map to MONDAY to keep data within the week grid. If left blank, the script defaults to Today and applies the same weekend rule.
- If the day block is “full”, the new row writes to the block’s last row before sorting.

UI notes
- A single “Open Sidebar” top-level menu is created on open with two items: “Open Worklog” (`showSidebar`) and “Add/Exit Student” (`showStudentSidebar`).
- Worklog: Add an image/drawing and Assign script → `showSidebar` for a one‑click entry.
- Students: Add an image/drawing on the `Student Caseload` sheet and Assign script → `showStudentSidebar`.
 - Follow naming and style rules in `docs/coding_conventions.md`.

Students UI – Group selection
- The Group dropdown in `StudentSidebar.html` does not auto-select the first group. It includes a leading empty option so the control starts blank and users can clear back to “no group”.
- Server validation updated: `validateAddPayload_` now allows a blank group. If a user selects “Add New Group…” the server will still require a non-empty `newGroup` via `resolveGroupSelection_`.

Students UI – Required fields
- Add Student: Client-side validation enforces Grade (0–12), Student Name, Student ID (numeric; if `idLength` is provided from settings, length must match), Service Area, and Entrance Date. Group is optional; if “Add New Group…” is chosen, the new group name is required.
- Exit Student: Client-side validation requires a selected Student, Exit Date, and Exit Reason (either dropdown value or custom text).

Limitations (Sidebar positioning)
- Google Sheets sidebars (HtmlService sidebar) are fixed on the right and cannot be programmatically docked to the left. Alternatives: use a modal or modeless dialog (`showModalDialog`/`showModelessDialog`), which appear centered and are not docked.

Server notes (current)
- Worklog: `TaskEntry` includes `dateOverride?: string | null` and optional `grantSource`.
- Students: `addStudentToCaseload()` validates grade 0–12, numeric Student ID with length from `settings!D3`, required fields, resolves “Add New Group…” into `settings!E3:E`, writes row `[A..H]`, then sorts by Entrance Date (F), Grade (A), Student Name (B). `exitStudentFromCaseload()` writes Exit Date (G) and Exit Reason (H) for the selected active student. Exit reason can be chosen from the dropdown (settings!C3:C) or typed as a custom text input.
- Uses `constants.gs` for `COLUMNS`, `SHEETS`, `NAMED_RANGES`.
- `include(filename)` returns string content for HTML templating.

Worklog – Student Selection
- UI additions (Sidebar.html): Added optional chooser under “What did you work on?” with helper copy. Controls:
  - `#studentNames`: multi-select of Student Names (keyboard accessible; `aria-describedby=studentHelp`).
  - `#studentGroup`: single-select of Student Group (also `aria-describedby=studentHelp`).
  - Mutual exclusivity enforced client-side: selecting one or more names disables/clears Group; selecting a Group disables/clears Names. Both controls remain optional for non-student work.
- Data source and caching: `getActiveStudentsAndGroups()` in `data_refs.gs` reads Student Caseload (B:C:D:G), filters active rows (G blank), normalizes whitespace, and builds:
  - `students` unique by ID (latest row wins), sorted by Student Name asc.
  - `groups` unique, non-blank, sorted asc.
  - `groupToStudentIds` mapping with unique IDs sorted by Student Name asc for determinism.
  - Results cached with `CacheService` for 600 seconds. Logs “cache hit/miss”.
- Server behavior (core.gs → addTask):
  - Extends `TaskEntry` to include `studentNames?: string[]` and `studentGroup?: string|null`.
  - Validates mutual exclusivity server-side; throws if both provided.
  - Resolves names→IDs using cached structures; drops missing names and appends a warning to the success message.
  - If a group is selected and resolves to zero active students, treats as no selection and appends a warning.
  - Writes Column F with the comma-separated IDs (no spaces) when selection yields IDs; otherwise writes blank. Before writing, sets the target cell number format to text (`@`) to prevent Sheets from coercing `id1,id2` into a single large number.
  - Never writes names or group labels to the worklog.

Cache invalidation
- The active students/groups cache is invalidated in two ways:
  - Immediately after `addStudentToCaseload` and `exitStudentFromCaseload` mutate the Student Caseload sheet.
  - A simple trigger `onEdit(e)` in `data_refs.gs` clears the cache whenever any edit occurs on the `Student Caseload` sheet (covers manual edits/imports).

Performance and UX
- One batched read for Student Caseload; derived structures cached ~10 minutes.
- Deterministic ordering for group expansion (by Student Name asc); IDs deduplicated.

Styling
- StudentSidebar uses a distinct warm background color (`--bg:#fff7e6`) to clearly differentiate it from the Worklog sidebar (`Sidebar.html`), which keeps the neutral `--bg:#fafbfc`.
