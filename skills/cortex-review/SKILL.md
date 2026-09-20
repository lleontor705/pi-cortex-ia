---
name: cortex-review
description: Independent adversarial verification, AST delta checking, test oracles, and correction budget enforcement.
---

# Cortex-IA Independent Review & Verification

Use this skill when auditing completed implementation tasks, verifying git diffs, checking AST cycles, and issuing gate approvals.

## Core Rules

1. **Independent Review Requirement**:
   - The implementing agent cannot approve its own work.
   - Reviewer audits git diff, executes deterministic test oracles, and checks linting.

2. **AST Delta & Cycle Regression Gate**:
   - Query AST cycles via `cortex_ast` (command: "cycles") to ensure no circular import regressions.
   - Inspect blast-radius and callers to verify no unexpected coupling spikes occurred.

3. **Correction Budget Enforcement**:
   - If a candidate defect is identified, the maximum allowed lines for corrective edits is:
     $$\text{Budget} = \min(200, \lceil \Delta_{original} / 2 \rceil)$$
   - If a proposed fix exceeds this budget, do not re-attempt automated fixes; persist the minimal failure locality in Cortex memory (`cortex_save` with type: "bugfix") and escalate to the user with `cortex_ask_choice`.

4. **Deterministic Evidence Only**:
   - Only approved test suites and verifiable compiler outputs constitute evidence.
   - Narrative claims ("all tests pass") without tool execution receipt are invalid.

5. **Approval Gate**:
   - Grant approval via `cortex_work` (action: "approve", verdict: "PASS", evidence: "<test-run-id>", revision: <current_rev>).
   - CAS revision checking ensures tasks are not approved against stale intermediate state.
   - Approval unlocks all downstream dependent tasks in the SQLite DAG.

