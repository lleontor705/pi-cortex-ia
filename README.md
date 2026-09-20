# pi-cortex-ia 🧠⚡

**Deterministic Multi-Agent Control Plane & Ergonomic Engineering Harness for Pi, powered by Cortex-IA.**

[![pi package](https://img.shields.io/badge/Pi-package-00C4FF)](https://pi.dev/packages/pi-cortex-ia)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![tests](https://img.shields.io/badge/tests-100%25%20passing-10B981)](tests/)

`pi-cortex-ia` brings the enterprise-grade, deterministic concurrency control of **Cortex-IA** and the persistent cognitive memory & AST code graph of **Cortex** to the **Pi** coding agent ecosystem (`@earendil-works/pi-coding-agent`), featuring compact token-efficient adaptive UX and width-bounded themed status components.

---

## 🌟 Dual-Engine Architecture

`pi-cortex-ia` seamlessly unifies two complementary engines:

1. **Cortex-IA (`cortex-ia.exe`)**:
   - Local ACID Task DAG in SQLite with optimistic CAS (Compare-And-Swap) revision locks.
   - Exclusive workspace-relative file leases (`cortex_lease`) with TTL.
   - Dual Ledger (verified architectural facts + orchestrator progress assessments).
   - OpenSpec SDD (Spec-Driven Development) workflow manager.
   - Bounded Bugfix Correction Budget: $\min(200, \lceil \Delta_{original} / 2 \rceil)$ lines.
   - Real-time embedded Web Dashboard (SSE) on `http://127.0.0.1:7331`.

2. **Cortex Persistent Memory & AST Graph (`cortex.exe`)**:
   - SOTA Adaptive-RAG & HippoRAG associative retrieval across project sessions.
   - Zero-CGO 2-Pass Static AST Parser (Go, TypeScript, JavaScript, Python, Rust, C++).
   - Dependency cycle regression detection (`cortex_ast` cycles).
   - Blast-radius and caller impact analysis (`cortex_ast` impact).
   - Compact Repo-Map generation for LLM context optimization.

---

## 🚀 Key Capabilities

### 1. 🔒 Exclusive File Leases (`cortex_lease`)
Eliminates race conditions in multi-agent environments. Agents must atomically reserve workspace-relative paths before editing, preventing conflicting modifications.

### 2. 🎯 ACID Task DAG & CAS Concurrency (`cortex_work`, `cortex_board`)
Tasks progress through deterministic states:
$$\text{backlog} \longrightarrow \text{ready} \longrightarrow \text{in\_progress} \longrightarrow \text{in\_review} \longrightarrow \text{done}$$
Prerequisite satisfaction automatically unlocks downstream ready tasks.

### 3. 🛡️ Mandatory Independent Review & Correction Budget
Implementers cannot self-approve. Reviews require deterministic test execution receipts (`cortex_work` action: "approve"). If bugs are found, patches are constrained to $\min(200, \lceil \Delta / 2 \rceil)$ lines to stop runaway rewrites.

### 4. 🧠 Long-Term Cognitive Memory (`cortex_search`, `cortex_save`, `cortex_context`)
Save decisions, bugfix root causes, and non-obvious learnings (`cortex_save`). Later sessions query these memories semantically or associatively with HippoRAG (`cortex_search`).

### 5. 🕸️ AST Structural Code Graph (`cortex_ast`, `cortex_ingest`)
Query symbol definitions, callers, blast radius of uncommitted changes, and verify that changes introduce zero circular dependencies before granting approval.

### 6. 🤖 Canonical Subagents Orchestration (`cortex_subagent`)
Dispatch specialized ephemeral subagents with isolated context:
- `discovery`: Project onboarding profile (`.cortex-ia/discovery.md`).
- `investigate`: Read-only diagnostics and root-cause analysis.
- `planner`: SDD specification contracts and vertical-slice DAGs ($\le 350$ LOC).
- `implement`: Claims 1 task, leases files, writes code, runs unit tests.
- `reviewer`: Adversarial audit, AST cycle checks, test oracle verification.

### 7. 🔇 Quiet Tools Context Shield (`cortex_quiet_bash`)
Intercepts and folds massive compiler and shell outputs into compact previews (head & tail). Reduces context window consumption by 70–90% during diagnostic and build phases.

### 8. ❓ Interactive Closed-Choice Modals (`cortex_ask_choice`)
In-terminal 2–4 option selector navigable with arrow keys or number keys, eliminating ambiguity in architectural decisions.

### 9. 🎨 Adaptive Themed Ergonomics
- **Compact Banner**: Themed compact startup summary consuming the shared snapshot store with zero I/O during render.
- **Theme**: `Cortex-Cyan` theme (`themes/cortex-cyan.json`) providing semantic tokens (`accent`, `dim`, `warning`, `success`).
- **Widgets & Panels**: Width-bounded TUI status bar and on-demand detail views (`/cortex:board`, `/cortex:status`) degrading gracefully without forced fullscreen assumptions.

---

## ⚖️ Authority and Delegation Architecture

- **Cortex-IA as Sole Work Authority**: `cortex-ia` CLI is the sole task authority for task DAG states, claims, leases, revisions, and approval gates. The Pi extension package is a view and integration surface that never bypasses or replaces Cortex-IA control.
- **Bounded Pi Subagent Runner**: Child subagents dispatched via `cortex_subagent` run as bounded child processes using Node (`process.execPath`) with resolved JavaScript entries, `shell: false`, and raw prompt argv data on Windows. Subagents fail closed without direct `pi.cmd` execution or unauthorized work mutations.


## 💻 Available Tools for the Agent

| Tool | Engine | Description |
|---|---|---|
| `cortex_board` | Cortex-IA | Manage and inspect task boards and DAG topology (`list`, `status`, `create`). |
| `cortex_work` | Cortex-IA | Deterministic task lifecycle (`claim`, `renew`, `transition`, `approve`, `recover`). |
| `cortex_lease` | Cortex-IA | Exclusive file reservations with TTL before editing (`lease`, `renew`, `release`). |
| `cortex_ledger` | Cortex-IA | Record verified facts and progress assessments in Dual Ledger. |
| `cortex_openspec` | Cortex-IA | Validate, list, create, and archive OpenSpec SDD changes. |
| `cortex_delegate` | Cortex-IA | Create and monitor external leaf delegation jobs. |
| `cortex_search` | Cortex | Search persistent memories and past decisions with HippoRAG. |
| `cortex_save` | Cortex | Store decisions, bugfixes, gotchas, or patterns to long-term memory. |
| `cortex_context` | Cortex | Retrieve recent memory context and active project directives. |
| `cortex_ast` | Cortex | Query AST symbols, callers, dependency cycles, blast radius, or repo-map. |
| `cortex_ingest` | Cortex | Ingest codebase AST symbols and knowledge graph into SQLite. |
| `cortex_subagent` | Pi/Cortex | Dispatch a specialized subagent (`discovery`, `investigate`, `planner`, `implement`, `reviewer`). |
| `cortex_ask_choice` | Pi TUI | Interactive closed-choice modal (2–4 options) in terminal. |
| `cortex_quiet_bash` | Pi Shell | Shell execution with automatic output folding to protect context. |
| `cortex_doctor` | Cortex-IA | Health and environment diagnostics. |

---

## ⌨️ Slash Commands

Within your interactive Pi session:
```text
/cortex:status    Check active board, task DAG counters, and file leases
/cortex:board     Display full Task DAG board with real-time status icons
/cortex:doctor    Verify environment health and binary availability
/cortex:web       Launch embedded real-time web dashboard (http://127.0.0.1:7331)
/cortex:skills    Discover and sync universal skills into .cortex-ia/skill-registry.md
/cortex:recover   Sweep and release expired claim tokens and file locks
/cortex:ledger    View verified facts and progress evaluations from Dual Ledger
/cortex:sdd       Inspect active OpenSpec SDD changes and preflight status
/cortex:memory    Show recent cognitive memory context and active sessions
/cortex:agents    List available canonical subagent roles and dispatch syntax
```

---

## 📦 Installation & Usage

### 1. Install locally into Pi
```bash
pi install -l D:\lleontor705\pi-cortex-ia
```

### 2. Verify Health
```bash
/cortex:doctor
```

### 3. Launch Web Dashboard
```bash
/cortex:web
```

---

## 🧪 Testing & Verification

```bash
npm run typecheck    # Strict TypeScript verification (tsc --noEmit)
npm test             # Deterministic test runner (node --test tests/*.test.ts)
```

---

## 📄 License
MIT © Luis Leon
