---
name: tdd
description: Write tests first, confirm they fail, implement, confirm they pass. Used by agents that write feature code.
---
# TDD procedure
1. Write the tests from chapter 6 (test list) of the detailed design first.
2. Run them and confirm they fail. If they do not fail, the tests are wrong.
3. Make the minimal implementation that passes the tests.
4. Run the whole test suite again. If other tests break, fix them and then commit.
- Replace external APIs with the mock responses in the contract.
