# Workbook Functional Inventory

This document serves as a **source of truth** for the existing workbook functionality. Repetitive elements have been grouped for clarity.

## Named Ranges

- **TimeOptions** → `$R$1:$R$63` on each weekly tab (`Week 1`–`Week 52`, plus `SAMPLE Work Log`)
  *Purpose: Provides standardized time increments for dropdown selection.*
- **FiveMin** → Settings!$B$4:$B$112
- **TenMin** → Settings!$C$4:$C$58
- **FifteenMin** → Settings!$D$4:$D$40
- **TwentyMin** → Settings!$E$4:$E$31
- **ThirtyMin** → Settings!$F$4:$F$22
- **display** → #REF! (broken reference)
- **TimeOptions** → #REF! (broken reference)

## Data Validations

### Settings
- B3:F3 → Dropdown enforcing time increment categories. (List: 5,10,15,20,30)
### START HERE - DATA ENTRY TAB
- B6 → Dropdown for building selection.
- B7:E7 → Custom rule enforcing valid date entry.
### Student Caseload
- E3:F1000 → Custom rule enforcing valid date entry.
- G3:G1000 → Dropdown for service codes from Settings.
### SAMPLE Work Log
- Student dropdowns (F9:F23, M9:M23, etc.) → list from Student Caseload.
- Date validation (E3:E4) → custom date validation.
- Activity dropdowns (G9:G23, N9:N23, etc.) → list from Settings.
- Minutes dropdown (B4) → fixed list (10,15,20,30 Minutes).
- Role/task dropdowns (B9:B11 etc.) → list from $Q$1:$Q$63 on Sample Work Log.
- Category dropdowns (E9:E23, L9:L23, etc.) → list from Settings.
### Weekly Tabs (Week 1–52)
- Student dropdowns: e.g. F9:F23, M9:M23 → list from Student Caseload.
- Date validation: e.g. E3:E4 → custom date validation rule.
- Activity dropdowns: e.g. G9:G23, N9:N23 → list from Settings.
- Minutes dropdown: B4 → fixed list (10,15,20,30 Minutes).
- Role/task dropdowns: e.g. B9:C23, I9:J23 → list from $Q$1:$Q$63 on each week tab.
- Category dropdowns: e.g. E9:E23, L9:L23 → list from Settings.

## Formulas by Sheet

- **Settings**: 1099 formulas. Purpose: Provides reference values used across sheets (year settings, funding codes, etc.).
- **START HERE - DATA ENTRY TAB**: 784 formulas. Purpose: Contains supporting calculations.
- **Student Caseload**: 2 formulas. Purpose: Links staff to student assignments, auto-populates dropdowns in logs.
- **PARS Summary**: 143 formulas. Purpose: Aggregates weekly logs into compliance-level summaries (PARS rollups, staff totals).
- **Para Roles and Responsibilities**: No formulas.
- **SAMPLE Work Log**: 338 formulas. Purpose: Demonstration of work log mechanics with prefilled formulas.
- **Weekly Tabs (Week 1–52)**: ~340 formulas each. Purpose: Tracks daily/weekly instructional minutes, auto-calculates totals by category (prep, instruction, supervision, PARS).