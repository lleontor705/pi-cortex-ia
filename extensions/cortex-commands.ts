import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import {
  createCortexStatusSnapshotStore,
  type CortexStatusSnapshot,
  type CortexStatusSnapshotStore,
  cortexDoctor,
  launchWebDashboard,
  workRecover,
  ledgerStatus,
  openspecStatus,
  openspecList,
} from "../lib/cortex-cli.ts";
import { cortexContext } from "../lib/cortex-memory-cli.ts";
import { syncSkillRegistry } from "../lib/skill-registry.ts";

export function renderStatusSummary(
  snapshot: CortexStatusSnapshot,
  options: { maxWidth?: number } = {}
): string {
  const maxWidth = options.maxWidth ?? 80;
  if (snapshot.state === "unavailable") {
    return truncateToWidth(`Cortex Status: Unavailable (${snapshot.unavailableReason ?? "offline"})`, maxWidth);
  }

  const active = snapshot.selectedBoard;
  if (!active) {
    return truncateToWidth("No Cortex boards found in this workspace.", maxWidth);
  }

  const done = snapshot.items.filter((i) => i.status === "done").length;
  const inProg = snapshot.items.filter((i) => i.status === "in_progress").length;
  const inRev = snapshot.items.filter((i) => i.status === "in_review").length;
  const ready = snapshot.items.filter((i) => i.status === "ready").length;
  const total = snapshot.items.length;

  const lines = [
    truncateToWidth(`Cortex Board: [${active.board_id}] "${active.title}"`, maxWidth),
    truncateToWidth(`Tasks: ${done} done, ${inProg} in_progress, ${inRev} in_review, ${ready} ready. Total: ${total}`, maxWidth),
  ];

  if (snapshot.ledger?.state === "available") {
    lines.push(
      truncateToWidth(
        `Ledger: ${snapshot.ledger.counts.facts} facts, ${snapshot.ledger.counts.progress} progress (${snapshot.ledger.counts.drift} drift)`,
        maxWidth
      )
    );
  }

  return lines.join("\n");
}

export default function registerCortexCommands(
  pi: ExtensionAPI,
  store: CortexStatusSnapshotStore = createCortexStatusSnapshotStore()
): void {
  // 1. /cortex:status
  pi.registerCommand("cortex:status", {
    description: "Check Cortex-IA boards, active task DAG status, and file leases.",
    handler: async (_args: unknown, ctx: any) => {
      try {
        const snapshot = await store.getSnapshot();
        const text = renderStatusSummary(snapshot, { maxWidth: 80 });
        ctx.ui.notify(text, snapshot.state === "available" ? "info" : "warning");
      } catch (err: any) {
        ctx.ui.notify(`Failed to fetch Cortex status: ${err.message}`, "error");
      }
    },
  });

  // 2. /cortex:doctor
  pi.registerCommand("cortex:doctor", {
    description: "Run Cortex-IA diagnostic health check.",
    handler: async (_args: unknown, ctx: any) => {
      const cwd = ctx.cwd || process.cwd();
      ctx.ui.notify("Running Cortex-IA doctor...", "info");
      try {
        const res = await cortexDoctor(cwd);
        const lines = res.stdout.split("\n").slice(0, 5).join("\n");
        ctx.ui.notify(lines, res.ok ? "info" : "warning");
      } catch (err: any) {
        ctx.ui.notify(`Cortex doctor error: ${err.message}`, "error");
      }
    },
  });

  // 3. /cortex:web
  pi.registerCommand("cortex:web", {
    description: "Launch the real-time embedded Cortex-IA Web Dashboard (port 7331).",
    handler: async (_args: unknown, ctx: any) => {
      try {
        launchWebDashboard(true);
        ctx.ui.notify("Launching Cortex-IA Web Dashboard at http://127.0.0.1:7331", "info");
      } catch (err: any) {
        ctx.ui.notify(`Failed to launch web dashboard: ${err.message}`, "error");
      }
    },
  });

  // 4. /cortex:skills
  pi.registerCommand("cortex:skills", {
    description: "Discover all installed skills across Pi, Gemini, Claude, Cursor and refresh .cortex-ia/skill-registry.md.",
    handler: async (_args: unknown, ctx: any) => {
      const cwd = ctx.cwd || process.cwd();
      try {
        const result = await syncSkillRegistry(cwd);
        ctx.ui.notify(`Synchronized ${result.total} skills into ${result.path}`, "info");
      } catch (err: any) {
        ctx.ui.notify(`Skill sync failed: ${err.message}`, "error");
      }
    },
  });

  // 5. /cortex:recover
  pi.registerCommand("cortex:recover", {
    description: "Sweep expired claim tokens and file leases across the workspace.",
    handler: async (_args: unknown, ctx: any) => {
      const cwd = ctx.cwd || process.cwd();
      try {
        await workRecover(cwd);
        ctx.ui.notify("Recovered expired Cortex claims and leases successfully.", "info");
      } catch (err: any) {
        ctx.ui.notify(`Recovery failed: ${err.message}`, "error");
      }
    },
  });

  // 6. /cortex:ledger
  pi.registerCommand("cortex:ledger", {
    description: "Inspect Dual Ledger verified facts and progress evaluations.",
    handler: async (_args: unknown, ctx: any) => {
      const cwd = ctx.cwd || process.cwd();
      try {
        const rep = await ledgerStatus({}, cwd);
        const text = typeof rep === "string" ? rep : JSON.stringify(rep, null, 2);
        ctx.ui.notify(`Cortex Dual Ledger:\n${text.slice(0, 1500)}`, "info");
      } catch (err: any) {
        ctx.ui.notify(`Failed to read Dual Ledger: ${err.message}`, "error");
      }
    },
  });

  // 7. /cortex:sdd
  pi.registerCommand("cortex:sdd", {
    description: "Inspect active OpenSpec SDD changes and preflight status.",
    handler: async (_args: unknown, ctx: any) => {
      const cwd = ctx.cwd || process.cwd();
      try {
        const changes = await openspecList(cwd);
        if (changes.length === 0) {
          ctx.ui.notify("No active OpenSpec changes found in openspec/changes/.", "info");
          return;
        }
        const status = await openspecStatus(undefined, cwd);
        ctx.ui.notify(`OpenSpec SDD Status (${changes.length} active changes):\n${status}`, "info");
      } catch (err: any) {
        ctx.ui.notify(`Failed to inspect OpenSpec: ${err.message}`, "error");
      }
    },
  });

  // 8. /cortex:memory
  pi.registerCommand("cortex:memory", {
    description: "Display recent cognitive memory context and active sessions.",
    handler: async (_args: unknown, ctx: any) => {
      const cwd = ctx.cwd || process.cwd();
      try {
        const ctxText = await cortexContext(undefined, cwd);
        ctx.ui.notify(`Cortex Memory Context:\n${ctxText.slice(0, 1500)}`, "info");
      } catch (err: any) {
        ctx.ui.notify(`Failed to read memory context: ${err.message}`, "error");
      }
    },
  });

  // 9. /cortex:agents
  pi.registerCommand("cortex:agents", {
    description: "List the 6 canonical Cortex-IA subagent roles and their capabilities.",
    handler: async (_args: unknown, ctx: any) => {
      const text = `
🤖 Canonical Cortex-IA Subagent Roles:
1. discovery: Onboarding profile (.cortex-ia/discovery.md)
2. investigate: Read-only fact-finding & root cause reproduction
3. planner: Specification contracts & vertical DAG <= 350 LOC
4. implement: File lease locking, code edits & unit tests
5. reviewer: Adversarial audit, AST cycle check & approval gate
6. orchestrator: Session lifecycle & DAG coordination

Dispatch with tool: 'cortex_subagent'
`.trim();
      ctx.ui.notify(text, "info");
    },
  });
}
