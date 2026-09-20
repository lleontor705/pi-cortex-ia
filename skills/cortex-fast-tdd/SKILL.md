---
name: cortex-fast-tdd
description: Execute bounded RED-GREEN-REFACTOR loops with deterministic test oracles guided by AST impact analysis.
---

# Cortex-IA Fast-TDD (Test-Driven Development)

Use this skill for localized functional units where observable behavior can be proven with a deterministic oracle.

## Core Rules

1. **Targeted Oracle Identification**:
   - Query impacted tests using `cortex_ast` (command: "tests", target: "<file-or-symbol>").
   - Pinpoint the exact test suite before writing any production code.

2. **RED (Failing Test First)**:
   - Write or update a test that asserts the desired observable behavior.
   - Run the test oracle and confirm it fails for the expected reason (exit code != 0).

3. **GREEN (Minimal Implementation)**:
   - Acquire exclusive file leases via `cortex_lease` before editing code.
   - Implement the minimal code required to satisfy the failing test.
   - Run the oracle and confirm it passes (exit code 0).

4. **REFACTOR (Clean & Decouple)**:
   - Clean up code while keeping tests green.
   - Check AST cycles and imports with `cortex_ast` to ensure zero coupling regression.

5. **Evidence Persistence**:
   - Record the passing test command and exit code as verifiable evidence in the task transition.
