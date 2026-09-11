# pi-cortex-ia 🧠⚡

**Deterministic Multi-Agent Control Plane & Ergonomic Engineering Harness for Pi, powered by Cortex-IA.**

[![pi package](https://img.shields.io/badge/Pi-package-00C4FF)](https://pi.dev/packages/pi-cortex-ia)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![tests](https://img.shields.io/badge/tests-100%25%20passing-10B981)](tests/)

`pi-cortex-ia` brings the enterprise-grade, deterministic concurrency control of **Cortex-IA** to the **Pi** coding agent ecosystem (`@earendil-works/pi-coding-agent`), enriched with the finest ergonomics and token-economy patterns inspired by modern developer harnesses (such as `gentle-pi`).

---

## 🌟 Key Capabilities

1. 🔒 **Exclusive File Leases (`cortex_lease`)**:
   - Eliminates race conditions in multi-agent environments.
   - Requires agents to atomically reserve workspace-relative paths with TTL locks before editing.

2. 🎯 **ACID Task DAG & CAS Concurrency (`cortex_work`, `cortex_board`)**:
   - Optimistic Compare-and-Swap (CAS) revision locks in SQLite.
   - Tasks progress through deterministic states: `backlog ➔ ready ➔ in_progress ➔ in_review ➔ done`.
   - Automatic reactive unlocking of dependent tasks when prerequisites pass review.

3. 🛡️ **Mandatory Independent Review & Budget Gates**:
   - Implementers cannot self-approve. Reviewers must grant `PASS` with test evidence.
   - **Correction Budget Enforcement**: Restricts automated bugfix patches to $\min(200, \lceil \Delta_{original} / 2 \rceil)$ lines to prevent destructive runaway rewrites.

4. 🔇 **Quiet Tools Context Shield (`cortex_quiet_bash`)**:
   - Intercepts and folds massive compiler and shell outputs into compact previews (head & tail).
   - Reduces context window consumption by 70–90% during diagnostic and build phases.

5. ❓ **Interactive Closed-Choice Modals (`cortex_ask_choice`)**:
   - In-terminal 2–4 option selector navigable with arrow keys or number keys, eliminating ambiguity in architectural decisions.

6. 🔍 **Universal Skill Discovery Registry (`.cortex-ia/skill-registry.md`)**:
   - Automatically scans installed skills across Pi, Gemini, Claude, Cursor, and OpenCode, keeping a synchronized index.

7. 📊 **Live Real-time Web Dashboard (`/cortex:web`)**:
   - Instant access to the embedded single-binary Cortex-IA web dashboard with Server-Sent Events (SSE) at `http://127.0.0.1:7331`.

---

## 🚀 Quick Start

### 1. Installation into Pi
In your local repository or globally:
```bash
# Link or install locally into Pi
pi install -l D:\lleontor705\pi-cortex-ia
```

### 2. Available Slash Commands
Within your Pi interactive session:
```text
/cortex:status    Check active board, task DAG counters, and file leases
/cortex:doctor    Verify environment health and binary availability
/cortex:web       Launch embedded real-time web dashboard (port 7331)
/cortex:skills    Discover and sync universal skills into .cortex-ia/skill-registry.md
/cortex:recover   Sweep and release expired claim tokens and file locks
```

### 3. Available Tools for the Agent
- `cortex_board`: Query and manage task boards (`list`, `status`, `create`).
- `cortex_work`: Task lifecycle management (`claim`, `renew`, `transition`, `approve`, `recover`).
- `cortex_lease`: Exclusive file reservation (`lease`, `renew`, `release`).
- `cortex_ask_choice`: Interactive closed-choice modal in terminal.
- `cortex_quiet_bash`: Quiet shell execution with automatic output folding.
- `cortex_doctor`: System diagnostic inspection.

---

## 🎨 Themes & Persona

- **Theme**: Includes `Cortex-Cyan` (`themes/cortex-cyan.json`), an electric cyan, slate, and emerald visual theme.
- **Prompt**: Includes `prompts/cortex-engineer.md` defining the deterministic systems architect persona.
- **Skills**: Ships with `skills/cortex-sdd` (Specification-Driven Development) and `skills/cortex-review` (Independent adversarial review).

---

## 🧪 Testing & Verification

```bash
npm run typecheck    # Strict TypeScript verification
npm test             # Deterministic test runner
```

---

## 📄 License
MIT © Luis Leon
