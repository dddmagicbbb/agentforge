---
name: forge-init
description: Generates the PRD and the CLAUDE.md PROJECT section from the requirements file. Use only when the user types /forge-init.
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Glob
---
# Input
- .agentforge/requirements.md : the user's original requirements
- .agentforge/forge.config.json : number of developers, whether UI/UX design is used (uiDesign), language
- .agentforge/templates/prd.md : PRD template (chapter order is fixed)

# Procedure
1. Read the requirements and ask at most 5 questions about anything ambiguous. Do not write any file before you get the answers.
2. Write docs/prd.md following the chapter order of the template.
   - Give every feature an ID (starting at F-001), a priority (must/optional) and acceptance criteria (Given/When/Then).
   - If uiDesign is false, leave the screens chapter as "not applicable".
3. Replace only the <!-- AGENTFORGE:PROJECT:BEGIN --> to END section of CLAUDE.md.
   - One-line project introduction, tech stack, install/test/build commands, folder structure.
   - Do not edit the other sections or the fixed rules. Keep the whole CLAUDE.md within 200 lines.
4. At the end, print a list of "items for a human to confirm" (assumptions made, reasons for technology choices).

# Forbidden
- Adding features that are not in the requirements. If something seems necessary, write it only in a "proposals" section.
- Writing numbers such as schedules or headcount without a basis.
