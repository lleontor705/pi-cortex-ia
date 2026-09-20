import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Text, truncateToWidth } from "@earendil-works/pi-tui";
import {
  createCortexStatusSnapshotStore,
  type CortexStatusSnapshot,
  type CortexStatusSnapshotStore,
  type CortexWorkItem,
} from "../lib/cortex-cli.ts";
import {
  renderCard,
  CARD_TONE,
  type Card,
  type CardTone,
} from "../lib/cortex-card.ts";

const DAG_WIDGET_KEY = "cortex-dag-widget";

export function formatTaskLine(item: CortexWorkItem): string {
  let icon = "⚪";
  switch (item.status) {
    case "ready":
      icon = "🟢";
      break;
    case "in_progress":
      icon = "🏃";
      break;
    case "in_review":
      icon = "🔍";
      break;
    case "done":
      icon = "✅";
      break;
    case "blocked":
      icon = "⛔";
      break;
    case "backlog":
    default:
      icon = "⏳";
      break;
  }
  return `${icon} [${item.id}] ${item.title} (${item.status})`;
}

export function renderBoardDetail(
  snapshot: CortexStatusSnapshot,
  options: { maxWidth?: number } = {}
): string {
  const maxWidth = options.maxWidth ?? 80;
  if (snapshot.state === "unavailable") {
    return truncateToWidth(`⛔ Cortex Board Unavailable: ${snapshot.unavailableReason ?? "offline"}`, maxWidth);
  }

  const active = snapshot.selectedBoard;
  if (!active) {
    return truncateToWidth("No Cortex boards found in this workspace.", maxWidth);
  }

  const done = snapshot.items.filter((i) => i.status === "done").length;
  const total = snapshot.items.length;
  const lines: string[] = [
    truncateToWidth(`🧠 Cortex Board: [${active.board_id}] "${active.title}" (${done}/${total} done)`, maxWidth),
  ];

  if (snapshot.ledger?.state === "available") {
    lines.push(
      truncateToWidth(
        `  Ledger: ${snapshot.ledger.counts?.facts ?? 0} facts, ${snapshot.ledger.counts?.progress ?? 0} progress (${snapshot.ledger.counts?.drift ?? 0} drift)`,
        maxWidth
      )
    );
  }

  for (const item of snapshot.items) {
    lines.push(truncateToWidth(`  ${formatTaskLine(item)}`, maxWidth));
  }

  lines.push(
    truncateToWidth("Tip: Claim tasks with 'cortex_work' (action: 'claim') and lease files before editing.", maxWidth)
  );

  return lines.join("\n");
}

export function renderDagCard(
  snapshot: CortexStatusSnapshot,
  options: {
    expanded?: boolean;
    maxWidth?: number;
    theme?: { fg(color: string, text: string): string };
  } = {}
): string[] {
  const maxWidth = options.maxWidth ?? 80;
  const expanded = options.expanded ?? true;
  const theme = options.theme ?? {
    fg: (_c: string, text: string) => text,
  };

  if (snapshot.state === "unavailable") {
    const card: Card = {
      title: "Cortex DAG Control Plane",
      subtitle: "Offline",
      body: ["Control plane daemon unavailable. Run /cortex:doctor to diagnose."],
      tone: CARD_TONE.ERROR,
      glyph: "⛔",
    };
    return renderCard(card, theme, maxWidth, { expanded: true });
  }

  const selected = snapshot.selectedBoard;
  if (!selected) {
    const card: Card = {
      title: "Cortex DAG Control Plane",
      subtitle: "No Active Board",
      body: ["No active SQLite DAG board in workspace. Plan tasks with /cortex:plan."],
      tone: CARD_TONE.INFO,
      glyph: "🧠",
    };
    return renderCard(card, theme, maxWidth, { expanded: true });
  }

  const done = snapshot.items.filter((i) => i.status === "done").length;
  const total = snapshot.items.length;
  const inProgress = snapshot.items.filter((i) => i.status === "in_progress");
  const inReview = snapshot.items.filter((i) => i.status === "in_review");
  const blocked = snapshot.items.filter((i) => i.status === "blocked");

  let tone: CardTone = CARD_TONE.INFO;
  if (blocked.length > 0) tone = CARD_TONE.WARNING;
  else if (total > 0 && done === total) tone = CARD_TONE.SUCCESS;

  const body: string[] = [];

  if (expanded) {
    const activeItems = snapshot.items.filter(
      (i) => i.status === "in_progress" || i.status === "in_review" || i.status === "ready" || i.status === "blocked"
    );
    const doneItems = snapshot.items.filter((i) => i.status === "done");

    if (activeItems.length === 0 && doneItems.length === 0) {
      body.push("No tasks queued in this board.");
    } else {
      for (const item of activeItems) {
        body.push(formatTaskLine(item));
      }
      for (const item of doneItems.slice(-2)) {
        body.push(formatTaskLine(item));
      }
      if (doneItems.length > 2) {
        body.push(`  … +${doneItems.length - 2} more completed`);
      }
    }
  } else {
    body.push(
      `${done}/${total} done · ${inProgress.length} running · ${inReview.length} review`
    );
  }

  const card: Card = {
    title: "Cortex Task DAG",
    subtitle: `[${selected.board_id}] ${done}/${total} done`,
    body,
    tone,
    glyph: "◈",
  };

  return renderCard(card, theme, maxWidth, {
    expanded,
    hint: "[ctrl+shift+t]",
  });
}

export default function registerCortexTodo(
  pi: ExtensionAPI,
  store: CortexStatusSnapshotStore = createCortexStatusSnapshotStore()
): void {
  let isWidgetExpanded = true;

  async function updateFloatingWidget(ctx: ExtensionContext) {
    if (!ctx.hasUI || !ctx.ui) return;
    try {
      const snapshot = await store.getSnapshot();
      ctx.ui.setWidget(DAG_WIDGET_KEY, (_tui, theme) => {
        const lines = renderDagCard(snapshot, {
          expanded: isWidgetExpanded,
          maxWidth: 80,
          theme: {
            fg: (color, text) => (theme as any).fg?.(color, text) ?? text,
          },
        });
        return new Text(lines.join("\n"), 0, 0);
      });
    } catch {
      // Ignore widget rendering errors silently
    }
  }

  pi.registerCommand("cortex:toggle-dag", {
    description: "Toggle expanded/collapsed view of the active Cortex DAG task card.",
    handler: async (_args, ctx) => {
      isWidgetExpanded = !isWidgetExpanded;
      await updateFloatingWidget(ctx as any);
      ctx.ui.notify(
        `Cortex DAG widget: ${isWidgetExpanded ? "expanded" : "collapsed"}`,
        "info"
      );
    },
  });

  pi.registerCommand("cortex:board", {
    description: "Display the active Cortex-IA Task DAG board with real-time status icons.",
    handler: async (_args: unknown, ctx: any) => {
      try {
        const snapshot = await store.getSnapshot();
        const detail = renderBoardDetail(snapshot, { maxWidth: 80 });
        ctx.ui.notify(detail, snapshot.state === "available" ? "info" : "error");
      } catch (err: any) {
        ctx.ui.notify(`Failed to render board: ${err.message}`, "error");
      }
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    updateFloatingWidget(ctx).catch(() => {});
  });

  pi.on("tool_execution_end", async (event, ctx) => {
    if (event.toolName.startsWith("cortex_")) {
      store.invalidate();
      updateFloatingWidget(ctx).catch(() => {});
    }
  });
}
