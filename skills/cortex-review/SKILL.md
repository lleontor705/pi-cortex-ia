---
name: cortex-review
description: Independent adversarial verification, diff auditing, test oracles, and correction budget enforcement.
---

# Cortex-IA Independent Review & Verification

Use this skill when auditing completed implementation tasks, verifying git diffs, and issuing gate approvals.

## Core Rules

1. **Independent Review Requirement**:
   - The implementing agent cannot approve its own work.
   - Reviewer audits git diff, executes deterministic test oracles, and checks linting.

2. **Correction Budget Enforcement**:
   - If a candidate defect is identified, the maximum allowed lines for corrective edits is:
     $$\text{Budget} = \min(200, \lceil \Delta_{original} / 2 \rceil)$$
   - If a proposed fix exceeds this budget, do not re-attempt automated fixes; escalate to the user with `cortex_ask_choice`.

3. **Deterministic Evidence Only**:
   - Only approved test suites and verifiable compiler outputs constitute evidence.
   - Narrative claims ("all tests pass") without tool execution receipt are invalid.

4. **Approval Gate**:
   - Grant approval via `cortex_work` (action: "approve", verdict: "PASS", evidence: "<test-run-id>").
   - This unlocks all downstream dependent tasks in the SQLite DAG.
