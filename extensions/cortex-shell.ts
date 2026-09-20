import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { syncSkillRegistry } from "../lib/skill-registry.ts";
import {
  createCortexStatusSnapshotStore,
  type CortexStatusSnapshot,
  type CortexStatusSnapshotStore,
} from "../lib/cortex-cli.ts";
import { CortexPromptEditor } from "../lib/cortex-prompt.ts";
import {
  renderCortexStatusBar,
  type CortexStatusBarModel,
} from "../lib/cortex-status-bar.ts";
import {
  parsePorcelain,
  parseNumstat,
  type ChangedFile,
} from "../lib/cortex-changes.ts";

const execAsync = promisify(exec);

export function renderCompactWidget(
  snapshot: CortexStatusSnapshot,
  options: { theme?: { fg(token: string, text: string): string }; maxWidth?: number } = {}
): string {
  const maxWidth = options.maxWidth ?? 80;
  if (snapshot.state === "unavailable") {
    return truncateToWidth(`🧠 CORTEX: [unavailable]`, maxWidth);
  }

  const selected = snapshot.selectedBoard;
  if (!selected) {
    return truncateToWidth(`🧠 CORTEX: [no active board]`, maxWidth);
  }

  const done = snapshot.items.filter((i) => i.status === "done").length;
  const total = snapshot.items.length;
  const inProg = snapshot.items.filter((i) => i.status === "in_progress").length;
  const inRev = snapshot.items.filter((i) => i.status === "in_review").length;

  const text = `🧠 CORTEX: [${selected.board_id}] · ${done}/${total} done · ${inProg} running · ${inRev} review | :7331`;
  return truncateToWidth(text, maxWidth);
}

export default function registerCortexShell(
  pi: ExtensionAPI,
  store: CortexStatusSnapshotStore = createCortexStatusSnapshotStore()
): void {
  let activePromptEditor: CortexPromptEditor | undefined;
  let activeBranch = "main";
  let dirtyCount = 0;
  let changedFiles: ChangedFile[] = [];
  let cachedSnapshot: CortexStatusSnapshot | null = null;

  async function updateSnapshot() {
    try {
      cachedSnapshot = await store.getSnapshot();
    } catch {
      // ignore
    }
  }

  async function refreshGitStatus(cwd: string) {
    try {
      const { stdout: branchOut } = await execAsync(`git -C "${cwd}" branch --show-current`);
      activeBranch = branchOut.trim() || "HEAD";
    } catch {
      activeBranch = "no-git";
    }

    try {
      const { stdout: porcelain } = await execAsync(`git -C "${cwd}" status --porcelain -z`);
      const { stdout: numstat } = await execAsync(`git -C "${cwd}" diff --numstat`);
      const statuses = parsePorcelain(porcelain);
      const counts = new Map(parseNumstat(numstat).map((c) => [c.path, c]));

      changedFiles = Array.from(statuses.entries()).map(([path, status]) => {
        const count = counts.get(path);
        return {
          path,
          status,
          added: count?.added ?? 0,
          deleted: count?.deleted ?? 0,
        };
      });
      dirtyCount = changedFiles.length;
    } catch {
      dirtyCount = 0;
      changedFiles = [];
    }
  }

  function installPrompt(ctx: ExtensionContext): void {
    if (!ctx.hasUI || ctx.ui.getEditorComponent?.()) return;
    try {
      ctx.ui.setEditorComponent((tui, theme, keybindings) => {
        const prompt = new CortexPromptEditor(tui, theme, keybindings, {
          fg: (color, text) => (theme as any).fg?.(color, text) ?? text,
          bold: (text) => (theme as any).bold?.(text) ?? text,
          requestRender: () => tui.requestRender(),
          pending: () => Boolean((ctx as any).hasPendingMessages?.()),
        });
        activePromptEditor = prompt;
        return prompt;
      });
    } catch {
      // Fallback if setEditorComponent is not supported
    }
  }

  function installStatusBar(ctx: ExtensionContext): void {
    if (!ctx.hasUI || !(ctx.ui as any).setFooter) return;
    try {
      (ctx.ui as any).setFooter((_tui: any, theme: any) => {
        return {
          render(width: number): string[] {
            const usage = ctx.getContextUsage?.();
            const model = ctx.model;
            const snapshot = cachedSnapshot;

            const done = snapshot?.items.filter((i) => i.status === "done").length ?? 0;
            const total = snapshot?.items.length ?? 0;

            const barModel: CortexStatusBarModel = {
              cwd: ctx.cwd || process.cwd(),
              branch: activeBranch,
              dirty: dirtyCount > 0 ? dirtyCount : undefined,
              sessionName: ctx.sessionManager?.getSessionName?.(),
              modelId: model?.id ?? "cortex-agent",
              effort: model?.reasoning ? pi.getThinkingLevel?.() : undefined,
              contextPercent: usage?.percent ?? null,
              contextWindow: usage?.contextWindow ?? model?.contextWindow ?? 0,
              boardId: snapshot?.selectedBoard?.board_id,
              tasksDone: done,
              tasksTotal: total,
              cognitiveConnected: snapshot?.ledger?.state === "available",
            };

            const themeAdapter = {
              fg: (color: string, text: string) => theme.fg?.(color, text) ?? text,
              bold: (text: string) => theme.bold?.(text) ?? text,
            };

            return renderCortexStatusBar(barModel, themeAdapter, width);
          },
          invalidate() {},
          dispose() {},
        };
      });
    } catch {
      // Fallback if setFooter is not available
    }
  }

  pi.on("session_start", async (_event, ctx) => {
    const cwd = ctx.cwd || process.cwd();
    syncSkillRegistry(cwd).catch(() => {});
    installPrompt(ctx);
    installStatusBar(ctx);
    refreshGitStatus(cwd).catch(() => {});
    updateSnapshot().catch(() => {});
  });

  pi.on("before_agent_start", async (event, ctx) => {
    activePromptEditor?.setWorking(true);
    refreshGitStatus(ctx.cwd || process.cwd()).catch(() => {});
    updateSnapshot().catch(() => {});

    const cortexDirective = `
<cortex-ia-governance>
You are governed by the Cortex-IA deterministic multi-agent control plane and Cortex cognitive memory.
1. Determinism over narration: Never claim a task is complete without tool execution and verified tests.
2. File Leases: Before writing or editing any code file, acquire an exclusive lease via 'cortex_lease' (action: "lease").
3. CAS Transitions: Claim tasks via 'cortex_work' (action: "claim") and transition them with 'claim_token'.
4. Separation of Authority: Implementers cannot self-approve. Tasks require independent review ('cortex_work' action: "approve") with verdict PASS and evidence.
5. Workload Budget: Source logic changes must stay <= 350 lines (Go/Rust) or <= 250 lines (TS/Python). Test suites <= 600 lines.
6. Correction Budget: If fixing a reported issue, keep changes strictly within budget min(200, ceil(delta_lines / 2)).
7. Dual Ledger: Record verified facts and progress evaluations with 'cortex_ledger'.
8. Cognitive Memory & AST: Search persistent memories with 'cortex_search', save critical learnings with 'cortex_save', and inspect code cycles/blast radius with 'cortex_ast'.
9. Canonical Subagents: When handling multi-phase initiatives, dispatch specialized roles via 'cortex_subagent' (discovery, investigate, planner, implement, reviewer).
10. Architectural decisions: When facing 2-4 ambiguous options, ask the user using 'cortex_ask_choice'.
</cortex-ia-governance>
`.trim();

    return {
      systemPrompt: `${event.systemPrompt}\n\n${cortexDirective}`,
    };
  });

  pi.on("agent_end", async () => {
    activePromptEditor?.setWorking(false);
  });

  pi.on("turn_end", async () => {
    activePromptEditor?.setWorking(false);
  });

  pi.on("tool_execution_end", async (event, ctx) => {
    if (event.toolName.startsWith("cortex_") || event.toolName === "edit" || event.toolName === "write") {
      store.invalidate();
      updateSnapshot().catch(() => {});
      refreshGitStatus(ctx.cwd || process.cwd()).catch(() => {});
    }
  });
}
