import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  renderCard,
  cardTop,
  cardLine,
  cardBottom,
  cardInnerWidth,
  CARD_TONE,
  type Card,
} from "../lib/cortex-card.ts";
import {
  renderGauge,
  gaugeTone,
  paintGauge,
  GAUGE_CELLS,
} from "../lib/cortex-gauge.ts";
import {
  framePromptLines,
  synapticGlyph,
  synapticTone,
  withPromptHint,
  PROMPT_STATE,
} from "../lib/cortex-prompt.ts";
import {
  renderCortexStatusBar,
  formatTokens,
  type CortexStatusBarModel,
} from "../lib/cortex-status-bar.ts";
import {
  parseNumstat,
  parsePorcelain,
  evaluateWorkloadBudget,
  renderChangesWidgetSummary,
  type ChangedFile,
} from "../lib/cortex-changes.ts";
import { renderDagCard } from "../extensions/cortex-todo.ts";
import type { CortexStatusSnapshot } from "../lib/cortex-cli.ts";

const mockTheme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
};

describe("Cortex-IA Visual Shell Primitives", () => {
  describe("Cortex Card Engine (lib/cortex-card.ts)", () => {
    it("renders cards with rounded borders and title", () => {
      const card: Card = {
        title: "Test Card",
        subtitle: "Subtitle",
        body: ["Line one of content", "Line two of content"],
        tone: CARD_TONE.INFO,
      };

      const lines = renderCard(card, mockTheme, 60, { expanded: true });
      assert.ok(lines.length >= 4);
      assert.ok(lines[0]!.includes("╭─"));
      assert.ok(lines[0]!.includes("Test Card"));
      assert.ok(lines[0]!.includes("Subtitle"));
      assert.ok(lines[lines.length - 1]!.includes("╰─"));
    });

    it("renders keyboard hint in the top border when provided", () => {
      const card: Card = {
        title: "DAG Task",
        body: ["task body"],
        tone: CARD_TONE.NEURAL,
      };

      const lines = renderCard(card, mockTheme, 70, { hint: "[ctrl+shift+t]" });
      assert.ok(lines[0]!.includes("[ctrl+shift+t]"));
    });

    it("collapses multi-line body to a single line when expanded is false", () => {
      const card: Card = {
        title: "Summary",
        body: ["First paragraph", "Second paragraph"],
        tone: CARD_TONE.SUCCESS,
      };

      const collapsed = renderCard(card, mockTheme, 60, { expanded: false });
      assert.equal(collapsed.length, 3);
      assert.ok(collapsed[1]!.includes("First paragraph"));
    });

    it("handles narrow widths safely", () => {
      assert.equal(cardInnerWidth(20), 16);
      assert.equal(cardTop({ title: "T", body: [], tone: CARD_TONE.INFO }, mockTheme, 0), "");
      assert.ok(cardBottom(CARD_TONE.WARNING, mockTheme, 10).includes("╰"));
    });
  });

  describe("Cortex Gauge Engine (lib/cortex-gauge.ts)", () => {
    it("calculates filled and empty cells accurately", () => {
      const g0 = renderGauge(0, 5);
      assert.equal(g0.filled, 0);
      assert.equal(g0.empty, 5);

      const g50 = renderGauge(50, 5);
      assert.equal(g50.filled, 3);
      assert.equal(g50.empty, 2);

      const g100 = renderGauge(100, 5);
      assert.equal(g100.filled, 5);
      assert.equal(g100.empty, 0);
    });

    it("evaluates chromatic tones across thresholds", () => {
      assert.equal(gaugeTone(25), "optimal");
      assert.equal(gaugeTone(60), "warning");
      assert.equal(gaugeTone(85), "critical");
    });

    it("paints formatted gauge string", () => {
      const painted = paintGauge(40, mockTheme, GAUGE_CELLS);
      assert.ok(painted.startsWith("["));
      assert.ok(painted.endsWith("]"));
      assert.ok(painted.includes("▰") || painted.includes("▱"));
    });
  });

  describe("Cortex Prompt Framing (lib/cortex-prompt.ts)", () => {
    it("cycles synaptic glyphs and tones according to state", () => {
      assert.equal(synapticGlyph(PROMPT_STATE.IDLE, 0), "◈");
      assert.equal(synapticGlyph(PROMPT_STATE.APPROVAL, 0), "⚖");
      assert.equal(synapticGlyph(PROMPT_STATE.WORKING, 0), "◈");
      assert.equal(synapticGlyph(PROMPT_STATE.WORKING, 1), "⚡");
      assert.equal(synapticGlyph(PROMPT_STATE.WORKING, 2), "◉");
      assert.equal(synapticGlyph(PROMPT_STATE.WORKING, 3), "✦");

      assert.equal(synapticTone(PROMPT_STATE.QUEUED, 0), "warning");
      assert.equal(synapticTone(PROMPT_STATE.APPROVAL, 0), "success");
    });

    it("frames prompt lines with top, side, and bottom rules", () => {
      const inputLines = ["", "user prompt text", ""];
      const framed = framePromptLines(inputLines, 60, {
        state: PROMPT_STATE.IDLE,
        tick: 0,
        borderColor: (s) => s,
        fg: (_c, s) => s,
      });

      assert.equal(framed.length, 3);
      assert.ok(framed[0]!.includes("╭─"));
      assert.ok(framed[0]!.includes("◈"));
      assert.ok(framed[1]!.includes("│"));
      assert.ok(framed[1]!.includes("user prompt text"));
      assert.ok(framed[2]!.includes("╰─"));
    });

    it("injects placeholder hint when line is empty", () => {
      const hinted = withPromptHint("", "type here", (_c, s) => s);
      assert.equal(hinted, "type here");
    });
  });

  describe("Cortex Status Bar (lib/cortex-status-bar.ts)", () => {
    it("formats tokens correctly", () => {
      assert.equal(formatTokens(500), "500");
      assert.equal(formatTokens(4500), "4.5k");
      assert.equal(formatTokens(125000), "125k");
      assert.equal(formatTokens(2500000), "2.5M");
    });

    it("renders all segments on wide terminals", () => {
      const model: CortexStatusBarModel = {
        cwd: "d:/lleontor705/pi-cortex-ia",
        branch: "main",
        dirty: 3,
        modelId: "claude-3-7-sonnet",
        effort: "high",
        contextPercent: 42,
        contextWindow: 200000,
        boardId: "sdd-init",
        tasksDone: 4,
        tasksTotal: 8,
        cognitiveConnected: true,
      };

      const lines = renderCortexStatusBar(model, mockTheme, 130);
      assert.equal(lines.length, 1);
      const bar = lines[0]!;
      assert.ok(bar.includes("CORTEX · IA"));
      assert.ok(bar.includes("main ±3"));
      assert.ok(bar.includes("claude-3-7-sonnet"));
      assert.ok(bar.includes("42%"));
      assert.ok(bar.includes("[sdd-init] 4/8"));
      assert.ok(bar.includes(":7331"));
    });

    it("falls back to compact representation on narrow terminals", () => {
      const model: CortexStatusBarModel = {
        cwd: "d:/lleontor705/pi-cortex-ia",
        branch: "feature/very-long-branch-name-that-would-overflow",
        modelId: "gpt-4o",
        contextPercent: 80,
        contextWindow: 128000,
      };

      const lines = renderCortexStatusBar(model, mockTheme, 65);
      assert.equal(lines.length, 1);
      assert.ok(lines[0]!.length <= 65);
    });
  });

  describe("Cortex Git & Workload Budget (lib/cortex-changes.ts)", () => {
    it("parses numstat output accurately", () => {
      const raw = "15\t4\tsrc/index.ts\n32\t0\ttests/index.test.ts\n";
      const entries = parseNumstat(raw);
      assert.equal(entries.length, 2);
      assert.equal(entries[0]!.path, "src/index.ts");
      assert.equal(entries[0]!.added, 15);
      assert.equal(entries[0]!.deleted, 4);
    });

    it("parses porcelain z-delimited output", () => {
      const porcelain = " M src/lib.ts\0?? newfile.ts\0";
      const statuses = parsePorcelain(porcelain);
      assert.equal(statuses.get("src/lib.ts"), "modified");
      assert.equal(statuses.get("newfile.ts"), "untracked");
    });

    it("enforces Cortex-IA Review Workload Budget (<= 350 LOC)", () => {
      const compliantFiles: ChangedFile[] = [
        { path: "src/algo.ts", added: 120, deleted: 10, status: "modified" },
        { path: "tests/algo.test.ts", added: 250, deleted: 5, status: "added" },
      ];

      const resPass = evaluateWorkloadBudget(compliantFiles);
      assert.equal(resPass.verdict, "PASS");

      const excessiveFiles: ChangedFile[] = [
        { path: "src/big-feature.ts", added: 400, deleted: 20, status: "modified" },
      ];
      const resFail = evaluateWorkloadBudget(excessiveFiles);
      assert.equal(resFail.verdict, "EXCEEDED_SOURCE");
      assert.ok(resFail.reason?.includes("exceed Cortex-IA budget limit"));
    });

    it("renders changes widget summary string", () => {
      const files: ChangedFile[] = [
        { path: "src/algo.ts", added: 25, deleted: 5, status: "modified" },
      ];
      const evalPass = evaluateWorkloadBudget(files);
      const summary = renderChangesWidgetSummary(files, evalPass, { maxWidth: 80 });
      assert.ok(summary.includes("1 file (+25 / -5)"));
      assert.ok(summary.includes("Workload:"));
      assert.ok(summary.includes("[PASS]"));
    });
  });

  describe("Cortex DAG Card Widget (extensions/cortex-todo.ts)", () => {
    it("renders available board tasks with status glyphs", () => {
      const snapshot: CortexStatusSnapshot = {
        state: "available",
        cwd: "d:/lleontor705/pi-cortex-ia",
        counts: { done: 1, in_progress: 1 },
        selectedBoard: {
          board_id: "board-sdd-01",
          title: "Implement Authentication",
          description: "Auth flow",
          status: "active",
          counts: { done: 1, in_progress: 1 },
          created_at: "2026-09-12",
          updated_at: "2026-09-12",
        },
        boards: [],
        items: [
          {
            id: "task-001",
            title: "Types Scaffolding",
            status: "done",
            created_at: "2026-09-12",
            updated_at: "2026-09-12",
          },
          {
            id: "task-002",
            title: "JWT Middleware",
            status: "in_progress",
            created_at: "2026-09-12",
            updated_at: "2026-09-12",
          },
        ],
      };

      const lines = renderDagCard(snapshot, { expanded: true, maxWidth: 80 });
      assert.ok(lines.length >= 4);
      assert.ok(lines[0]!.includes("Cortex Task DAG"));
      assert.ok(lines[0]!.includes("1/2 done"));
      const body = lines.join("\n");
      assert.ok(body.includes("task-002"));
      assert.ok(body.includes("JWT Middleware"));
      assert.ok(body.includes("task-001"));
      assert.ok(body.includes("Types Scaffolding"));
    });

    it("renders offline error card when snapshot is unavailable", () => {
      const snapshot: CortexStatusSnapshot = {
        state: "unavailable",
        cwd: "d:/lleontor705/pi-cortex-ia",
        counts: {},
        unavailableReason: "daemon offline",
        boards: [],
        items: [],
      };

      const lines = renderDagCard(snapshot, { maxWidth: 80 });
      assert.ok(lines.join("\n").includes("Control plane daemon unavailable"));
    });
  });
});
