# Worklog Apps Script — Directory Overview

This document orients developers to the codebase without opening every file.

## Project Map

```
apps_script_project/
├── appsscript.json              # Manifest (timezone, V8 runtime)
├── bootstrap.gs                 # Initializes required sheets and headers via CONFIG.SHEETS
├── Code.gs                      # onOpen menu, sidebar launcher, CONFIG constants (includes Audit)
├── controllers.sidebar.gs       # UI bridge (HTML ↔ Services)
├── services.audit.gs            # append-only audit logger
├── services.caseload.gs         # caseload + student lookup
├── services.pars.gs             # PARS classification + week close
├── services.report.gs           # report rebuild pipeline
├── services.settings.gs         # settings retrieval with caching
├── services.validation.gs       # entry validation and policy checks
├── services.worklog.gs          # write entries, close week delegation, audit emission
└── Sidebar.html                 # HTML Service UI for entry with validation & error handling
```

> **Note:** All business logic is implemented within `services/*.gs`; controllers and UI handle orchestration and presentation.

## File-by-File

- **appsscript.json** — Manifest; sets timezone and V8 runtime.
- **bootstrap.gs** — Initializes required sheets (Settings, Staff, Students, Caseload, Worklog, Audit, PARS Overrides, Reports) including the **Staff** sheet schema with a `funding_source` column, and headers using `CONFIG.SHEETS`.
- **Code.gs**
  - `onOpen()` adds **Worklog** menu: *Open Sidebar*, *Close Week*, *Rebuild Reports*.
  - `showSidebar()` mounts `Sidebar.html`.
  - `CONFIG` centralizes sheet names (including **Audit**) and versioning.
- **controllers.sidebar.gs**
  - `SidebarController_boot()` fetches students and activities, shows loading states, and inline error messages.
  - `SidebarController_save(payload)` invokes `ValidationService.validateEntry()` and `WorklogService.saveEntry()`, and returns success or error to UI.
  - `SidebarController_loadStaffConfig()` and `SidebarController_saveStaffConfig(payload)` provide server endpoints for loading and saving staff configuration data.
- **services.worklog.gs**
  - `saveEntry(entry, userEmail)` acquires a document lock, writes to the **Worklog** sheet, and emits audit logs via `AuditService`.
  - `closeWeekPrompt()` prompts for a week-ending date and delegates to `PARSService.closeWeek()`.
- **services.validation.gs**
  - `validateEntry(entry, userEmail)` enforces required fields, a valid date, minutes > 0; checks role/activity allowability, prevents entry overlap, and enforces permission constraints.
- **services.caseload.gs**
  - `listStudents(staffId, date)` returns only active students for the given staff and date, using effective-dated filtering.
- **services.pars.gs**
  - `classify(entry)` computes in-grant vs out-of-grant minutes per PARS rules.
  - `closeWeek(weekEnding)` aggregates entries for the period, writes a protected **Reports – Week {end}** sheet, and records adjustments immutably.
- **services.report.gs**
  - `rebuildAll()` recomputes all reports from **Worklog** and **PARS Overrides**, using batch operations and optional CSV/PDF export.
- **services.audit.gs**
  - `log(action, payload, userEmail)` appends `[timestamp, user, action, payload JSON, checksum]` rows to the **Audit** sheet.
- **services.settings.gs**
  - `listActivities()` reads activity codes and labels from the **Settings** sheet with TTL-based caching.
  - Typed getters (`getRoles()`, `getBuildings()`) fetch and cache roles and buildings from **Settings**.
  - `getFundingSources()` fetches and caches funding sources from **Settings**.
  - `getStaffConfigFields()` fetches and caches staff configuration field metadata.
- **Sidebar.html**
  - Enhanced UI with client-side validation, loading states, and inline error messages; includes a dynamic **Staff Settings** section below the entry form, and uses `google.script.run` to call controller methods and populate dropdowns.

## Expected Sheets

- **Settings** (reference lists, activity codes, flags)
- **Staff** (columns: `staff_id`, `name`, `email`, `building_id`, `role`, `active`, `funding_source`), **Students**, **Caseload** (IDs, names, effective dates)
- **Worklog** (tall table of entries)
- **Audit** (append-only audit log)
- **PARS Overrides** (manual adjustments)
- **Reports – {period}** (generated + protected)

## How to Run

1. Open the spreadsheet → **Extensions ▸ Apps Script**.
2. Import the project files into the Apps Script project (including `bootstrap.gs`).
3. In the Apps Script editor, run the `bootstrap()` function to initialize required sheets and headers.
4. Save and reload the spreadsheet → **Worklog** menu appears.
5. **Worklog ▸ Open Sidebar** to enter a test row.
