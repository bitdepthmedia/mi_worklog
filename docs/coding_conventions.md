miWorklog – Coding Conventions

Last updated: 2025-09-05 04:45

Naming
- Files (Apps Script): use lowercase with underscores, e.g., `core.gs`, `ui_menu.gs`, `data_refs.gs`, `utils_time.gs`, `constants.gs`, `ui_sidebar.gs`.
- HTML files: keep semantic names in PascalCase when they act as UI entry points, e.g., `Sidebar.html`.
- Functions: camelCase. Public functions (UI/API surface) have no suffix. Private/internal helpers end with an underscore, e.g., `findDayBlock_`.
- Constants: top-level constant objects in ALL_CAPS with lowerCamel keys, e.g., `COLUMNS.startTime`, `SHEETS.settings`, `NAMED_RANGES.taskOptions`.
- Sheet names: lowercase with underscores, e.g., `settings`, `test_cases`.
- Named ranges: UpperCamelCase (PascalCase), e.g., `TaskOptions`.

Structure & Separation of Concerns
- `core.gs`: Business logic for writing and sorting entries. No UI code.
- `ui_menu.gs`: Menu and toast setup only.
- `ui_sidebar.gs`: Sidebar composition (`showSidebar`) and HTML `include()` helper.
- `data_refs.gs`: Data access to reference/settings tabs for UI.
- `utils_time.gs`: Pure time/date parsing and transformation helpers.
- `constants.gs`: Shared constants (columns, sheet names, named ranges).

JSDoc (Mandatory)
- All functions require JSDoc with purpose, params, and return types. Use Google Apps Script types where applicable.
  /**
   * [Short description]
   * @param {Type} paramName - [Description]
   * @returns {Type} [Description]
   */
- Define shared shapes with `@typedef` close to their usage. Example: `TaskEntry`.

Input Validation & Security
- Validate all inputs from UI and sheets. Throw descriptive errors for invalid formats.
- Sanitize strings written to sheets where appropriate (trim, type-check).
- Do not log sensitive data. Prefer `console.warn`/`console.error` with safe summaries.
- Use least privilege for any integrations. Avoid storing secrets in code or sheets.

Performance
- Prefer batch reads/writes (`getValues`, `setValues`) over cell-by-cell where possible.
- Avoid repeated `getRange`/`getValue` inside loops; work with arrays in memory.
- Keep sidebar init light; lazy-load server data via `google.script.run`.

Error Handling & UX
- Backend: throw errors for validation failures; return `{ ok:boolean, message:string }` for operations that feed UI notifications.
- Frontend: use `withFailureHandler` for user-friendly error messages; avoid blocking alerts.

Testing & Control Cases
- Keep control/edge cases in a `test_cases` sheet with expected outputs.
- Before deployment, validate critical paths: time parsing, day block detection, insertion, sorting, and grant source handling.

Coding Style
- Prefer clear names over abbreviations. Avoid one-letter variables.
- Keep functions single-responsibility. Extract helpers for clarity.
- Keep magic numbers/strings in `constants.gs`.

References
- See `AGENTS.md` for overarching architecture, security, and workflow rules.
- See `docs/script_directory_overview.md` for current files and flows.
