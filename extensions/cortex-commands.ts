import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  boardList,
  boardStatus,
  cortexDoctor,
  launchWebDashboard,
  workRecover,
} from "../lib/cortex-cli.ts";
import { syncSkillRegistry } from "../lib/skill-registry.ts";

export default function registerCortexCommands(pi: ExtensionAPI): void {
  // /cortex:status
  pi.registerCommand("cortex:status", {
    description: "Check Cortex-IA boards, active task DAG status, and file leases.",
    handler: async (_args: unknown, ctx: any) => {
      const cwd = ctx.cwd || process.cwd();
      try {
        const boards = await boardList(cwd);
        const activeBoard = boards.find((b) => b.status === "active") || boards[0];
        if (!activeBoard) {
          ctx.ui.notify("No Cortex boards found in this workspace.", "warning");
          return;
        }

        const details = await boardStatus(activeBoard.board_id, cwd);
        const readyCount = details.items.filter((i) => i.status === "ready").length;
        const inProgressCount = details.items.filter((i) => i.status === "in_progress").length;
        const inReviewCount = details.items.filter((i) => i.status === "in_review").length;
        const doneCount = details.items.filter((i) => i.status === "done").length;

        const summary = `Cortex Board: [${activeBoard.board_id}] "${activeBoard.title}"\nTasks: ${doneCount} done, ${inProgressCount} in_progress, ${inReviewCount} in_review, ${readyCount} ready. Total: ${details.items.length}`;
        ctx.ui.notify(summary, "info");
      } catch (err: any) {
        ctx.ui.notify(`Failed to fetch Cortex status: ${err.message}`, "error");
      }
    },
  });

  // /cortex:doctor
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

  // /cortex:web
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

  // /cortex:skills
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

  // /cortex:recover
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
}
