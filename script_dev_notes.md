# Worklog Apps Script — Developer Notes

## Goals & Principles
- **Script-first**: no user-editable formulas. All logic in services.
- **Stable UX**: Sidebar/modal UI with validated inputs; protected ranges for data sheets.
- **Auditability**: append-only logs; **Close Week** produces immutable summaries.
- **Separation of concerns**: UI ↔ Controller ↔ Services ↔ Sheets.

## Data Model (recommended columns)
### Worklog
`id, user_email, date (ISO), minutes, student_id (nullable), activity_code, notes, created_at`
### Students
`student_id, name, grade, building_id, flags...`
### Caseload
`staff_id, student_id, start_date, end_date, services...`
### Staff
`staff_id, name, email, building_id, role`
### Settings
`activity_code, label, allowability, pars_category, min_increment, ...`
### PARS Overrides
`id, staff_id, date, minutes, reason_code, notes, created_at`

## Services: Responsibilities & Contracts
- **ValidationService**
  - Required fields, minutes > 0, valid date.
  - Enforce **allowability** by role/activity (`Settings` driven).
  - Prevent **overlap** for same staff/date window.
  - Permission checks (staff ↔ building context).
- **WorklogService**
  - Central write path; uses `LockService` for concurrency.
  - Emits audits via `AuditService`.
  - Exposes `closeWeekPrompt()`; delegates heavy lifting to `PARSService`.
- **CaseloadService**
  - Effective-date filters; return only active students for staff+date.
- **PARSService**
  - `classify(entry)` → in-grant/out-of-grant minutes.
  - `closeWeek(weekEnding)` → aggregate, write **Reports – Week {end}**, protect it.
  - Adjustment model: post-closure changes recorded as **adjustment rows**, never rewrites.
- **ReportService**
  - Rebuild summaries over ranges; export CSV/PDF via `DriveApp` if needed.
- **AuditService**
  - `log(action, payload)` writes `[ts, user, action, json, checksum]` to **Audit** sheet.
- **SettingsService**
  - `listActivities()`: reads from Settings sheet with TTL-based caching.
  - Typed getters: roles, buildings; cache in `PropertiesService` with TTL.

## UI Flow
1. `onOpen()` adds **Worklog** menu.
2. `showSidebar()` mounts **Sidebar.html**.
3. `SidebarController_boot()` hydrates dropdowns and shows loading states and inline error messages.
4. User submits → `SidebarController_save(payload)` → `ValidationService.validateEntry()` → `WorklogService.saveEntry()`.
5. Close a week from menu → `WorklogService.closeWeekPrompt()` → `PARSService.closeWeek()` → generate & lock report.

## Triggers & Guards
- **onOpen**: menu install.
- **Time-driven**: nightly rebuilds and stale-cache clearing implemented.
- **LockService**: wrap writes; avoid concurrent edits.
- **Protection API**: lock **Reports – Week {end}** and non-UI sheets.

## Error Handling
- Throw descriptive errors in services; show concise alerts in UI.
- Wrap writes with try/finally to release locks.
- Include `error_code` in messages for easier support.

## Testing & Parity
- Create **/tests** tab with canned entries; run `ReportService.rebuildAll()` and compare to legacy totals.
- Target ±1 minute tolerance; investigate deltas with an audit view.
- Add a **DEV_MODE** flag in `CONFIG` to enable verbose logging.

## Deployment
- Manual: paste files into Apps Script editor.
- Or use **clasp**:
  - `clasp login`
  - `clasp create --type sheets --title "Worklog"`
  - `clasp push`
- Set spreadsheet sharing/protection rules.

## Completed Implementations
- Lock handling bug fixed in `WorklogService.saveEntry`.
- `AuditService.log` fully implemented; Audit sheet created with hash/checksum utility.
- `ValidationService.validateEntry`: comprehensive validation (required fields, allowability, overlap prevention, permission checks).
- `SettingsService.listActivities`: reads from Settings sheet with TTL-based caching.
- `CaseloadService.listStudents`: effective-dated filtering implemented.
- `PARSService.classify` & `PARSService.closeWeek()`: classification and weekly aggregation with immutable report generation and sheet protection.
- `CONFIG.SHEETS` unified across all service files.
- Webapp manifest access removed for security.
- Client-side validation & error handling in `Sidebar.html` (loading states & inline error messages).
- Server-side validation with role/activity allowability, overlap detection, permissions.
- Caching systems with TTL across services.

## Roadmap (next tasks)
- Add **bulk entry modal** in UI and keyboard shortcuts.
