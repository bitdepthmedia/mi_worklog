miWorklog – Script Dev Notes

Last updated: 2025-09-04 15:56

Design
- Followed strict SoC: UI in `Sidebar.html`; logic in `Code.gs`.
- All public functions include JSDoc and input validation. Added JSDoc to `onOpen` and `showSidebar`.
- Batch writes where possible; sorting is scoped to the day block only.
- `onOpen` shows a toast and adds menu items; it does not auto-open UI (simple trigger restriction).
- Important: Simple triggers can’t open sidebars/dialogs. `showSidebar` remains UI-only and data-free; `Sidebar.html` lazily loads task options via `google.script.run.getTaskOptions()` after render.
- Sheets cannot execute scripts from cell clicks or hyperlinks, and triggers cannot open UI. For a one-click entry point without menus, insert an image/drawing and manually Assign script → `showSidebar` (platform limitation).

Detection logic
- Single-column-per-day layout: `findDayBlock_` scans down from the weekday label to locate the nearby header row (in‑memory only). Day-of-week search remains unchanged.
- The end of the block is the row containing “Total Daily Hrs”.
- Columns are now fixed (no header text lookup for positions): Start(B), End(C), Grant(E), Students(F), Work(G).

Task options
- Loaded from named range `TaskOptions` if present; otherwise from `settings!A3:A` (default options live here). For backward compatibility, falls back to `task_options`/`Reference`/`Ref` sheet column A; then a small default list for first‑run convenience.

Grant sources
- Loaded from `settings!B3:B` via `getGrantSources()`.
- Sidebar shows the Grant Source dropdown only when multiple sources exist.
- On insertion, when multiple sources exist, the chosen value is written to column E. If the client did not provide a value, the first source is used defensively. When zero or one source exists, nothing is written.

Validation
- Time inputs come from `<input type="time">` (24‑hour `HH:MM`). Backend also accepts `HH:MM AM/PM` for compatibility. End must be after Start.
- Times are written as time‑only serial fractions (minutes/1440) to avoid timezone shifts and improve sort stability.
- Task description uses the user’s free‑text if provided; else the dropdown value.

Edge cases
- Day/Date override: If a date is chosen, its weekday is used. Weekend dates map to MONDAY to keep data within the week grid. If left blank, the script defaults to Today and applies the same weekend rule.
- If the day block is “full”, the new row writes to the block’s last row before sorting.

UI change
- Added optional Day/Date picker to the sidebar with a hint: "Leave blank to use Today automatically." Client sends `dateOverride` (YYYY-MM-DD) or null.
 - Switched Start/End inputs to time pickers. Client validation ensures non‑empty `HH:MM`; server parses 24‑hour or AM/PM.

Server changes
- Extended `TaskEntry` to include `dateOverride?: string | null`.
- Added `parseDateOverrideToWeekday_` with validation and JSDoc.
- Updated `addTask` to honor `dateOverride` when provided and apply weekend mapping.
 - Added `getGrantSources()` to read `settings!B3:B`.
 - Updated insertion to fixed columns; added conditional grant write to column E when multiple sources exist.

Future improvements
- Add Students column handling (column F) when requirements are finalized.
