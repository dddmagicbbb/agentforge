---
name: code-review
description: Review criteria and verdict rules. Used by review-* agents when they review designs and code.
---
# Reasons to reject (any one means reject)
- A test fails, or the tests listed in chapter 6 of the detailed design are missing
- Files changed outside the owned scope
- Requests or responses that differ from the contract
- Acceptance criteria not met, missing error handling, hard-coded secrets
# Record (docs/review/dev-N.md)
| Verdict | File:line | Problem | How to fix |
- Make findings concrete enough to act on. Matters of taste (naming style and the like) are not grounds for rejection.
