import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { paintGauge } from "./cortex-gauge.ts";

// Cortex-IA Neural Status Bar: High-density single-line status bar
// displaying active model, thinking effort, visual context gauge,
// Git status with uncommitted delta, and live SQLite DAG progress.

export interface CortexStatusBarModel {
  cwd: string;
  branch: string | null;
  dirty?: number;
  sessionName?: string;
  modelId: string;
  effort?: string;
  contextPercent: number | null;
  contextWindow: number;
  boardId?: string;
  tasksDone?: number;
  tasksTotal?: number;
  cognitiveConnected?: boolean;
}

export interface StatusBarTheme {
  fg(color: string, text: string): string;
  bold(text: string): string;
}

const ROLE = {
  BRAND: "accent",
  SEPARATOR: "dim",
  PATH: "muted",
  BRANCH: "text",
  DIRTY: "warning",
  MODEL: "text",
  EFFORT: "customMessageLabel",
  LABEL: "muted",
  VALUE: "text",
  DAG: "accent",
  COGNITIVE: "success",
} as const;

export const STATUS_BAR_BRAND = "🧠 CORTEX · IA";
export const STATUS_BAR_SEPARATOR = "⟡";
const COMPACT_BRANCH_WIDTH = 14;

export function formatTokens(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 10_000) return `${(count / 1000).toFixed(1)}k`;
  if (count < 1_000_000) return `${Math.round(count / 1000)}k`;
  return `${(count / 1_000_000).toFixed(1)}M`;
}

function clipText(text: string, max: number): string {
  let clipped = "";
  for (const char of text) {
    if (visibleWidth(clipped + char) > max - 1) break;
    clipped += char;
  }
  return `${clipped}…`;
}

function buildSegments(model: CortexStatusBarModel, theme: StatusBarTheme): string[] {
  const dirty = model.dirty ? ` ${theme.fg(ROLE.DIRTY, `±${model.dirty}`)}` : "";
  const location = model.branch
    ? `${theme.fg(ROLE.PATH, model.cwd)} ${theme.fg(ROLE.BRANCH, model.branch)}${dirty}`
    : theme.fg(ROLE.PATH, model.cwd) + dirty;

  const modelSegment = model.effort
    ? `${theme.fg(ROLE.MODEL, model.modelId)} ${theme.fg(ROLE.LABEL, "·")} ${theme.fg(ROLE.EFFORT, model.effort)}`
    : theme.fg(ROLE.MODEL, model.modelId);

  const percentText = model.contextPercent === null ? "?%" : `${Math.round(model.contextPercent)}%`;
  const context = `${theme.fg(ROLE.LABEL, "ctx")} ${paintGauge(model.contextPercent, theme)} ${theme.fg(ROLE.VALUE, percentText)}`;

  const dagSegment = model.boardId
    ? `${theme.fg(ROLE.DAG, `[${model.boardId}]`)} ${theme.fg(ROLE.VALUE, `${model.tasksDone ?? 0}/${model.tasksTotal ?? 0}`)}`
    : theme.fg(ROLE.LABEL, "no board");

  const cognitive = model.cognitiveConnected !== false
    ? theme.fg(ROLE.COGNITIVE, ":7331")
    : theme.fg(ROLE.SEPARATOR, ":7331 (off)");

  return [
    theme.fg(ROLE.BRAND, STATUS_BAR_BRAND),
    location,
    modelSegment,
    context,
    dagSegment,
    cognitive,
  ];
}

function compactModel(model: CortexStatusBarModel): CortexStatusBarModel {
  const parts = model.cwd.split(/[\\/]/).filter((p) => p.length > 0);
  const cwd = parts.length > 0 ? parts[parts.length - 1]! : model.cwd;
  const branch =
    model.branch && visibleWidth(model.branch) > COMPACT_BRANCH_WIDTH
      ? clipText(model.branch, COMPACT_BRANCH_WIDTH)
      : model.branch;
  return { ...model, cwd, branch };
}

function joinSegments(segments: string[], theme: StatusBarTheme): string {
  return segments.join(` ${theme.fg(ROLE.SEPARATOR, STATUS_BAR_SEPARATOR)} `);
}

export function renderCortexStatusBar(
  model: CortexStatusBarModel,
  theme: StatusBarTheme,
  width: number
): string[] {
  const fullSegments = buildSegments(model, theme);
  const fullLine = joinSegments(fullSegments, theme);

  if (visibleWidth(fullLine) <= width) {
    return [truncateToWidth(fullLine, width, "")];
  }

  // Compact location fallback
  const compacted = compactModel(model);
  const compactSegments = buildSegments(compacted, theme);
  const compactLine = joinSegments(compactSegments, theme);

  if (visibleWidth(compactLine) <= width) {
    return [truncateToWidth(compactLine, width, "")];
  }

  // Ultra-compact: drop brand and cognitive port on narrow screens
  const minimalSegments = [
    compactSegments[1]!, // location
    compactSegments[2]!, // model
    compactSegments[3]!, // context
    compactSegments[4]!, // dag
  ];
  return [truncateToWidth(joinSegments(minimalSegments, theme), width, "")];
}
