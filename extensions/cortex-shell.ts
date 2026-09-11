import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { syncSkillRegistry } from "../lib/skill-registry.ts";
import { boardList, boardStatus } from "../lib/cortex-cli.ts";

const CORTEX_WIDGET_KEY = "cortex-board-status";

export default function registerCortexShell(pi: ExtensionAPI): void {
  // Update or render widget
  async function updateWidget(ctx: ExtensionContext) {
    if (!ctx.hasUI || !ctx.ui) return;
    try {
      const cwd = ctx.cwd || process.cwd();
      const boards = await boardList(cwd);
      const active = boards.find((b) => b.status === "active") || boards[0];
      if (!active) return;

      const details = await boardStatus(active.board_id, cwd);
      const counts = active.counts || {};
      const done = counts.done || 0;
      const total = details.items.length;
      const inProg = counts.in_progress || 0;

      const text = `🧠 CORTEX-IA: Board [${active.board_id}] · ${done}/${total} done · ${inProg} in_progress | Web: http://127.0.0.1:7331`;
      ctx.ui.setWidget(CORTEX_WIDGET_KEY, (_tui, theme) => {
        return new Text(theme.fg("accent", text), 0, 0);
      });
    } catch {
      // Ignore widget fetch errors silently
    }
  }

  pi.on("session_start", async (_event, ctx) => {
    // 1. Automatically refresh skill registry in background
    syncSkillRegistry(ctx.cwd || process.cwd()).catch(() => {});
    // 2. Set widget
    updateWidget(ctx).catch(() => {});
  });

  pi.on("before_agent_start", async (event, _ctx) => {
    const cortexDirective = `
<cortex-ia-governance>
You are governed by the Cortex-IA deterministic multi-agent control plane.
1. Determinism over narration: Never claim a task is complete without tool execution and verified tests.
2. File Leases: Before writing or editing any code file, acquire an exclusive lease via 'cortex_lease' (action: "lease").
3. CAS Transitions: Claim tasks via 'cortex_work' (action: "claim") and transition them with 'claim_token'.
4. Separation of Authority: Implementers cannot self-approve. Tasks require independent review ('cortex_work' action: "approve") with verdict PASS and evidence.
5. Correction Budget: If fixing a reported issue, keep your code changes strictly within the budget min(200, ceil(delta_lines / 2)).
6. Quiet Output: Use 'cortex_quiet_bash' for long commands to protect context window.
7. Architectural decisions: When facing 2-4 ambiguous options, ask the user using 'cortex_ask_choice'.
</cortex-ia-governance>
`.trim();

    return {
      systemPrompt: `${event.systemPrompt}\n\n${cortexDirective}`,
    };
  });

  pi.on("tool_execution_end", async (event, ctx) => {
    if (event.toolName.startsWith("cortex_")) {
      updateWidget(ctx).catch(() => {});
    }
  });
}
