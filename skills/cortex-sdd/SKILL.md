---
name: cortex-sdd
description: Specification-Driven Development with OpenSpec, Cortex-IA task DAG decomposition, and closed-choice alignment.
---

# Cortex-IA Specification-Driven Development (SDD)

Use this skill when tackling features or changes that span multiple files, involve API contracts, or require rigorous architectural boundaries.

## Core Rules

1. **RFC 2119 Delta Specifications**:
   - Write specifications using `MUST`, `MUST NOT`, `SHOULD`, and `MAY`.
   - Store proposals in `openspec/changes/<change-name>/proposal.md` and delta specs in `specs/`.
   - Validate structure using `cortex_openspec` (action: "validate", workflow: "sdd-lite|sdd-full", phase: "...").

2. **Task Decomposition Limits**:
   - Decompose work into discrete, dependency-aware task units in the Cortex SQLite DAG via `cortex_work` (action: "create").
   - Maximum lines of code per task node: **<= 350 lines** for TypeScript/Python; **<= 500 lines** for Go/Rust/Java.
   - Stacked units:
     - *Layer 1 (Contracts)*: Types, interfaces, schemas, and test scaffolding.
     - *Layer 2 (Core)*: Domain business logic and internal algorithmic engines.
     - *Layer 3 (Integration)*: Public APIs, CLI/TUI wiring, and integration tests.

3. **Closed-Choice Architectural Alignment**:
   - When facing architectural forks or ambiguous trade-offs, call `cortex_ask_choice` to allow the user to select between 2 to 4 concrete options.

4. **Task Lifecycle & Concurrency Protocol**:
   - Tasks start in `backlog` or `ready`.
   - Implementers claim a task using `cortex_work` (action: "claim").
   - Reserve files using `cortex_lease` (action: "lease") before editing.
   - Transition to `in_review` upon completion using `cortex_work` (action: "transition").
   - Implementers CANNOT self-approve.
   - Cortex-IA remains the sole authority for task claims, leases, and approvals; ephemeral subagents act as bounded leaf executors under this authority.

