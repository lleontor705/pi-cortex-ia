# Adaptive Pi UX Consolidated Design and Handoff

- Artifact status: non-authoritative documentation-only handoff.
- Source revision inspected: `709dae3296203098eeded2da10ff6c52e7742f4e`.
- Source date recorded: `2026-09-12T07:26:22Z`.
- Workspace: `D:/lleontor705/pi-cortex-ia`.
- Related engine workspace: `D:/cortex-ia`.
- Pi UX pinned plan SHA-256: `514b397ae490be48d919271f839e433c34751885ca3dfd00e2b65973551deda7` for `openspec/changes/pi-native-adaptive-ux/plan.md`.
- Work-revise pinned plan SHA-256: `2d43163abaeb5ee9abc7ae39d75379b6e597b680bc16cc3f23d1b47c64c95785` for `D:/cortex-ia/openspec/changes/work-revise/plan.md`.

## 1. Authority and scope boundary

This file is a consolidated technical handoff for the planned adaptive Pi UX work. It is not an OpenSpec source of truth, not a task-definition replacement plan, not an approval record, and not a new production contract.

Authoritative artifacts remain:

1. `openspec/changes/pi-native-adaptive-ux/plan.md` in `D:/lleontor705/pi-cortex-ia`.
2. `openspec/changes/pi-native-adaptive-ux/contracts/1.1.json` through `1.5.json`.
3. Live Cortex-IA work rows on board `pi-native-adaptive-ux`.
4. For the separate engine operation, `D:/cortex-ia/openspec/changes/work-revise/plan.md` and live board `work-revise`.

Do not casually repin any SDD contract after reading this file. If a task definition is stale, use the official `work revise` route only where live lifecycle guards permit it. Do not edit production code as part of this documentation task.

The project decision is a Pi-native adaptive experience with a compact default and on-demand details. The goal is not to replace Cortex-IA, not to replace OpenSpec, and not to create a new model-routing, telemetry, or multi-worktree engine.

## 2. User decisions captured

The following decisions are accepted for this handoff:

- The desired experience is automatic hybrid behavior in the current workspace.
- Compact views are the default.
- Detail panels open on explicit commands or direct user action.
- Canonical SDD remains authoritative for requirements and task contracts.
- The Pi runner remains bounded under Cortex-IA delegation; it is not a new authority plane.
- Cortex-IA remains the sole source for task claims, file leases, work transitions, approvals, and deterministic board state.
- This repository currently targets one workspace engine. Multi-worktree orchestration is inspiration/future work, not current accepted implementation scope.
- Models, telemetry, and worktree extras discussed from gentle-pi are not automatically accepted scope.

## 3. Existing implementation inventory

Current relevant files in `D:/lleontor705/pi-cortex-ia`:

- `package.json`: Pi package manifest. Current `pi.extensions` points to `./extensions/index.ts`; scripts are `npm test` and `npm run typecheck`.
- `.pi/settings.json`: project-local package reference, currently `{"packages":[".."]}`.
- `extensions/index.ts`: aggregate activation entrypoint with a `WeakSet<ExtensionAPI>` duplicate guard.
- `extensions/cortex-banner.ts`: current startup banner; still performs direct board I/O during `session_start` and uses hard-coded ANSI helpers.
- `extensions/cortex-commands.ts`: slash commands for status, doctor, web, skills, recover, ledger, SDD, memory, and agents; still performs direct Cortex calls per command.
- `extensions/cortex-shell.ts`: shell integration surface, scheduled for compact theme routing.
- `extensions/cortex-todo.ts`: `/cortex:board` and `formatTaskLine`; still performs direct board I/O.
- `extensions/cortex-tools.ts`: Cortex task/lease/ledger/openSpec tool registrations.
- `extensions/cortex-memory-tools.ts`: cognitive memory tool registrations.
- `extensions/cortex-subagents.ts`: extension wrapper around the subagent runner.
- `extensions/cortex-quiet.ts`: quiet tool wrapper.
- `lib/cortex-cli.ts`: Cortex CLI adapter and current shared snapshot implementation.
- `lib/cortex-subagents.ts`: Windows-hardened Pi child process runner.
- `lib/cortex-memory-cli.ts`: memory CLI adapter.
- `lib/skill-registry.ts`: skill discovery registry.
- `themes/cortex-cyan.json`: Pi theme package asset.
- `tests/cortex-extension-registration.test.ts`: registration and Pi `DefaultResourceLoader` coverage.
- `tests/cortex-subagents.test.ts`: subagent role and Windows process invocation seam coverage.
- `tests/cortex-cli-extensions.test.ts`: task formatting and snapshot cache/selection/error/dispose tests.

Current uncommitted workspace drift was observed with `git status --short`; this handoff does not normalize, stage, or commit it.

## 4. Installed Pi API documentation facts used

The following Pi documentation was read before citing API behavior:

- `node_modules/@earendil-works/pi-coding-agent/docs/extensions.md`
- `node_modules/@earendil-works/pi-coding-agent/docs/tui.md`
- `node_modules/@earendil-works/pi-coding-agent/docs/themes.md`
- `node_modules/@earendil-works/pi-coding-agent/docs/sdk.md`
- `node_modules/@earendil-works/pi-coding-agent/docs/rpc.md`
- `node_modules/@earendil-works/pi-coding-agent/docs/packages.md`
- `node_modules/@earendil-works/pi-coding-agent/docs/skills.md`

Important Pi API facts for this plan:

- Extensions are TypeScript modules exporting a default factory that receives `ExtensionAPI`.
- Auto-discovered extensions can be hot-reloaded with `/reload` when placed in standard locations or package resources.
- Extension factories should not start background timers, processes, sockets, or watchers. Long-lived resources should start at `session_start` or command execution and clean up on `session_shutdown`.
- Pi lifecycle includes `session_start`, `resources_discover`, `session_shutdown`, `agent_start`, `agent_end`, `agent_settled`, message events, tool events, input events, and more.
- `ctx.mode` identifies `"tui"`, `"rpc"`, `"json"`, or `"print"`.
- `ctx.hasUI` is true in TUI and RPC modes and false in print/JSON. Use `ctx.mode === "tui"` for terminal-only custom components and fullscreen assumptions; use `ctx.hasUI` for generic UI notifications/dialog affordances that also exist in RPC with limitations.
- Custom components implement `render(width): string[]`, optional input/mouse handlers, and `invalidate()`.
- Each rendered line must not exceed the supplied width.
- Pi TUI provides `visibleWidth`, `truncateToWidth`, and `wrapTextWithAnsi` for ANSI-aware measurement and wrapping.
- `ctx.ui.custom()` can create overlays with `overlay: true` and responsive `overlayOptions`.
- `ctx.ui.setWidget`, `ctx.ui.setStatus`, and `ctx.ui.setFooter` are the intended extension surfaces for compact persistent UI.
- Tool definitions can provide `renderCall` and `renderResult`; these affect display, not model token usage.
- Package resource identity deduplicates packages by npm name, git URL without ref, or resolved local path. Project-local package entries can override global entries.
- Skills are progressively disclosed: descriptions are in the system prompt, full `SKILL.md` is loaded on demand or via `/skill:name` when commands are enabled.
- RPC mode is JSONL over stdin/stdout, exposes state, session, model, queue, bash, and command methods, and streams events. It is not required for current compact UI work unless a future panel chooses a headless client.

## 5. Gentle-pi inspiration inventory and adoption boundary

`D:/gentle-pi` was inspected as inspiration only. It is not an authority source for this project. The following initial eight inspiration areas were identified and classified:

| Area | Gentle-pi evidence | Adopted for current scope? | Current Cortex/Pi decision |
| --- | --- | --- | --- |
| SDD preflight/detection | `lib/sdd-preflight.ts`, README SDD flow, managed assets | Partially, as concept only | Keep canonical OpenSpec/Cortex SDD. No new preflight preference store in tranche 1. |
| Subagent UI | `extensions/gentle-agents.ts`, `lib/agents-view.ts`, agent overlay/widgets | Partially, bounded | Keep existing Cortex subagent runner and harden invocation; no arbitrary agent dashboard in tranche 1. |
| DAG-backed todo | `extensions/gentle-todo.ts`, shell todo surfaces | Yes, conceptually | Render live Cortex work DAG/task statuses compactly from shared snapshot. Cortex-IA remains data authority. |
| Changes/worktree browser | `lib/shell-changes-view.ts`, `session-worktree-registry.ts` | Postponed | Current engine is single workspace. No automatic multi-worktree accordion. |
| Runtime metrics | `extensions/runtime-metrics.ts`, docs `telemetry.md` | Postponed/non-goal | No external telemetry or collector. Local counts only if provided by Pi/session APIs and explicitly scoped later. |
| Skill discovery | `extensions/skill-registry.ts`, skill style docs | Already adjacent | Current package has `lib/skill-registry.ts` and `/cortex:skills`; compact surfacing can mention registry status. |
| Model profiles | `lib/model-routing-authority.ts`, `/gentle:models`, profiles | Postponed/non-goal | No accepted model routing subsystem. Do not mutate model selection policy in this plan. |
| Review UX | review consent/components/native review architecture | Only principle adopted | Preserve Cortex-IA independent approval separation. Do not port gentle-pi RDD/native review authority. |

Subsequent priority decisions:

- Models are not automatically accepted scope.
- Telemetry is not automatically accepted scope.
- Worktree extras are not automatically accepted scope.
- The current engine remains single-workspace.
- The immediate UX is compact adaptive status and on-demand panels for current Cortex agents/tasks/SDD only.

## 6. Architecture goal

The adaptive UX should be a small Pi-native layer around existing Cortex-IA facts:

1. One extension entrypoint is discovered and activated once per runtime.
2. Commands, banner, footer, widgets, and panels read through one session-scoped status snapshot helper.
3. Renderers consume already-loaded snapshot data and never perform Cortex I/O during pure render.
4. TUI mode uses theme-aware, ANSI-width-bounded rendering.
5. Non-TUI modes degrade to concise text messages.
6. Detail panels are opt-in, command-driven, and safe on malformed data.
7. The runner/subagent path remains a bounded transport and does not own task mutation or approval.
8. Lifecycle cleanup is explicit on session shutdown/reload/new/resume/fork.

## 7. Proposed module/file map versus existing files

Existing files should evolve as follows under the live tasks, not under this handoff:

| File | Current role | Proposed role |
| --- | --- | --- |
| `extensions/index.ts` | Aggregate extension registration with duplicate guard | Keep as single package entrypoint. Ensure guard is per runtime and does not suppress reload with fresh API. |
| `lib/cortex-subagents.ts` | Runner resolves Pi and spawns child `--print` | Keep. Treat as bounded transport; document fail-closed Windows behavior and cancellation limits. |
| `lib/cortex-cli.ts` | CLI adapter plus shared snapshot store | Finish REQ-UX-003: strict validation, ledger summary contract, no fabricated defaults, cache/in-flight/dispose semantics. |
| `extensions/cortex-banner.ts` | Direct board I/O and hard-coded ANSI startup banner | Route through snapshot helper and renderer; use theme tokens where available; compact default. |
| `extensions/cortex-commands.ts` | Direct command handlers | Use shared snapshot for status/board/ledger where applicable; details by command. |
| `extensions/cortex-shell.ts` | Shell surface | Route compact shell/status affordances through renderer; do not create hidden authority. |
| `extensions/cortex-todo.ts` | `/cortex:board` with direct I/O | Render DAG/task lines from snapshot; expose panel only by command. |
| `tests/cortex-cli-extensions.test.ts` | Snapshot and formatting tests | Add 1.3B ledger/malformed/concurrency oracle, then 1.4 render tests. |
| `README.md`, `prompts/cortex-engineer.md`, `skills/cortex-sdd/SKILL.md`, `skills/cortex-review/SKILL.md` | Current docs/prompts may contain stale claims | Task 1.5 aligns authority claims after 1.4. |

Optional future modules may be proposed later, but are not current pinned task scope:

- `lib/cortex-renderers.ts` for pure render helpers.
- `lib/cortex-panel.ts` for a small on-demand TUI overlay.
- `lib/cortex-width.ts` for shared ANSI width logic, if Pi TUI utilities are not imported directly.

Do not add these without revising authorized task allowed-files if the current board does not allow them.

## 8. Contract: single entrypoint loading and reload idempotence

Requirement: REQ-UX-001.

Current accepted behavior:

- `package.json` exposes exactly `"./extensions/index.ts"` in `pi.extensions`.
- `.pi/settings.json` references the local package with `".."`.
- `extensions/index.ts` imports and registers each Cortex module once.
- A `WeakSet<ExtensionAPI>` suppresses duplicate activation on the same Pi API object and emits a compact warning: `[pi-cortex-ia] Duplicate extension activation skipped: extensions/index.ts`.
- A fresh `ExtensionAPI` instance should still activate normally, preserving reload-style behavior.

Edge and error behavior:

- Duplicate aggregate activation must not double-register tools, commands, or hooks.
- The duplicate warning must name the source compactly.
- The guard does not prove global package deduplication; Pi package identity and loader behavior still matter.
- The extension factory should avoid background work at load time. Background resources belong in `session_start` or command handlers with `session_shutdown` cleanup.

Tests already present:

- `tests/cortex-extension-registration.test.ts` checks manifest and project settings.
- It uses Pi `DefaultResourceLoader` and `SettingsManager` to verify one visible extension path through startup/reload loading.
- It checks duplicate activation warning and per-runtime idempotence.

## 9. Contract: Windows-safe delegated Pi spawn

Requirement: REQ-UX-002.

Current accepted behavior in `lib/cortex-subagents.ts`:

- On Windows, the runner must not spawn `pi.cmd` directly.
- A real Pi JavaScript entry is resolved from package metadata or npm shim text.
- Spawn command is `process.execPath` and the JS entry is the first argv when applicable.
- `shell:false` is used.
- Model/prompt text is passed as argv data to `--print`, never interpolated into a shell command.
- Invalid explicit `PI_BIN` fails closed and returns a `BLOCKED` receipt without spawn.
- If no JS entry can be resolved on Windows, it fails closed instead of falling back to bare `pi`/shell.

Important limitations that must remain explicit:

- Cancellation and output risks are not fully solved. The runner kills on timeout or `cancelAll()`, but child process cleanup, partial output ordering, and model token spend are not guaranteed reversible.
- The current parser infers verdict from stdout strings; this is display/receipt convenience, not independent approval.
- A subagent cannot mutate Cortex work unless it separately obtains valid Cortex claims/leases via authority tools.
- The runner does not replace Pi's native session runtime, model runtime, or approval workflow.

Tests already present:

- `tests/cortex-subagents.test.ts` covers role directives, binary resolution, Windows package JS entry spawn, explicit `PI_BIN` shim resolution, and invalid `PI_BIN` fail-closed behavior.

## 10. Contract: shared Cortex status snapshot

Requirement: REQ-UX-003.

Current implementation in `lib/cortex-cli.ts`:

- `createCortexStatusSnapshotStore(options)` creates a session-scoped store.
- `getSnapshot()` returns `available` or `unavailable` and does not throw for normal Cortex unavailability.
- `invalidate()` clears cache and prevents late stale results from replacing a newer generation.
- `dispose()` marks the store disposed, clears cache/in-flight state, and later `getSnapshot()` returns unavailable.
- Concurrent `getSnapshot()` callers share one in-flight load.
- Board selection prefers an explicit board id, then active boards before archived, then newest `updated_at`, then `board_id` lexical order.
- Counts are taken from board status counts when present, otherwise derived from items.
- Ledger summary support exists, but is currently under review correction.

The intended snapshot contract:

- Snapshot is read-only presentation data, not an authority cache.
- It may choose a display board but may not claim that board is the only valid authority context for task mutation.
- It must validate CLI shapes strictly enough to avoid fabricating task revisions or timestamps.
- Missing Cortex CLI, board list failures, malformed boards, malformed work items, ledger failures, and malformed ledger data must be non-fatal to Pi interaction.
- Ledger unavailable may be represented inside an otherwise available board snapshot if board/task data is valid.
- Cache lifetime is a Pi extension session concern. It must be invalidated on reload/session replacement and disposed on shutdown.
- No renderer should call Cortex; only the snapshot loader may perform CLI I/O.

Known blocker:

- Task `pi-native-adaptive-ux-1.3A` is blocked. Reviewer evidence says validators still fabricate unknown revision/timestamp defaults instead of rejecting malformed CLI schema. The live source uses optional `revision`, `created_at`, and `updated_at` fields and currently checks type when these fields are present. The exact reviewer phrase mentions `created_at: 0` being accepted and a retrospective `invalid-date-string` issue, but the visible live ledger does not contain the full causal test baseline. Treat those exact malformed cases as unconfirmed details until reproduced by focused tests against current source.

Required next technical behavior:

- For required schema fields, reject absent or wrong-typed data rather than inventing fallback defaults.
- For optional date fields, decide and test whether any string is accepted or whether parseable ISO-like date strings are required. Current code only type-checks strings; `Date.parse` is used only for board sorting rank.
- Do not mark 1.3A approved merely because `npm test` and `npm run typecheck` passed; reviewer already found semantic failure after passing tests.
- Do not auto-retry after two FAILs. Re-scope with planner-quality source+test oracle under correction budget.

## 11. Contract: compact themed views and panels on demand

Requirements: REQ-UX-003 and REQ-UX-004.

Desired behavior:

- Default UI is compact: status line, footer, or small widget.
- Detail panels open only from explicit commands or direct user action.
- TUI renderers use Pi theme tokens (`accent`, `muted`, `dim`, `success`, `warning`, `error`, border tokens, diff tokens where relevant).
- Rendered lines are bounded by terminal width using ANSI-aware measurement.
- Narrow terminals degrade by truncating or summarizing, not by wrapping into unbounded noise.
- Non-TUI and RPC/print/json modes receive concise text fallback through supported UI surfaces.
- Malformed snapshot data renders an error row instead of throwing.
- Current scope is Cortex agents/tasks/SDD status only.

Semantic theme/accessibility details:

- Do not use color as the only state carrier. Include short text labels or icons with status names.
- ANSI escape sequences must not confuse width measurement; use Pi TUI `visibleWidth`, `truncateToWidth`, and `wrapTextWithAnsi` where rendering uses ANSI.
- Theme changes call `invalidate()` on components. Components that pre-bake theme strings must rebuild their content on invalidation or compute themed strings inside render.
- Do not assume fullscreen mouse support in regular TUI mode. Mouse behavior is fullscreen-specific in Pi's TUI docs.

Compact cards and tool rendering:

- `renderCall` and `renderResult` customize visual display only.
- They do not reduce model context tokens by themselves.
- Token savings come from reducing what is sent to the model or stored in messages, not from prettier TUI rows.
- Any claim of token savings must be separately measured and tied to context/message behavior.

## 12. UI truth distinctions: SDD, agents, tasks

The UI must not conflate these domains:

- SDD truth: OpenSpec plan/contracts and Cortex SDD bindings.
- Work truth: Cortex-IA board/task rows, dependencies, claims, leases, statuses, reviews, and ledger facts.
- Agent truth: Pi session/subagent process activity and receipts.
- Memory truth: Cortex cognitive memory and Dual Ledger facts/progress.

A compact card may show all of them, but labels must preserve provenance. Example:

- `SDD: pi-native-adaptive-ux pinned plan OK` is a contract/artifact statement.
- `Work: 1 blocked, 3 backlog, 2 done, 1 superseded` is a board state statement.
- `Agent: no child process running` is a runner/session statement.
- `Ledger: 5 facts, 0 progress` is a ledger status statement.

Do not display subagent `VERDICT: PASS` as Cortex approval. Cortex approval requires independent `cortex_work approve` PASS evidence by a reviewer.

## 13. Lifecycle cleanup and performance criteria

Deterministic criteria:

- Extension activation is idempotent per `ExtensionAPI` instance.
- Session-scoped snapshot store is created on session start or lazily per session.
- Store is invalidated on reload/session replacement and disposed on session shutdown.
- Concurrent consumers share one in-flight Cortex read.
- Pure render functions perform zero Cortex I/O.
- Render output lines do not exceed supplied width.
- Malformed data produces unavailable/error rows, not thrown exceptions in UI handlers.

Unmeasured claims to avoid:

- Do not claim latency improvements unless measured.
- Do not claim token savings from renderer changes.
- Do not claim complete cancellation safety for child Pi processes.
- Do not claim security protection against a malicious same-user process that can modify package code or local authority stores.

## 14. Live `pi-native-adaptive-ux` board status

Live status read by `cortex-ia work list --board pi-native-adaptive-ux`:

| Task ID | Status | Revision | Dependencies | Replacement | Summary |
| --- | --- | ---: | --- | --- | --- |
| `pi-native-adaptive-ux-1.1` | `done` | 5 | none | none | Single extension entrypoint and duplicate guard. |
| `pi-native-adaptive-ux-1.2` | `done` | 5 | none | none | Windows-safe Pi runner resolution and fail-closed explicit `PI_BIN`. |
| `pi-native-adaptive-ux-1.3` | `superseded` | 6 | none | replaced by `1.3A`, `1.3B` | Original shared snapshot task superseded after review concerns. |
| `pi-native-adaptive-ux-1.3A` | `blocked` | 8 | none | replaces `1.3` | Production correction for ledger/schema validation in `lib/cortex-cli.ts`; blocked after review found malformed schema issue. |
| `pi-native-adaptive-ux-1.3B` | `backlog` | 1 | `1.3A` | replaces `1.3` | Test-only coverage for ledger/malformed/concurrency snapshot behavior. |
| `pi-native-adaptive-ux-1.4` | `backlog` | 2 | `1.3B` | none | Route compact TUI surfaces through themed renderers. |
| `pi-native-adaptive-ux-1.5` | `backlog` | 2 | `1.1`, `1.2`, `1.4` | none | Cleanup stale authority claims in docs/prompts/skills. |

Ledger facts observed for this board:

- Fact 6: 1.1 implementation registered package entrypoint and duplicate guard.
- Fact 7: 1.2 implementation hardened Windows Pi invocation and passed targeted/full tests/typecheck.
- Fact 8: independent 1.2 review PASS recorded; reviewer noted RED evidence was syntax, not causal behavioral TDD RED.
- Fact 9: 1.3 implemented session-scoped snapshot store.
- Fact 10: independent 1.3A review found snapshot validators still accept/fabricate malformed data; PASS not recorded.

Current ledger status for `pi-native-adaptive-ux` has 5 facts and 0 progress records.

## 15. Engine board `work-revise` status and official revision path

Live status read by `cortex-ia work list --board work-revise`:

| Task ID | Status | Revision | Dependencies | Summary |
| --- | --- | ---: | --- | --- |
| `work-revise-1` | `done` | 4 | none | Store-level safe work definition revision engine. |
| `work-revise-2` | `done` | 5 | `work-revise-1` | CLI parser for `cortex-ia work revise --plan <file|@stdin>`. |

The engine feature is separate because the archive/change identity and workspace authority differ. `work-revise` lives in `D:/cortex-ia` and has `change_id: work-revise`. Pi UX recovery remains in `D:/lleontor705/pi-cortex-ia` with `change_id: pi-native-adaptive-ux`.

Official `work revise` path:

- It revises only unclaimed `ready` or `backlog` tasks at an explicitly expected revision.
- It rejects claimed, leased, active, in-review, done, blocked, superseded, stale, malformed, or unknown-field inputs before mutation.
- It preserves task ID, board ID, workspace, dependencies, replacement history, workflow, change id, and spec plane.
- Replacement workspace-file pins are validated read-only before mutation.
- Existing stale old pins are an observed reason to revise; new pins must match current bytes.
- SDD bindings must not be silently dropped.

Important operational note:

- At the time of the plan, the current binary did not yet contain `work revise`; operators used `go run` during engine implementation/review. The live help now shows the broader `work` subcommands available through the installed binary inspected here, but do not assume any stale wrapper includes the new route unless `cortex-ia work --help` in the target environment shows it.

Exact planned CLI payload schema from `D:/cortex-ia/openspec/changes/work-revise/plan.md`:

```json
{
  "version": 1,
  "task_id": "pi-native-adaptive-ux-1.4",
  "board_id": "pi-native-adaptive-ux",
  "project": "D:/lleontor705/pi-cortex-ia",
  "expected_revision": 1,
  "expected_status": "backlog",
  "expected_workflow": "sdd-lite",
  "expected_change_id": "pi-native-adaptive-ux",
  "definition": {
    "title": "[rendering] Add compact themed Cortex view helpers",
    "objective": "...",
    "acceptance_criteria": "...",
    "verification": "...",
    "allowed_files": ["..."],
    "sdd_contract": {
      "version": 1,
      "workflow": "sdd-lite",
      "change_id": "pi-native-adaptive-ux",
      "spec_plane": "hybrid",
      "pins": [{"transport": "workspace_file", "project": "D:/lleontor705/pi-cortex-ia", "locator": "openspec/changes/pi-native-adaptive-ux/plan.md", "sha256": "514b397ae490be48d919271f839e433c34751885ca3dfd00e2b65973551deda7"}],
      "requirement_ids": ["REQ-PI-NATIVE-001"]
    }
  }
}
```

Use one revision plan per existing task when necessary. Do not use `proposed-tasks.json` as a recovery payload; it was a declarative creation plan for two engine feature tasks, not a Pi recovery operation.

## 16. Known pitfalls and historical corrections

- Wrappers initially lacked a review revision parameter; independent reviewer reported using CLI approval with revision after `cortex_work approve` lacked that parameter.
- Some task pins were initially stale and later reconciled to the current Pi plan SHA-256.
- `pi-native-adaptive-ux-1.3` should not be treated as approved; it is superseded.
- `pi-native-adaptive-ux-1.3A` should not be treated as approved; it is blocked.
- Passing 22 tests, 18 tests, or full typecheck is not sufficient for approval when a semantic reviewer found untested malformed-data behavior.
- A blocked task should not be fixed by raw SQLite edits, stale approval, or silent task definition mutation.
- The correction budget for fixing a reported issue must be observed by the implementer. 1.3A itself states a bounded correction under 100 changed TypeScript lines.

## 17. Blocker ledger metadata discrepancy

Confirmed sources:

- Live source `lib/cortex-cli.ts` validates optional `created_at`/`updated_at` only as strings when present.
- `selectCortexStatusBoard` uses `Date.parse` for sort rank, with invalid dates ranked as negative infinity.
- Live tests currently cover malformed board with missing `title`, but do not cover `created_at: 0` or `created_at: "invalid-date-string"`.
- Ledger fact 10 says review found validators still fabricate unknown revision/timestamp defaults instead of rejecting malformed CLI schema.

Unconfirmed details:

- The user instruction mentions reviewer-reported `created_at: 0` accepted and retrospective `invalid-date-string` accepted. I did not find those exact strings in visible ledger facts or source comments during this handoff.
- There is no visible causal test baseline proving whether those cases fail or pass today.

Recommended next route:

1. Planner re-scopes a combined source+test oracle for 1.3A/1.3B sequencing, or revises definitions only through official `work revise` if lifecycle permits.
2. Add focused tests first for numeric timestamp, invalid date string if date parseability is contractually required, unknown/missing revision behavior if revision is required, and ledger malformed states.
3. Apply source correction within budget.
4. Run targeted tests and typecheck.
5. Submit to independent review; do not self-approve.

## 18. Requirement IDs and scenario acceptance matrix

| Requirement | Happy path | Edge case | Error state | Current state |
| --- | --- | --- | --- | --- |
| REQ-UX-001 single extension activation | One package entrypoint exposes tools/commands once | Package manifest plus project settings dedupe deterministically | Duplicate activation emits compact warning and skips registration | Done/approved on board via task 1.1. |
| REQ-UX-002 Windows-safe delegated Pi spawn | Valid JS entry spawns through `process.execPath` argv | npm shim target is resolved, not launched | Invalid explicit `PI_BIN` returns BLOCKED with no spawn | Done/approved on board via task 1.2. |
| REQ-UX-003 shared Cortex snapshot | Status/banner/board use same counts and selected board | Multiple active boards use stable order and in-flight dedupe | CLI/ledger/malformed data is unavailable/non-fatal | Partially implemented; 1.3 superseded; 1.3A blocked; 1.3B pending. |
| REQ-UX-004 compact themed views | Interactive TUI renders themed compact status/footer/widget | Narrow/non-TUI modes degrade concisely | Malformed panel data displays error row | Pending behind 1.3B. |

## 19. Proposed future work inventory separate from existing task list

Existing live task list is the seven rows in section 14. Do not confuse it with future ideas.

Future ideas that require new planning/authorization:

- Dedicated pure renderer module if allowed-files are revised.
- Minimal on-demand overlay panel for board details.
- SDD preflight preference prompt inspired by gentle-pi.
- Worktree/changes browser.
- Local runtime metrics summary.
- Model profile editor.
- Rich review UX.
- Skill registry status widget.

These are not accepted scope unless a future OpenSpec change and Cortex tasks explicitly authorize them.

## 20. Test commands and evidence handling

Correct Node targeted test command:

```bash
node --test tests/cortex-cli-extensions.test.ts
```

Project script command:

```bash
npm test
```

Important distinction:

- `package.json` defines `"test": "node --test tests/*.test.ts"`.
- Therefore `npm test -- tests/cortex-cli-extensions.test.ts` may not target the file the way an operator expects; the script already expands `tests/*.test.ts`.
- For deterministic targeted evidence, prefer direct `node --test tests/<file>.test.ts`.
- For full package evidence, use `npm test`.
- Always pair relevant tests with `npm run typecheck` for TypeScript changes.

Baseline/last verified from ledger:

- 1.2 ledger says `node --test tests/cortex-subagents.test.ts` passed 5/5, `npm test` passed 18/18, and `npm run typecheck` passed.
- 1.3A review says `npm test` and `npm run typecheck` passed but semantic validation failed.

This document may include its own markdown validation evidence, but that does not approve production tasks.

## 21. Security and trust boundaries

- Pi extensions execute with user permissions. Only trusted code should be installed.
- This package does not protect against a malicious same-user process that can replace package files, binaries, settings, or local authority stores.
- The subagent runner prevents one class of Windows shell invocation issue; it does not sandbox the child model or OS process.
- The snapshot cache is presentation-only. It must never authorize task mutation from cached data.
- No secrets, tokens, full transcripts, or private raw model outputs should be written into docs or ledger facts.
- Telemetry is not current scope. Do not add external reporting under this adaptive UX tranche.
- Web dashboard launch remains an explicit command; it is not the compact default.

## 22. Roadmap dependencies

Immediate route:

1. Resolve `pi-native-adaptive-ux-1.3A` blocked state with a narrow source correction and causal tests.
2. Complete `pi-native-adaptive-ux-1.3B` test-only coverage after 1.3A.
3. Implement `pi-native-adaptive-ux-1.4` compact themed renderers once the snapshot contract is approved.
4. Implement `pi-native-adaptive-ux-1.5` docs/prompts cleanup only after 1.4.

Dependency chain:

```text
1.1 done ┐
         ├─> 1.5 docs cleanup
1.2 done ┘        ▲
                  │
1.3 superseded -> 1.3A blocked -> 1.3B backlog -> 1.4 backlog ┘
```

## 23. File/config path index

- Handoff: `D:/lleontor705/pi-cortex-ia/spec.md`.
- Pi UX plan: `D:/lleontor705/pi-cortex-ia/openspec/changes/pi-native-adaptive-ux/plan.md`.
- Pi UX contracts: `D:/lleontor705/pi-cortex-ia/openspec/changes/pi-native-adaptive-ux/contracts/1.1.json` through `1.5.json`.
- Engine work revise plan: `D:/cortex-ia/openspec/changes/work-revise/plan.md`.
- Engine proposed creation plan: `D:/cortex-ia/openspec/changes/work-revise/proposed-tasks.json`.
- Package manifest: `D:/lleontor705/pi-cortex-ia/package.json`.
- Project Pi settings: `D:/lleontor705/pi-cortex-ia/.pi/settings.json`.
- Snapshot source: `D:/lleontor705/pi-cortex-ia/lib/cortex-cli.ts`.
- Subagent runner source: `D:/lleontor705/pi-cortex-ia/lib/cortex-subagents.ts`.
- Entrypoint: `D:/lleontor705/pi-cortex-ia/extensions/index.ts`.
- Banner: `D:/lleontor705/pi-cortex-ia/extensions/cortex-banner.ts`.
- Commands: `D:/lleontor705/pi-cortex-ia/extensions/cortex-commands.ts`.
- Todo/board UI: `D:/lleontor705/pi-cortex-ia/extensions/cortex-todo.ts`.
- Theme: `D:/lleontor705/pi-cortex-ia/themes/cortex-cyan.json`.

## 24. Handoff conclusion

The adaptive Pi UX work is partially complete but not ready to continue into themed renderers until the snapshot contract is corrected and independently approved. The safe path is to close the 1.3A blocker with causal source+test evidence, complete 1.3B as an oracle, then implement compact themed surfaces in 1.4. Documentation cleanup in 1.5 comes last so it describes real approved behavior rather than aspirational architecture.
