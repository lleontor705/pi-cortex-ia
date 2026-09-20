export type GaugeTone = "optimal" | "warning" | "critical";

export interface GaugeTheme {
  fg(color: string, text: string): string;
}

export const GAUGE_CELLS = 5;

const GAUGE_BLOCK_FILLED = "▰";
const GAUGE_BLOCK_EMPTY = "▱";

export function gaugeTone(percent: number | null | undefined): GaugeTone {
  if (percent === null || percent === undefined) return "optimal";
  if (percent >= 80) return "critical";
  if (percent >= 55) return "warning";
  return "optimal";
}

export function renderGauge(percent: number | null | undefined, cells: number = GAUGE_CELLS): {
  filled: number;
  empty: number;
  text: string;
} {
  const p = Math.max(0, Math.min(100, percent ?? 0));
  const filled = Math.round((p / 100) * cells);
  const empty = Math.max(0, cells - filled);
  const text = GAUGE_BLOCK_FILLED.repeat(filled) + GAUGE_BLOCK_EMPTY.repeat(empty);
  return { filled, empty, text };
}

const TONE_COLOR_MAP: Record<GaugeTone, string> = {
  optimal: "success",
  warning: "warning",
  critical: "error",
};

export function paintGauge(
  percent: number | null | undefined,
  theme: GaugeTheme,
  cells: number = GAUGE_CELLS
): string {
  const { filled, empty } = renderGauge(percent, cells);
  const tone = gaugeTone(percent);
  const color = TONE_COLOR_MAP[tone];

  const filledStr = filled > 0 ? theme.fg(color, GAUGE_BLOCK_FILLED.repeat(filled)) : "";
  const emptyStr = empty > 0 ? theme.fg("dim", GAUGE_BLOCK_EMPTY.repeat(empty)) : "";
  return `[${filledStr}${emptyStr}]`;
}
