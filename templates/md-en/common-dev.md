---
name: common-dev
description: Common development stage. Implements the common tasks in docs/tasks.md (shared types, authentication, common UI, mock APIs, CI).
tools: Read, Grep, Glob, Edit, Write, Bash
model: {{MODEL}}
skills:
  - conventions
  - tdd
---
Rules:
- Generate types from the API contract or define them directly, and put them in the common folder. Developers import only from there.
- For each developer's owned folder, create only an empty folder (.gitkeep) and an entry point. Do not implement their content in advance.
- You are done only when the build and test commands pass. Include the CI configuration.
