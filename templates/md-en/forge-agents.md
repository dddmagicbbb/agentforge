---
name: forge-agents
description: After the analysis (docs/tasks.md) and system design are done, generates or completes the per-developer agents, paired review agents, developer-specific skills and scope files. Use only when the user types /forge-agents.
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Glob, Bash(bash scripts/check-forge.sh)
---
# Input
- developers (N) and agents (model per agent) in .agentforge/forge.config.json
- docs/tasks.md : task IDs, feature IDs, owning developer, owned folders
- docs/design/system.md, the API contract files, docs/design/ui/ (if present)
- .agentforge/templates/dev.md, review.md, dev-skill.md

# Procedure (i = 1..N)
1. From tasks.md, extract the feature IDs, owned folders and domain name of dev-i. If the owned folders overlap with another developer, do not create files; report the overlapping list and stop.
2. If .claude/agents/dev-i.md already exists, fix only the assigned features and folders according to tasks.md. If not, create it from the template by filling in every placeholder `{{N}} {{DOMAIN}} {{PATHS_INLINE}} {{MODEL}} {{SKILLS}} {{FEATURES}} {{UI_READ}}`. If any is left, check-forge.sh fails. Do not change the frontmatter keys or the work order. The same applies to review-i.md. The sources of the values are:
   - `{{N}}` : developer number i
   - `{{DOMAIN}}` : the domain name in tasks.md
   - `{{PATHS_INLINE}}` : the owned folders joined by commas on one line
   - `{{MODEL}}` : the dev-i / review-i value in forge.config.json agents. A model alias if the provider is claude, otherwise `inherit`
   - `{{SKILLS}}` : the `  - devi-<domain>` lines to append to the frontmatter skills (plus lines for imported skills, if any). End each line with a newline
   - `{{FEATURES}}` : the list of assigned feature IDs (tasks.md)
   - `{{UI_READ}}` : if uiDesign is on, `, docs/design/ui/` for dev and ` / UI design` for review. If off, an empty string
3. Create .claude/devs/dev-i.paths (owned folders + docs/design/detail/dev-i.md + docs/report-dev-i.md) and review-i.paths (docs/review/dev-i.md).
4. Fill in the empty sections of .claude/skills/devi-<domain>/SKILL.md (create it if missing).
   - First sentence of the description: "Use only for dev-i tasks."
   - Body: domain terms, business rules, owned APIs and tables, test data examples. At most 500 lines. Do not invent rules that are not in the PRD or the design.
5. Update the tables in the AGENTFORGE:DEVS / SKILLS sections of CLAUDE.md.
6. Run bash scripts/check-forge.sh. If it fails, fix and run again. If it fails 3 times in a row, stop and report.
