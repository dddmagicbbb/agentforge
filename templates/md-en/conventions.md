---
name: conventions
description: Common working rules for the project (language, commits, report format). Used by all development and review agents.
---
# Common working rules
- Write answers and documents in {{LANG}}; code identifiers in English.
- Commit message: `[agent] task-ID summary` (example: `[dev-1] T-101 list orders`)
- One commit carries one task ID only.
- Completion report: docs/report-<agent>.md
  | Task ID | Result | Changed files | Tests | Open issues |
- Never write secrets (keys, passwords) in code, documents or logs.
