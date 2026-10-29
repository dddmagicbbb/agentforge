---
name: detail-design
description: Template for a developer's detailed design. Used by dev-* agents when writing docs/design/detail/dev-N.md before implementation.
---
# Detailed design template (docs/design/detail/dev-N.md)
1. Assigned tasks and feature IDs
2. File list: path of each file to create and one line on its responsibility (all inside the owned scope)
3. Main functions and classes: signatures, input validation, error handling
4. Contracts used: APIs called and APIs provided (use the names in the contract files exactly)
5. Screen states (when there are screens): loading / empty / error / success
6. Test list: acceptance criterion per feature ID -> test name
7. Changes needed in the contract or common modules (if any, stop before implementing and report)
