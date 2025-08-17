# MI Worklog User Guide

## Table of Contents
1. [Introduction](#introduction)  
2. [Getting Started](#getting-started)  
3. [Understanding the Interface](#understanding-the-interface)  
4. [Core Features](#core-features)  
5. [Daily Usage](#daily-usage)  
6. [Weekly and Monthly Processes](#weekly-and-monthly-processes)  
7. [Troubleshooting](#troubleshooting)  
8. [Frequently Asked Questions](#frequently-asked-questions)  

---

## 1. Introduction

MI Worklog is a simple, script-driven add-on for Google Sheets that replaces complex, formula-heavy worklogs with an easy, guided interface. It was built for K-12 instructional staff and administrators who need to:

- Log daily work time and activities without wrestling with formulas  
- Manage caseloads (students or clients) in one place  
- Produce audit-ready weekly and monthly compliance reports  
- Keep a clear, uneditable record of past entries for review  

Whether you’re a teacher, paraprofessional, support staff member, or district administrator, MI Worklog guides you through each step—so you can spend less time on spreadsheets and more time on instruction.

## 2. Getting Started

### 2.1 Prerequisites
- A Google Workspace (Gmail) account  
- Access to Google Sheets with permission to create or edit spreadsheets  

### 2.2 Sheet Preparation
1. In Google Drive, create a new Google Sheet.  
2. Rename the default tab to **Settings**.  
3. Add three more tabs and name them **Caseload**, **Worklog**, and **PARS**.  

### 2.3 Installing the Script
1. In your Google Sheet, click **Extensions → Apps Script**.  
2. In the Apps Script editor, remove any placeholder code.  
3. For each file in this project’s `scripts/` folder, create a matching file in the editor and paste its contents:
   - [`bootstrap.gs`](scripts/bootstrap.gs:1)  
   - [`Code.gs`](scripts/Code.gs:1)  
   - [`controllers.sidebar.gs`](scripts/controllers.sidebar.gs:1)  
   - All `services.*.gs` files in `scripts/services/`  
   - [`Sidebar.html`](scripts/Sidebar.html:1)  
4. Click Save (Ctrl+S or File → Save).  

### 2.4 Initializing the Workbook
1. In the Apps Script editor, open the function selector and choose **bootstrapWorkbook()**.  
2. Click ▶️ Run.  
3. If prompted, authorize the script to access your spreadsheet.  
4. A confirmation alert will appear:  
   > “Setup complete. Required tabs and headers are ready.”  

### 2.5 Activating the Worklog Menu
1. Return to your Google Sheet and reload the browser tab.  
2. You’ll now see a **Worklog** menu in the top bar.  
3. Use **Worklog → Open Sidebar**, **Close Week**, or **Rebuild Reports** to begin.  

## 3. Understanding the Interface

### 3.1 Google Sheets Layout  
At the bottom of your spreadsheet you’ll see four tabs (sheets):  
- **Settings** – Define work hours, activity codes, and reporting options.  
- **Caseload** – List students or clients you serve.  
- **Worklog** – Your daily time entries appear here.  
- **PARS** – State (“Personnel Activity Report Summary”) time-reporting details.  

Click any tab name to switch views.

### 3.2 The Worklog Sidebar  
Open the sidebar from the menu: **Worklog → Open Sidebar**. The sidebar contains:  
- **Date**: Pick the day you worked.  
- **Start Time / End Time**: Enter in HH:MM format.  
- **Activity Code**: Choose from codes defined in Settings.  
- **Student / Case** (optional): Select a caseload entry.  
- **Notes** (optional): Add comments or context.  
- **Save Entry** button: Validates and records your time.  
- **Clear Form** button: Resets all fields.
- **Staff Settings** section: Configure your staff profile including full name, email address (read-only), reporting building, and funding source.

Validation errors (e.g. end time before start time) appear inline with red text.

### 3.3 Menu Commands  
Use the **Worklog** menu for these commands:  
- **Open Sidebar** – Add a new time entry.  
- **Close Week** – Lock the current week and generate reports.  
- **Rebuild Reports** – Re-calculate all audit-ready summaries from scratch.  

### 3.4 Staff Settings

Access **Staff Settings** via the sidebar: in Google Sheets, select **Worklog → Open Sidebar**, then scroll to the **Staff Settings** section below the entry form.
Here you can configure:

- **Full Name**: Your display name (required).
- **Email Address**: Your account email (read-only).
- **Reporting Building**: Select from buildings configured in **Settings**.
- **Funding Source**: Select from funding sources (default options: Title I, Title III, 31A, Section 41, GSRP, General Funds).

Click **Save Settings** to persist your profile. These details integrate with validation and audit systems and appear in reports.

## 4. Core Features

MI Worklog provides a set of built-in tools to simplify time tracking and compliance reporting:

### 4.1 Centralized Settings  
All configuration lives in the **Settings** sheet. Here you can:  
- Define your standard work hours (start/end time)  
- Create or edit activity codes (e.g. “Lesson Planning,” “IEP Meeting”)  
- Specify PARS reporting options (district codes, rounding rules)  
Changes take effect immediately across the workbook.

### 4.2 Caseload Management  
Use the **Caseload** sheet to maintain a list of students or clients you serve:  
- Add one row per student/client with any identifying details  
- Edit or remove entries as assignments change  
When recording an activity, you can link a time entry to a caseload item for accurate service tracking.

### 4.3 Daily Time Entry with Validation  
Time entries are entered via the sidebar form (**Worklog → Open Sidebar**):  
- Pick a date, start/end times in HH:MM format, and an activity code  
- Optionally select a caseload item and add notes  
- Built-in checks prevent mistakes (e.g. end time before start time)  
- Successful entries appear immediately in the **Worklog** sheet  

### 4.4 PARS Time Reporting  
The **PARS** sheet aggregates hours by district reporting rules:  
- Tracks state-required time buckets automatically  
- Applies rounding or minimum-time rules configured in Settings  
- Ensures your weekly totals comply with state guidelines without manual formulas  

### 4.5 Audit Trail & Immutable Reports  
Every time you save, MI Worklog logs an audit entry behind the scenes. When you close a week:  
- Entries for that week become locked and uneditable  
- A new summary row is added to the **Reports** sheet for review or export  
- Audit logs let administrators trace who made each change and when  

This combination of validation, automation, and an unalterable history means your logs are always accurate and ready for any audit.

## 5. Daily Usage

Before recording daily entries, ensure your staff profile is up to date by opening the **Staff Settings** section in the sidebar (**Worklog → Open Sidebar**). Your email address is read-only and auto-populated from your session.

Follow these steps each day to record your work:

1. Open the Sidebar  
   - In the sheet menu, click **Worklog → Open Sidebar**.

2. Fill in the Form Fields  
   - **Date**: Click the date picker and choose today’s date (e.g. 2025-08-17).  
   - **Start Time / End Time**: Enter times in 24-hour HH:MM format (for example, 08:00 and 12:30).  
   - **Activity Code**: Click the dropdown and select one of your codes (e.g. “Lesson Planning”).  
   - **Student/Case (optional)**: Click the dropdown and choose a student from your **Caseload**.  
   - **Notes (optional)**: Type any details, like “Reviewed IEP goals.”

3. Example Entry  
   - Date: 2025-08-17  
   - Start Time: 08:00  
   - End Time: 09:30  
   - Activity Code: Lesson Planning  
   - Student: Jane Doe  
   - Notes: “Prepared materials for math center.”

4. Save Your Entry  
   - Click **Save Entry**.  
   - If there are errors (for instance, end time before start time), you’ll see a red message below the affected field.  
   - Once valid, the sidebar closes and your new row appears in the **Worklog** sheet with a timestamp and your initials.

5. Verify in the Worklog Sheet  
   - Switch to the **Worklog** tab to confirm your entry.  
   - Each row displays: Date, Start, End, Activity, Caseload (if any), Notes, and an Audit ID.

6. Clearing the Form  
   - Use **Clear Form** in the sidebar to reset all fields and start a fresh entry.

With these steps, you can quickly capture each block of time without manual formulas.

## 6. Weekly and Monthly Processes

### 6.1 Closing a Week  
1. In the sheet menu, select **Worklog → Close Week**.  
2. In the date picker, choose the last day of the week you want to lock (for example, the Friday date).  
3. Click **OK**.  
4. MI Worklog will:  
   - Lock all entries dated within that week (they become read-only).  
   - Generate a summary row in the **Reports** sheet showing hours by activity code.  
   - Record audit information so you can trace when and by whom the week was closed.

Use this at the end of each week to finalize your time log.

### 6.2 Rebuilding Reports  
If you ever update your Settings (activity codes or PARS rules) or Caseload and need to recalculate past summaries:  
1. Select **Worklog → Rebuild Reports**.  
2. Confirm the action when prompted.  
3. MI Worklog will clear existing summary rows in **Reports** and re-generate them from all unlocked data.

### 6.3 Generating a Monthly Summary  
1. Click the **Reports** tab.  
2. In the header row, enable the filter on the date column.  
3. Use the filter menu to select the month you wish to view (e.g. “August 2025”).  
4. Copy the filtered rows to a new sheet or download as PDF/Excel via **File → Download**.

This gives you a ready-to-share monthly report without manual calculations.

## 7. Troubleshooting

**Authorization Required**  
- Error: “You need permission to perform this action.”  
- Solution: In the Apps Script editor, run any function (e.g. `bootstrapWorkbook()`) and grant the requested permissions.

**Missing Worklog Menu**  
- Symptom: No “Worklog” menu appears after reload.  
- Solution: Confirm you ran [`bootstrapWorkbook()`](scripts/bootstrap.gs:5). If not, run it in the Script editor, then reload the sheet.

**Blank or Unresponsive Sidebar**  
- Symptom: Sidebar loads empty or buttons do nothing.  
- Solution: Reload the sheet. Ensure your **Settings** sheet has at least one activity code defined.

**Validation Errors Won’t Clear**  
- Symptom: Form keeps showing errors even with correct values.  
- Solution: Check you’re using 24-hour HH:MM format. Ensure End Time is later than Start Time.

**Reports Not Updating**  
- Symptom: Summaries in **Reports** sheet don’t match expected hours.  
- Solution: If you changed Settings or Caseload, run **Worklog → Rebuild Reports**.

## 8. Frequently Asked Questions

**How can I correct a time entry?**  
- If the entry is in an unlocked week, delete or edit the row in the **Worklog** sheet.  
- If the week is locked, enter a new correction entry and note the original row’s Audit ID.

**How do I add a new activity code?**  
- Open the **Settings** sheet and add the code name and description in a new row.

**Who can modify Settings and Caseload?**  
- Any user with edit access to this spreadsheet.

**How do I export my logs?**  
- Use the filter on the **Reports** or **Worklog** sheet, then choose **File → Download → PDF/Excel**.

**Can I use AM/PM times?**  
- No. Always enter times in 24-hour format (HH:MM).

----
End of guide.