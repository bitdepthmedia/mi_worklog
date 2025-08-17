# Worklog Apps Script — Directory Overview

This document orients developers to the codebase without opening every file.

## Project Map

```
apps_script_project/
├── appsscript.json              # GAS project manifest
├── Code.gs                      # onOpen menu, sidebar launcher, config
├── controllers.sidebar.gs       # UI bridge (HTML <-> Services)
├── services.audit.gs            # append-only audit logger (stub)
├── services.caseload.gs         # caseload + student lookup (stub)
├── services.pars.gs             # PARS classification + week close (stub)
├── services.report.gs           # report (re)build pipeline (stub)
├── services.settings.gs         # read settings (activities, etc.) (stub)
├── services.validation.gs       # entry validation and policy checks (stub)
├── services.worklog.gs          # write entries, close week prompt (stub)
└── Sidebar.html                 # HTML Service UI for entry
```

> **Note:** This scaffold is intentionally minimal; each service exposes a thin, testable API. All business logic should live in `services/*.gs`, not in UI or controllers.

## File-by-File

- **appsscript.json** — Manifest. Sets timezone, V8 runtime, and webapp defaults.
- **Code.gs**
  - `onOpen()` adds **Worklog** menu: *Open Sidebar*, *Close Week*, *Rebuild Reports*.
  - `showSidebar()` mounts `Sidebar.html`.
  - `CONFIG` centralizes sheet names and versioning.
- **controllers.sidebar.gs**
  - `SidebarController_boot()` returns dropdown data (students, activities).
  - `SidebarController_save(payload)` validates and writes entries via services.
- **services.worklog.gs**
  - `saveEntry(entry, userEmail)` writes to the **Worklog** sheet under a document lock.
  - `closeWeekPrompt()` prompts for week-ending date and delegates to `PARSService`.
- **services.validation.gs**
  - `validateEntry(e)` enforces required fields and will house allowability, overlap, and permission checks.
- **services.caseload.gs**
  - `listStudents()` returns effective-dated student list for the active staff/building.
- **services.pars.gs**
  - `classify(entry)` determines in-grant vs out-of-grant minutes.
  - `closeWeek(weekEnding)` aggregates a period and writes an immutable summary.
- **services.report.gs**
  - `rebuildAll()` recomputes summaries from **Worklog** + **PARS Overrides**.
- **services.audit.gs**
  - `log(action, payload)` appends structured audit rows with timestamp/user.
- **services.settings.gs**
  - `listActivities()` returns activity codes/labels from **Settings**.
- **Sidebar.html**
  - Minimal data-entry UI; uses `google.script.run` to call controller functions.

## Expected Sheets

- **Settings** (reference lists, activity codes, flags)
- **Staff**, **Students**, **Caseload** (IDs, names, effective dates)
- **Worklog** (tall table of entries)
- **PARS Overrides** (manual adjustments)
- **Reports – {period}** (generated + protected)

## How to Run

1. Open the spreadsheet → **Extensions ▸ Apps Script**.
2. Create files matching the map above (or import the scaffold).
3. Reload the spreadsheet → menu **Worklog** appears.
4. **Worklog ▸ Open Sidebar** to enter a test row.
