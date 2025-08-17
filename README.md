# Worklog Template (Google Apps Script Project)

This project provides a **script-driven replacement** for traditional formula-heavy instructional staff worklogs used in K-12 settings.  
It is designed to track:

- **Caseloads** (student rosters, entry/exit dates, support reasons)
- **Time Spent** (weekly logs of instructional services)
- **PARS Time Reporting** (tracking out-of-grant work vs. grant-funded work)
- **Audit-ready summaries** for compliance reporting

Unlike the original workbook (formula-based), this template moves almost all operations to **Google Apps Script services and custom HTML UIs** for improved UX and reduced breakage risk.

---

## Features

- Centralized **Settings** tab for configuration
- Script-based services (`CaseloadService`, `WorklogService`, `ParsService`)
- HTML sidebar/dialog UIs for staff data entry
- Automatic data validation and error-proofing
- Support for multiple weeks (dynamically generated, not pre-baked tabs)
- Clear separation between **business logic** and **presentation layer**

---

## Requirements

- **Google Workspace / Gmail account** with access to Google Sheets
- Permissions to run **Google Apps Script** within the sheet
- District-level access to maintain Settings and Caseload lists

### Initial Google Sheet Setup

Before installing the Apps Script, the sheet should contain the following baseline tabs:

1. **Settings**  
   - Contains global configuration values (school year, default grant codes, thresholds).

2. **Caseload**  
   - Student roster with entry/exit dates, support categories, demographics.

3. **Worklog**  
   - Placeholder log where scripts append weekly activity entries.

4. **PARS**  
   - Time allocation tab for in-grant vs. out-of-grant work.

Additional helper tabs will be created or managed dynamically by the scripts.  
All named ranges, validations, and formulas are replaced or minimized in this version.

---

## Installation

1. Create a new Google Sheet and add the **Settings**, **Caseload**, **Worklog**, and **PARS** tabs as above.
2. Open **Extensions → Apps Script** and copy the contents of this repository into the script editor.
3. Deploy as an **add-on** or attach the bound script to your Sheet.
4. Run the initial setup function (`onOpen`) to build menus and validate prerequisites.

---

## Development

- Source of truth repository: [mi_worklog](https://github.com/bitdepthmedia/mi_worklog)
- Developer: **IABTT**
- Language: Google Apps Script (JavaScript runtime with HTML Service)

### Contributing

Pull requests are welcome!  
For major changes, please open an issue first to discuss what you would like to change.

---

## License

This project is licensed under the [MIT License](./LICENSE).