# SDD Lite Plan: Pi-native adaptive UX

## Intent
Preserve D:/cortex-ia as sole task/lease/approval authority while making this Pi package reliable and compact: no duplicate extension registration, Windows-safe Pi child resolution, shared status snapshots, and themed views that expand only on demand.

## Requirements
### Requirement: REQ-UX-001: Single extension activation
The package MUST register each Cortex/Pi extension module exactly once per resource discovery path.
#### Scenario: Happy path
- GIVEN package manifest loading `./extensions`
- WHEN Pi discovers project resources
- THEN each tool/command is exposed once.
#### Scenario: Edge case
- GIVEN both package manifest and project settings reference the package
- WHEN discovery runs
- THEN duplicate aggregators or directories are de-duplicated deterministically.
#### Scenario: Error state
- GIVEN duplicate command/tool registrations are detected
- WHEN startup diagnostics run
- THEN a compact warning names the duplicate source without registering another copy.

### Requirement: REQ-UX-002: Windows-safe delegated Pi spawn
The existing Pi subagent runner MUST resolve the real Pi JavaScript entry on Windows and invoke it with `process.execPath` argv, without direct `pi.cmd` spawning, shell invocation for model text, ENOENT, or authority escalation. Explicit invalid configuration MUST fail closed.
#### Scenario: Happy path
- GIVEN a valid configured or package-local Pi JavaScript entry exists
- WHEN a plan-only or read-only subagent is requested
- THEN spawn uses `process.execPath` with bounded argv and passes model text without a shell.
#### Scenario: Edge case
- GIVEN package resolution must inspect local npm shims
- WHEN resolving Pi
- THEN the runner resolves the target JS entry behind the shim instead of launching `pi.cmd` directly.
#### Scenario: Error state
- GIVEN `PI_BIN` is explicitly configured but invalid, or no JS entry can be resolved
- WHEN dispatch is attempted
- THEN the receipt is BLOCKED with no task mutation or fallback to bare shell commands.

### Requirement: REQ-UX-003: Shared Cortex status snapshot
The UI MUST obtain board/task/ledger summaries through one typed snapshot helper and keep missing Cortex data non-fatal.
#### Scenario: Happy path
- GIVEN Cortex-IA CLI responds
- WHEN status, banner, or board UI renders
- THEN all use the same counts and active-board selection.
#### Scenario: Edge case
- GIVEN there are multiple active boards
- WHEN rendering compact status
- THEN the helper chooses a stable documented board order.
#### Scenario: Error state
- GIVEN Cortex-IA CLI fails
- WHEN rendering status
- THEN UI shows unavailable status and preserves Pi interaction.

### Requirement: REQ-UX-004: Compact themed views with panels on demand
The package MUST prefer themed compact status/footer/widgets and open detail panels only by command or user action.
#### Scenario: Happy path
- GIVEN interactive TUI mode
- WHEN Cortex UX renders
- THEN it uses Pi theme tokens and width-bounded lines.
#### Scenario: Edge case
- GIVEN narrow terminal or non-TUI mode
- WHEN rendering is requested
- THEN output degrades to concise text without fullscreen assumptions.
#### Scenario: Error state
- GIVEN malformed status data
- WHEN a panel is opened
- THEN renderer displays an error row without throwing.

## Design
Alternatives: (A) patch current commands only; (B) add a shared snapshot + renderer seam; (C) replace with web/fullscreen. Choose B: local, reversible, no new runner/model routing/telemetry/fullscreen. Preserve the existing Pi subagent runner as a bounded Cortex-IA delegation transport; this change hardens invocation and presentation only, and does not replace it with a new model-routing system. Acceptance is deterministic: shared snapshot callers assert one in-flight Cortex CLI read for concurrent consumers, explicit cache invalidation between sessions, zero Cortex I/O during pure render, width-bounded lines, cleanup on session shutdown, and concise non-TUI behavior. Tranche 1 provides compact views for current Cortex agents/tasks/SDD status only; broader UX redesign, arbitrary agent dashboards, and fullscreen/web views are later scope.

## Tasks
- [ ] 1.1 Audit package discovery and extension registration
  Requirements: REQ-UX-001
  allowed_files: package.json, .pi/settings.json, extensions/index.ts, tests/cortex-extension-registration.test.ts
  scope: eliminate duplicate registration paths or add deterministic duplicate guard; verification `npm test -- tests/cortex-extension-registration.test.ts` and `npm run typecheck`.
- [ ] 1.2 Harden Windows Pi runner resolution
  Requirements: REQ-UX-002
  allowed_files: lib/cortex-subagents.ts, tests/cortex-subagents.test.ts
  scope: resolve a real Pi JS entry from explicit/package-local configuration, invoke through `process.execPath` argv, never spawn `pi.cmd` directly, never use shell for model text, and fail closed on invalid explicit configuration; verification `npm test -- tests/cortex-subagents.test.ts` and `npm run typecheck`.
- [ ] 1.3 Introduce shared read-only Cortex status snapshot
  Requirements: REQ-UX-003
  allowed_files: lib/cortex-cli.ts, tests/cortex-cli-extensions.test.ts
  scope: typed helper for active board, counts, failures, shared in-flight calls, cache invalidation, and session shutdown cleanup; verification `npm test -- tests/cortex-cli-extensions.test.ts` and `npm run typecheck`.
- [ ] 1.4 Route compact TUI surfaces through themed renderers
  Requirements: REQ-UX-003, REQ-UX-004
  dependencies: 1.3
  allowed_files: extensions/cortex-banner.ts, extensions/cortex-commands.ts, extensions/cortex-shell.ts, extensions/cortex-todo.ts, tests/cortex-cli-extensions.test.ts
  scope: width-bounded compact status/footer/persistent widget for current Cortex agents/tasks/SDD only, zero Cortex I/O during render, detail-on-command, malformed-data rows, and non-TUI text fallback; verification `npm test -- tests/cortex-cli-extensions.test.ts` and `npm run typecheck`.
- [ ] 1.5 Cleanup stale authority claims in docs/prompts
  Requirements: REQ-UX-001, REQ-UX-002, REQ-UX-004
  dependencies: 1.1, 1.2, 1.4
  allowed_files: README.md, prompts/cortex-engineer.md, skills/cortex-sdd/SKILL.md, skills/cortex-review/SKILL.md
  scope: align docs with Cortex-IA sole task/lease/approval authority while documenting the bounded existing Pi subagent runner under Cortex-IA delegation; remove replacement/no-native-launching intent and do not claim a full UX redesign; verification `npm test` and `npm run typecheck`.

## Non-goals
No production implementation in this phase; no new runner authority, model routing subsystem, external telemetry, forced fullscreen, or edits outside listed task files.

## Risks
Existing uncommitted workspace drift may affect review fingerprints; Cortex-IA CLI schema may reject typed SDD bindings; Pi API changes may require renderer test seams.
