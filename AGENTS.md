# miWorklog – Overview Rules

## Project Purpose

This project automates and streamlines the assignment of users to log their worktime hours in compliance with grant requirements. It is designed as a lightweight, standalone system built around Google Sheets and Apps Script to ensure accurate and efficient time tracking.

---

## Architecture Focus

- **Modular Design**
  - Clear separation of logic layers for maintainability and testability.  
  - Each component should be independently testable.

- **Google Sheets as UI + Data Store**
  - All input, processing, and output are managed through sheets.  
  - Reference tabs act as the source of truth.  
  - Output tab serves as the canonical record of mappings.

- **Script Logic**
  - Functions are grouped by layer and responsibility.  
  - Side-effect functions (e.g., writing to sheet, logging results) are abstracted.

- **Strict Separation of Concerns (SoC)**
  - Each module or function must have a single, well-defined responsibility to enhance maintainability and reduce complexity.  
  - For example, data validation should be handled separately from data transformation and output generation, ensuring changes in one area do not unintentionally affect others.

---

## System Conventions

- **Naming**
  - Function names use camelCase (`mapWorklogEntry`, `validatePatterns`).  
  - Sheet names are lowercase with underscores (`input_data`, `processing_tab`).

- **Documentation**
  - Each function includes a short docstring describing purpose, inputs, and return type.  
  - Sheet structure and function expectations are documented in a shared README tab.  
  - Developers must review `docs/coding_conventions.md` before writing any code.  
  - Developers must review `docs/script_dev_notes.md` before modifying any script.  
  - **Mandatory JSDoc for all functions** with the following template:
    ```
    /**
     * [Short description of the function's purpose]
     * @param {Type} paramName - [Description of parameter]
     * @returns {Type} [Description of return value]
     */
    ```

- **Test Data**
  - Each phase includes known control cases that must pass before production deployment.  
  - Edge cases are stored in a `test_cases` sheet with expected results.

- **Security Conventions**
  - Validate and sanitize all user inputs to prevent injection and ensure data integrity.  
  - Use principle of least privilege for any external integrations or API calls.  
  - Avoid storing sensitive information in plain text within sheets or scripts.  
  - Log security-relevant events and errors without exposing sensitive data.

---

## Best Practices

- **Prioritize Performance and UX**
  - Optimize scripts and sheet operations to minimize latency and improve responsiveness, enhancing user experience.  
  - For example, batch writes to sheets instead of frequent single-cell updates to reduce execution time.

- **Code Review Checklist**
  - Adherence to Strict Separation of Concerns (SoC) principles.  
  - Complete and accurate JSDoc documentation for all functions.  
  - Evaluation of performance impacts and optimization opportunities.  
  - Verification of input validation and sanitization measures.

---

## Workflow Instructions

- **Initialization Steps**
  - Review the project context and requirements thoroughly before starting any task.  
  - Analyze the user request or issue to understand scope and impact.

- **Main Workflow Phases**
  - **Design & Planning:** Outline the solution approach, data flow, and modular components.  
  - **Implementation:** Develop code following architecture and conventions.  
  - **Validation:** Test with control and edge cases to ensure correctness and stability.

- **Completion Criteria**
  - All tests pass successfully.  
  - Documentation is updated to reflect changes.  
  - Code reviews confirm adherence to standards and best practices.

---

## Current State

Review `docs/script_directory_overview.md` at the start of each task to fully understand the codebase.

---

## Documentation

Whenever any file in `script` is updated, before closing the task you must update:

- `docs/script_directory_overview.md`  
- `docs/script_dev_notes.md`  

with all relevant changes, including the date and time of the verified change.
