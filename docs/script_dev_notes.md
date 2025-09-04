miWorklog – Script Dev Notes

Last updated: 2025-09-04 12:58

Design
- Followed strict SoC: UI in `Sidebar.html`; logic in `Code.gs`.
- All public functions include JSDoc and input validation. Added JSDoc to `onOpen` and `showSidebar`.
- Batch writes where possible; sorting is scoped to the day block only.
- `onOpen` now auto-opens the sidebar by default (menu remains for manual reopen).

Detection logic
- Single-column-per-day layout: `findDayBlock_` scans down from the weekday label, detects the header row on that line (in‑memory only), and maps columns by header labels. No extra `getRange` calls per row.
- The end of the block is the row containing “Total Daily Hrs”.
- Columns mapped by header labels: Start Time, End Time, What did you work on?

Task options
- Loaded from named range `TaskOptions` if present; otherwise `task_options` sheet column A; fallback list provided for first‑run convenience.

Validation
- Time inputs must match `HH:MM AM/PM` (case‑insensitive). End must be after Start.
- Times are written as time‑only serial fractions (minutes/1440) to avoid timezone shifts and improve sort stability.
- Task description uses the user’s free‑text if provided; else the dropdown value.

Edge cases
- Weekends: defaults to MONDAY to keep data within the week grid.
- If the day block is “full”, the new row writes to the block’s last row before sorting.

Future improvements
- Add optional Day/Date picker to override auto day selection.
- Expand mapping of additional columns (Grant Source, Students) as needed.
