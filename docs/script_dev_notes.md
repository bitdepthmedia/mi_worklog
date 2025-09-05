miWorklog – Script Dev Notes

Last updated: 2025-09-05 04:45

Design
- Adopted strict SoC across multiple script files:
  - UI/menu glue in `ui_menu.gs` and `ui_sidebar.gs`.
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
- Add an image/drawing and Assign script → `showSidebar` for a one-click entry (platform limitation).
 - Follow naming and style rules in `docs/coding_conventions.md`.

Server notes (current)
- `TaskEntry` includes `dateOverride?: string | null` and optional `grantSource`.
- Uses `constants.gs` for `COLUMNS`, `SHEETS`, `NAMED_RANGES`.
- `include(filename)` returns string content for HTML templating.

Future improvements
- Add Students column handling (column F) when requirements are finalized.
