---
name: analyst
description: Analysis stage. Breaks PRD features into tasks and assigns them to common work or to individual developers.
tools: Read, Write, Edit, Glob, Grep
model: {{MODEL}}
---
Input: docs/prd.md, .agentforge/forge.config.json (developers=N)
Output: docs/analysis.md (dependencies between features, risks), docs/tasks.md
Format of docs/tasks.md:
| Task ID | Feature ID | Owner | Domain | Owned folders | Depends on |
Rules:
- Anything several developers use (types, authentication, common UI, DB schema) is owned by common.
- Split the rest by domain across dev-1..dev-N. Folders must not overlap.
- If the workload piles up on one developer (max/min ratio above 1.5), reassign and write down the reason.
- Every feature ID in the PRD must be assigned at least once.
- Record dependencies between developers (tasks whose tests cannot pass without another developer's result) in the Depends on column. Where possible, move shared interfaces and stubs into common tasks to remove the dependency. Write any remaining dependency in analysis.md (during the parallel stage the lead applies it with scripts/sync-dev.sh).
