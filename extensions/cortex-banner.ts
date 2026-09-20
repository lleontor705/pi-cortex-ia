import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { VERSION } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import * as os from "node:os";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  createCortexStatusSnapshotStore,
  resolveCortexBinary,
  type CortexStatusSnapshot,
  type CortexStatusSnapshotStore,
} from "../lib/cortex-cli.ts";
import { resolveCortexMemoryBinary } from "../lib/cortex-memory-cli.ts";

const execAsync = promisify(exec);

export interface ThemeLike {
  fg(token: string, text: string): string;
}

export type BannerColor = "cyan" | "magenta" | "amber" | "green" | "indigo";

export interface BannerConfig {
  showBrain: boolean;
  showTextLogo: boolean;
  color: BannerColor;
  animated: boolean;
}

export const DEFAULT_BANNER_CONFIG: BannerConfig = {
  showBrain: true,
  showTextLogo: true,
  color: "cyan",
  animated: true,
};

export const BANNER_COLORS: BannerColor[] = [
  "cyan",
  "magenta",
  "amber",
  "green",
  "indigo",
];

export const BANNER_PALETTES: Record<
  BannerColor,
  {
    brain: [number, number, number];
    label: [number, number, number];
    value: [number, number, number];
    logoFresh: [number, number, number];
    logoDim: [number, number, number];
  }
> = {
  cyan: {
    brain: [34, 211, 238],
    label: [14, 116, 144],
    value: [56, 189, 248],
    logoFresh: [103, 232, 249],
    logoDim: [21, 94, 117],
  },
  magenta: {
    brain: [244, 114, 182],
    label: [190, 24, 93],
    value: [251, 207, 232],
    logoFresh: [244, 114, 182],
    logoDim: [131, 24, 67],
  },
  amber: {
    brain: [245, 158, 11],
    label: [180, 83, 9],
    value: [254, 240, 138],
    logoFresh: [251, 191, 36],
    logoDim: [120, 53, 15],
  },
  green: {
    brain: [16, 185, 129],
    label: [4, 120, 87],
    value: [167, 243, 208],
    logoFresh: [52, 211, 153],
    logoDim: [6, 78, 59],
  },
  indigo: {
    brain: [129, 140, 248],
    label: [79, 70, 229],
    value: [199, 210, 254],
    logoFresh: [165, 180, 252],
    logoDim: [49, 46, 129],
  },
};

export const CORTEX_TEXT_LOGO = [
  "  ██████╗  ██████╗ ██████╗ ████████╗███████╗██╗  ██╗      ██╗ █████╗ ",
  " ██╔════╝ ██╔═══██╗██╔══██╗╚══██╔══╝██╔════╝╚██╗██╔╝      ██║██╔══██╗",
  " ██║      ██║   ██║██████╔╝   ██║   █████╗   ╚███╔╝   ██╗ ██║███████║",
  " ██║      ██║   ██║██╔══██╗   ██║   ██╔══╝   ██╔██╗   ╚═╝ ██║██╔══██║",
  " ╚██████╗ ╚██████╔╝██║  ██║   ██║   ███████╗██╔╝ ██╗  ██╗ ██║██║  ██║",
  "  ╚═════╝  ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝  ╚═╝ ╚═╝╚═╝  ╚═╝",
  "        A D A P T I V E   D E V E L O P M E N T   H A R N E S S      ",
];

export const CORTEX_BRAIN_RAW = [
  "             ⣀⣤⣠⣄⣀⣀⣀⣤⣤⣤⣀⡀            ",
  "        ⢀⡤⠐⢲⣾⣿⣿⢿⣿⣿⡝⣿⢿⣿⣿⣿⣿⣿⣶⣀         ",
  "     ⢀⢠⣴⣁⠔⢉⠝⠛⠃⡈⣿⠏ ⢸⠁⡠⡒⣳⣿⠛⠋⢟⢻⢹⣦⣄      ",
  "    ⣠⣿⣿⡷⢡⠔⠁⢀⣴⣤⡃⢸⢰⢁⢸⡀⢹⠉⢻⡝⢳⣶⡎⣎⢹⣿⣿⣿⡆    ",
  "   ⣰⣿⡿⡩⠃⠃⢃⡴⡛⢻⠻⣿⢿⣹⠰⣿⣖⢸ ⢸⢸⠈⠉ ⡇⣿⣿⣿⣿⣿⣄   ",
  "   ⢿⣿⣇⣀⢶⣶⠁⢀⠇⢸ ⡇⣹⣷⣸⡿⡽⠷⠶⠺⣶⠁⡠⠒⣁⠟⠉⣿⣿⣿⣿⡆  ",
  "   ⠸⡟⠑⠊⡤⣄⣘⠚⣄⣠⣷⡿⠿⠿⠋⡩⠂⣀⣀⣀⣀⣈⡠⠊⠡⠊⡠⠓⣿⣿⣿   ",
  "    ⠈⠣⣄⣉⣀⣨⣿⣿⣷⣕⣁⡤⠐⠂⢒⠚⡨⣓⡶⠒⠒⠒⠭⠒⠊⢠⣶⣿⣿⣿   ",
  "          ⠈⢿⣿⢿⠟ ⢀⡠⣓⣥⣾⣿⣷⣷⣶⣶⣶⣾⣿⣿⣿⣿⠏    ",
  "            ⠙⠴⠯⠭⠥⠜⠿⡿⠿⢿⣿⣿⣏⠩⠭⠭⢭⣿⡿⠃     ",
  "                   ⠈⠳⡐⣿⣿⣿⣶⣿⣿⠾⠋⠁      ",
  "                     ⠙⣴⣿⣿⡛⠁          ",
  "                      ⠘ ⠛⠃           ",
];

function rgb(r: number, g: number, b: number, text: string): string {
  return `\x1b[38;2;${r};${g};${b}m${text}\x1b[39m`;
}

function cortexConfigHome(): string {
  return (
    process.env.CORTEX_CONFIG_HOME ??
    join(os.homedir(), ".pi", "agent", "cortex")
  );
}

function bannerConfigPath(): string {
  return join(cortexConfigHome(), "banner.json");
}

export function normalizeBannerConfig(value: unknown): BannerConfig {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ...DEFAULT_BANNER_CONFIG };
  }
  const record = value as Record<string, unknown>;
  return {
    showBrain:
      typeof record.showBrain === "boolean"
        ? record.showBrain
        : DEFAULT_BANNER_CONFIG.showBrain,
    showTextLogo:
      typeof record.showTextLogo === "boolean"
        ? record.showTextLogo
        : DEFAULT_BANNER_CONFIG.showTextLogo,
    color: BANNER_COLORS.includes(record.color as BannerColor)
      ? (record.color as BannerColor)
      : DEFAULT_BANNER_CONFIG.color,
    animated:
      typeof record.animated === "boolean"
        ? record.animated
        : DEFAULT_BANNER_CONFIG.animated,
  };
}

export async function readBannerConfig(): Promise<BannerConfig> {
  try {
    const raw = await readFile(bannerConfigPath(), "utf8");
    return normalizeBannerConfig(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_BANNER_CONFIG };
  }
}

export async function writeBannerConfig(config: BannerConfig): Promise<void> {
  const path = bannerConfigPath();
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function paletteColor(
  color: BannerColor,
  key: keyof (typeof BANNER_PALETTES)[BannerColor],
  text: string
): string {
  const [r, g, b] = BANNER_PALETTES[color][key];
  return rgb(r, g, b, text);
}

function getBrainRgb(
  color: BannerColor,
  x: number,
  y: number,
  k: number,
  f: number
): [number, number, number] {
  if (color === "cyan") {
    // Official Cortex-IA brand gradient: Violet -> Cyan -> Emerald
    const normX = Math.min(1, Math.max(0, x / 40));
    const isLower = y >= 8;
    let r: number, g: number, b: number;
    if (isLower && normX < 0.6) {
      r = Math.floor(16 + normX * 20);
      g = Math.floor(185 - normX * 40);
      b = Math.floor(129 + normX * 100);
    } else if (normX < 0.45) {
      r = Math.floor(168 - normX * 120);
      g = Math.floor(85 + normX * 120);
      b = Math.floor(247 - normX * 20);
    } else {
      r = Math.floor(6 + (normX - 0.45) * 50);
      g = Math.floor(182 + (normX - 0.45) * 40);
      b = 248;
    }
    const rBase = Math.floor(r * k);
    const gBase = Math.floor(g * k);
    const bBase = Math.floor(b * k);
    return [
      Math.floor(rBase + (255 - rBase) * f),
      Math.floor(gBase + (255 - gBase) * f),
      Math.floor(bBase + (255 - bBase) * f),
    ];
  }

  const base = BANNER_PALETTES[color].brain;
  const rBase = Math.floor(base[0] * k);
  const gBase = Math.floor(base[1] * k);
  const bBase = Math.floor(base[2] * k);
  return [
    Math.floor(rBase + (255 - rBase) * f),
    Math.floor(gBase + (255 - gBase) * f),
    Math.floor(bBase + (255 - bBase) * f),
  ];
}

function getLogoRgb(
  color: BannerColor,
  localX: number
): [number, number, number] {
  if (color === "cyan") {
    if (localX >= 58) {
      // · IA in electric cyan
      return [34, 211, 238];
    }
    // CORTEX in violet -> cyan gradient
    const t = Math.min(1, Math.max(0, localX / 57));
    const r = Math.floor(168 * (1 - t) + 6 * t);
    const g = Math.floor(85 * (1 - t) + 182 * t);
    const b = Math.floor(247 * (1 - t) + 248 * t);
    return [r, g, b];
  }
  return BANNER_PALETTES[color].value;
}

function normalizeAscii(lines: string[]): string[] {
  const trimmed = lines.map((l) => l.replace(/\s+$/g, ""));
  const nonEmpty = trimmed.filter((l) => l.trim().length > 0);
  const minLead = nonEmpty.length
    ? Math.min(...nonEmpty.map((l) => (l.match(/^\s*/) || [""])[0].length))
    : 0;
  return trimmed.map((l) => (l.length >= minLead ? l.slice(minLead) : l));
}

function padLines(lines: string[]): { lines: string[]; width: number } {
  const width = Math.max(...lines.map((l) => l.length), 0);
  return { lines: lines.map((l) => l.padEnd(width)), width };
}

type CellType =
  | "banner"
  | "logo-tip"
  | "logo-fresh"
  | "logo-ink"
  | "brain"
  | "label"
  | "value"
  | "dim"
  | "accent"
  | "none";

type LayoutCell = { char: string; type: CellType };
type LogoCellType = Extract<
  CellType,
  "banner" | "logo-tip" | "logo-fresh" | "logo-ink"
>;

const LOGO_CELL_TYPES: ReadonlySet<CellType> = new Set<CellType>([
  "banner",
  "logo-tip",
  "logo-fresh",
  "logo-ink",
]);

function isLogoCellType(type: CellType): type is LogoCellType {
  return LOGO_CELL_TYPES.has(type);
}

type Span = { start: number; end: number };

function computeLogoBounds(lines: string[]): Span {
  let start = Number.POSITIVE_INFINITY;
  let end = Number.NEGATIVE_INFINITY;
  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      if (line[i] !== " ") {
        if (i < start) start = i;
        if (i > end) end = i;
      }
    }
  }
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return { start: 0, end: 0 };
  }
  return { start, end };
}

function buildLetterSpans(bounds: Span, weights: number[]): Span[] {
  const spanWidth = Math.max(1, bounds.end - bounds.start + 1);
  const total = weights.reduce((a, b) => a + b, 0);
  let cursor = bounds.start;
  return weights.map((w, i) => {
    const remaining = bounds.end - cursor + 1;
    const raw = Math.max(1, Math.round((w / total) * spanWidth));
    const width =
      i === weights.length - 1
        ? remaining
        : Math.min(raw, remaining - (weights.length - i - 1));
    const s = cursor;
    const e = s + width - 1;
    cursor = e + 1;
    return { start: s, end: e };
  });
}

export const LETTER_SPANS: Span[] = [
  { start: 0, end: 9 },   // C
  { start: 10, end: 18 }, // O
  { start: 19, end: 27 }, // R
  { start: 28, end: 38 }, // T
  { start: 39, end: 48 }, // E
  { start: 49, end: 57 }, // X
  { start: 58, end: 61 }, // ·
  { start: 62, end: 65 }, // I
  { start: 66, end: 73 }, // A
];
const LOGO_BOUNDS: Span = { start: 0, end: 73 };

function letterIndexAtX(x: number): number {
  for (let i = 0; i < LETTER_SPANS.length; i++) {
    const s = LETTER_SPANS[i];
    if (x >= s.start && x <= s.end) return i;
  }
  if (x < LETTER_SPANS[0].start) return 0;
  return LETTER_SPANS.length - 1;
}

type Point = { x: number; y: number };

function pointKey(x: number, y: number): string {
  return `${x}:${y}`;
}

function buildLetterStrokeMap(letterIdx: number): {
  orderMap: Map<string, number>;
  maxOrder: number;
} {
  const span = LETTER_SPANS[letterIdx];
  const points: Point[] = [];
  const pointSet = new Set<string>();

  for (let y = 0; y < CORTEX_TEXT_LOGO.length; y++) {
    const line = CORTEX_TEXT_LOGO[y] ?? "";
    for (let x = span.start; x <= Math.min(span.end, line.length - 1); x++) {
      if (line[x] !== " ") {
        points.push({ x, y });
        pointSet.add(pointKey(x, y));
      }
    }
  }

  const neighbors8 = [
    [-1, -1],
    [0, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
  ] as const;

  const visited = new Set<string>();
  const components: Point[][] = [];

  for (const p of points) {
    const k = pointKey(p.x, p.y);
    if (visited.has(k)) continue;

    const stack = [p];
    const comp: Point[] = [];
    visited.add(k);

    while (stack.length > 0) {
      const cur = stack.pop()!;
      comp.push(cur);
      for (const [dx, dy] of neighbors8) {
        const nk = pointKey(cur.x + dx, cur.y + dy);
        if (!visited.has(nk) && pointSet.has(nk)) {
          visited.add(nk);
          stack.push({ x: cur.x + dx, y: cur.y + dy });
        }
      }
    }

    components.push(comp);
  }

  components.sort((a, b) => {
    const ax = Math.min(...a.map((p) => p.x));
    const bx = Math.min(...b.map((p) => p.x));
    if (ax !== bx) return ax - bx;
    const ay = Math.min(...a.map((p) => p.y));
    const by = Math.min(...b.map((p) => p.y));
    return ay - by;
  });

  const orderMap = new Map<string, number>();
  let order = 0;

  for (const comp of components) {
    const compSet = new Set(comp.map((p) => pointKey(p.x, p.y)));
    const compMap = new Map(comp.map((p) => [pointKey(p.x, p.y), p]));

    let current = comp.reduce((best, p) =>
      p.x < best.x || (p.x === best.x && p.y < best.y) ? p : best
    );

    let dirX = 1;
    let dirY = 0;

    while (compSet.size > 0) {
      const ck = pointKey(current.x, current.y);
      if (compSet.has(ck)) {
        compSet.delete(ck);
        orderMap.set(ck, order++);
      }
      if (compSet.size === 0) break;

      const candidates: Point[] = [];
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nk = pointKey(current.x + dx, current.y + dy);
          if (compSet.has(nk)) {
            const point = compMap.get(nk);
            if (point) candidates.push(point);
          }
        }
      }

      let next: Point | null = null;
      if (candidates.length > 0) {
        candidates.sort((a, b) => {
          const adx = a.x - current.x;
          const ady = a.y - current.y;
          const bdx = b.x - current.x;
          const bdy = b.y - current.y;

          const aDist = Math.hypot(adx, ady);
          const bDist = Math.hypot(bdx, bdy);
          const aTurn = Math.abs(adx * dirY - ady * dirX);
          const bTurn = Math.abs(bdx * dirY - bdy * dirX);

          const aScore = aDist * 3.8 + aTurn * 1.3 + Math.abs(ady) * 0.12;
          const bScore = bDist * 3.8 + bTurn * 1.3 + Math.abs(bdy) * 0.12;
          return aScore - bScore;
        });
        next = candidates[0];
      } else {
        let best: Point | null = null;
        let bestScore = Number.POSITIVE_INFINITY;
        for (const k of compSet) {
          const p = compMap.get(k);
          if (!p) continue;
          const dx = p.x - current.x;
          const dy = p.y - current.y;
          const score = Math.hypot(dx, dy) + Math.abs(dy) * 0.16;
          if (score < bestScore) {
            bestScore = score;
            best = p;
          }
        }
        next = best;
      }

      if (!next) break;
      dirX = next.x - current.x;
      dirY = next.y - current.y;
      current = next;
    }
  }

  return { orderMap, maxOrder: Math.max(1, order - 1) };
}

type LetterStroke = { orderMap: Map<string, number>; maxOrder: number };

const WRITING_START_TICK = 4;
const FALLBACK_LETTER_TICKS = 8;

const LETTER_STROKES: Array<LetterStroke | null> = LETTER_SPANS.map(() => null);
const LETTER_TICKS: number[] = LETTER_SPANS.map(() => FALLBACK_LETTER_TICKS);
const LETTER_START_TICKS: number[] = LETTER_SPANS.map(
  (_, i) => WRITING_START_TICK + i * FALLBACK_LETTER_TICKS
);
let WRITING_END_TICK =
  WRITING_START_TICK + LETTER_TICKS.reduce((a, b) => a + b, 0);

function recomputeLetterTicks(): void {
  for (let i = 0; i < LETTER_STROKES.length; i++) {
    const stroke = LETTER_STROKES[i];
    LETTER_TICKS[i] = stroke
      ? Math.max(5, Math.ceil(((stroke.maxOrder + 8) / 11) * 0.48))
      : FALLBACK_LETTER_TICKS;
  }
  let acc = WRITING_START_TICK;
  for (let i = 0; i < LETTER_TICKS.length; i++) {
    LETTER_START_TICKS[i] = acc;
    acc += LETTER_TICKS[i];
  }
  WRITING_END_TICK = acc;
}

function allStrokesReady(): boolean {
  for (const stroke of LETTER_STROKES) if (stroke === null) return false;
  return true;
}

let warmupStarted = false;
async function warmupLetterStrokes(): Promise<void> {
  if (warmupStarted) return;
  warmupStarted = true;
  for (let i = 0; i < LETTER_SPANS.length; i++) {
    if (LETTER_STROKES[i] !== null) continue;
    LETTER_STROKES[i] = buildLetterStrokeMap(i);
    recomputeLetterTicks();
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

function buildPenLogoLine(
  line: string,
  rowIdx: number,
  totalRows: number,
  tick: number,
  animated: boolean
): LayoutCell[] {
  const out: LayoutCell[] = [];

  // Subtitle row: appears in dim styling once title is revealed
  if (rowIdx === totalRows - 1) {
    if (!animated || tick >= WRITING_END_TICK) {
      for (const ch of line) {
        out.push({ char: ch, type: "dim" });
      }
    } else {
      for (let i = 0; i < line.length; i++) {
        out.push({ char: " ", type: "none" });
      }
    }
    return out;
  }

  for (let x = 0; x < line.length; x++) {
    const ch = line[x] ?? " ";
    if (ch === " ") {
      out.push({ char: " ", type: "none" });
      continue;
    }

    if (!animated) {
      out.push({ char: ch, type: "logo-ink" });
      continue;
    }

    const letterIdx = letterIndexAtX(x);
    const stroke = LETTER_STROKES[letterIdx];
    if (stroke === null) {
      out.push({ char: ch, type: "logo-ink" });
      continue;
    }

    const startTick = LETTER_START_TICKS[letterIdx];
    const duration = LETTER_TICKS[letterIdx];
    const progress = (tick - startTick) / Math.max(1, duration);

    if (progress < 0) {
      out.push({ char: " ", type: "none" });
      continue;
    }

    const head = progress * (stroke.maxOrder + 7);
    const rawOrder = stroke.orderMap.get(pointKey(x, rowIdx));
    if (rawOrder === undefined) {
      out.push({ char: " ", type: "none" });
      continue;
    }

    if (head < rawOrder) {
      out.push({ char: " ", type: "none" });
      continue;
    }

    const age = head - rawOrder;
    if (age < 1.2) out.push({ char: ch, type: "logo-tip" });
    else if (age < 4.9) out.push({ char: ch, type: "logo-fresh" });
    else out.push({ char: ch, type: "logo-ink" });
  }
  return out;
}

class LayoutBuilder {
  lines: LayoutCell[][] = [];

  addRow() {
    this.lines.push([]);
  }

  add(type: CellType, text: string) {
    const row = this.lines[this.lines.length - 1];
    for (const char of text) row.push({ char, type });
  }

  center(width: number) {
    const row = this.lines[this.lines.length - 1];
    const pad = Math.max(0, Math.floor((width - row.length) / 2));
    const prefix: LayoutCell[] = Array.from({ length: pad }, () => ({
      char: " ",
      type: "none" as const,
    }));
    this.lines[this.lines.length - 1] = prefix.concat(row);
  }
}

const FULL_INTRO_MIN_ROWS = 28;
const FULL_INTRO_MIN_COLS = 76;
const MINIMAL_INTRO_MIN_ROWS = 18;
const MINIMAL_INTRO_MIN_COLS = 40;
const RESIZE_DEBOUNCE_MS = 150;
const RESIZE_GRACE_PERIOD_MS = 300;

type IntroMode = "full" | "minimal" | "skip";

function pickIntroMode(rows: number, cols: number): IntroMode {
  if (rows >= FULL_INTRO_MIN_ROWS && cols >= FULL_INTRO_MIN_COLS) return "full";
  if (rows >= MINIMAL_INTRO_MIN_ROWS && cols >= MINIMAL_INTRO_MIN_COLS)
    return "minimal";
  return "skip";
}

function currentIntroMode(): IntroMode {
  const rows = process.stdout.rows ?? 0;
  const cols = process.stdout.columns ?? 0;
  return pickIntroMode(rows, cols);
}

export function renderCompactBanner(
  snapshot: CortexStatusSnapshot,
  options: {
    cortexIaBin?: string;
    cortexMemBin?: string;
    theme?: ThemeLike;
    maxWidth?: number;
  } = {}
): string {
  const maxWidth = options.maxWidth ?? 80;
  const t = options.theme;
  const col = (token: string, text: string) => (t ? t.fg(token, text) : text);

  if (snapshot.state === "unavailable") {
    const errLine = col(
      "error",
      `⛔ Cortex-IA: Unavailable (${snapshot.unavailableReason ?? "offline"})`
    );
    const docLine = col(
      "dim",
      "Commands: /cortex:doctor · /cortex:status · /cortex:recover"
    );
    return [
      truncateToWidth(errLine, maxWidth),
      truncateToWidth(docLine, maxWidth),
    ].join("\n");
  }

  const selected = snapshot.selectedBoard;
  let boardSummary = "No active board";
  if (selected) {
    const done = snapshot.items.filter((i) => i.status === "done").length;
    const total = snapshot.items.length;
    boardSummary = `[${selected.board_id}] · ${done}/${total} done`;
    if (snapshot.ledger?.state === "available") {
      boardSummary += ` · ledger: ${snapshot.ledger.counts.facts}f/${snapshot.ledger.counts.drift}d`;
    }
  }

  const header = `${col("accent", "🧠 CORTEX-IA")} ${col(
    "dim",
    "· Deterministic Multi-Agent Harness"
  )}`;
  const statusLine = `${col("warning", "⚡")} Active: ${col(
    "accent",
    boardSummary
  )}`;
  const binLine = `${col("success", "✔")} ${col(
    "dim",
    `Control: ${options.cortexIaBin ?? "cortex-ia"} · Cognitive: ${
      options.cortexMemBin ?? "cortex-mem"
    } · :7331`
  )}`;
  const cmdLine = col(
    "dim",
    "Commands: /cortex:status · /cortex:board · /cortex:ledger · /cortex:doctor · /cortex:banner"
  );

  const lines = [header, statusLine, binLine, cmdLine];
  return lines.map((l) => truncateToWidth(l, maxWidth)).join("\n");
}

export default function registerCortexBanner(
  pi: ExtensionAPI,
  store: CortexStatusSnapshotStore = createCortexStatusSnapshotStore()
): void {
  const notifyBannerConfig = (ctx: any, config: BannerConfig) => {
    ctx.ui.notify(
      [
        `Cortex-IA startup banner: brain=${
          config.showBrain ? "on" : "off"
        }, logo=${config.showTextLogo ? "on" : "off"}, color=${
          config.color
        }, animated=${config.animated ? "on" : "off"}`,
        `Config: ${bannerConfigPath()}`,
        "Changes apply on the next startup banner render.",
      ].join("\n"),
      "info"
    );
  };

  pi.registerCommand("cortex:banner", {
    description: "Configure the Cortex-IA startup banner visual appearance.",
    handler: async (_args, ctx) => {
      const config = await readBannerConfig();
      const selected = await ctx.ui.select("Cortex-IA Banner Config", [
        `Brain Illustration: ${config.showBrain ? "enabled" : "disabled"}`,
        `Cortex-IA Logo: ${config.showTextLogo ? "enabled" : "disabled"}`,
        `Animation: ${config.animated ? "enabled" : "disabled"}`,
        `Color Theme: ${config.color}`,
      ]);
      if (!selected) return;

      if (selected.startsWith("Brain Illustration:")) {
        config.showBrain = !config.showBrain;
      } else if (selected.startsWith("Cortex-IA Logo:")) {
        config.showTextLogo = !config.showTextLogo;
      } else if (selected.startsWith("Animation:")) {
        config.animated = !config.animated;
      } else if (selected.startsWith("Color Theme:")) {
        const color = await ctx.ui.select("Select Banner Color Theme", [
          ...BANNER_COLORS,
        ]);
        if (!color) return;
        config.color = color as BannerColor;
      }
      await writeBannerConfig(config);
      notifyBannerConfig(ctx, config);
    },
  });

  pi.registerCommand("cortex:banner-color", {
    description: "Set the startup banner color theme (cyan, magenta, amber, green, indigo).",
    handler: async (args, ctx) => {
      const config = await readBannerConfig();
      const requested = String(args ?? "").trim() as BannerColor;
      if (BANNER_COLORS.includes(requested)) {
        config.color = requested;
      } else {
        const selected = await ctx.ui.select("Select Banner Color Theme", [
          ...BANNER_COLORS,
        ]);
        if (!selected) return;
        config.color = selected as BannerColor;
      }
      await writeBannerConfig(config);
      notifyBannerConfig(ctx, config);
    },
  });

  pi.registerCommand("cortex:toggle-brain", {
    description: "Toggle the Cortex brain illustration in the startup banner.",
    handler: async (_args, ctx) => {
      const config = await readBannerConfig();
      config.showBrain = !config.showBrain;
      await writeBannerConfig(config);
      notifyBannerConfig(ctx, config);
    },
  });

  pi.registerCommand("cortex:toggle-logo", {
    description: "Toggle the Cortex-IA text logo in the startup banner.",
    handler: async (_args, ctx) => {
      const config = await readBannerConfig();
      config.showTextLogo = !config.showTextLogo;
      await writeBannerConfig(config);
      notifyBannerConfig(ctx, config);
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;

    // Skip banner if running subcommands (e.g. pi update, pi install)
    const isCLICommand =
      process.argv.length > 2 &&
      !process.argv.every((arg) => arg.startsWith("-") || arg.endsWith(".ts"));
    if (isCLICommand) return;

    if (currentIntroMode() === "skip") return;

    // Warm up letter strokes in background
    void warmupLetterStrokes();

    const bannerConfig = await readBannerConfig();
    const palette = BANNER_PALETTES[bannerConfig.color];
    const brainBase = padLines(normalizeAscii(CORTEX_BRAIN_RAW));
    const logoBase = padLines(CORTEX_TEXT_LOGO);

    let gitBranch = "Not a git repo";
    let mcpServersCount = 0;
    let cortexIaBin = "cortex-ia";
    let cortexMemBin = "cortex-mem";
    let snapshot: CortexStatusSnapshot | null = null;

    const allCommands = pi.getCommands();
    const skills = allCommands.filter((c) => c.source === "skill");
    const allTools = pi.getAllTools();
    const customTools = allTools.filter(
      (t) => !["builtin", "sdk"].includes(t.sourceInfo.source)
    );

    setTimeout(() => {
      execAsync(`git -C "${ctx.cwd}" branch --show-current`)
        .then(({ stdout }) => {
          const b = stdout.trim();
          gitBranch = b ? `On branch ${b}` : "Detached HEAD";
        })
        .catch(() => {});
    }, 100);

    setTimeout(() => {
      (async () => {
        try {
          cortexIaBin = resolveCortexBinary();
          cortexMemBin = resolveCortexMemoryBinary();
          snapshot = await store.getSnapshot();
        } catch {
          // ignore background discovery failure
        }
      })();
    }, 150);

    setTimeout(() => {
      (async () => {
        try {
          const raw = await readFile(
            join(os.homedir(), ".pi", "agent", "mcp.json"),
            "utf8"
          );
          const cfg = JSON.parse(raw);
          mcpServersCount = Object.keys(cfg.mcpServers || {}).length;
        } catch {
          mcpServersCount = 0;
        }
      })();
    }, 200);

    let tick = 0;
    const state = {
      timer: null as NodeJS.Timeout | null,
      mode: currentIntroMode() as IntroMode,
      resizeHandler: null as (() => void) | null,
      resizeDebounceTimer: null as NodeJS.Timeout | null,
    };

    const cleanup = () => {
      if (state.timer) {
        clearInterval(state.timer);
        state.timer = null;
      }
      if (state.resizeHandler) {
        process.stdout.off("resize", state.resizeHandler);
        state.resizeHandler = null;
      }
      if (state.resizeDebounceTimer) {
        clearTimeout(state.resizeDebounceTimer);
        state.resizeDebounceTimer = null;
      }
    };

    setTimeout(() => {
      ctx.ui.setHeader((tui, theme) => {
        if (state.timer) clearInterval(state.timer);

        const animStart = Date.now();
        const HARD_TIMEOUT_MS = 5000;

        if (bannerConfig.animated) {
          state.timer = setInterval(() => {
            tick++;
            const elapsed = Date.now() - animStart;
            const finishedAnimation =
              allStrokesReady() && tick > WRITING_END_TICK + 22;
            if (finishedAnimation || elapsed > HARD_TIMEOUT_MS) {
              cleanup();
              return;
            }
            try {
              tui.requestRender();
            } catch {
              cleanup();
            }
          }, 25);
        }

        const bootStart = Date.now();
        const resizeHandler = () => {
          if (Date.now() - bootStart < RESIZE_GRACE_PERIOD_MS) return;
          if (state.resizeDebounceTimer) clearTimeout(state.resizeDebounceTimer);
          state.resizeDebounceTimer = setTimeout(() => {
            state.resizeDebounceTimer = null;
            const next = currentIntroMode();
            if (next === state.mode) return;
            state.mode = next;
            if (next === "skip") {
              cleanup();
              return;
            }
            try {
              tui.requestRender();
            } catch {
              cleanup();
            }
          }, RESIZE_DEBOUNCE_MS);
        };
        state.resizeHandler = resizeHandler;
        process.stdout.on("resize", resizeHandler);

        return {
          render(width: number): string[] {
            if (state.mode === "skip") return [];

            const flashStartTick = 8;
            const brainOpacity = bannerConfig.animated
              ? Math.min(1, tick / 10)
              : 1;
            const flashPhase = bannerConfig.animated
              ? tick >= flashStartTick
                ? Math.max(0, 1 - (tick - flashStartTick) / 12)
                : 0
              : 0;
            const frame = Math.floor(tick / 2);

            const sideBySideMinWidth = brainBase.width + 3 + logoBase.width + 4;
            const wideStatsMinWidth = 120;
            const horizontal =
              state.mode === "full" &&
              bannerConfig.showBrain &&
              bannerConfig.showTextLogo &&
              width >= sideBySideMinWidth;
            const wideStats = width >= wideStatsMinWidth;

            const b = new LayoutBuilder();
            b.addRow();
            b.center(width);

            if (state.mode === "minimal") {
              if (bannerConfig.showTextLogo) {
                for (let logoI = 0; logoI < logoBase.lines.length; logoI++) {
                  const logoLine = logoBase.lines[logoI];
                  b.addRow();
                  b.lines[b.lines.length - 1].push(
                    ...buildPenLogoLine(
                      logoLine,
                      logoI,
                      logoBase.lines.length,
                      tick,
                      bannerConfig.animated
                    )
                  );
                  b.center(width);
                }
              }
            } else if (horizontal) {
              const rowCount = Math.max(
                brainBase.lines.length,
                logoBase.lines.length
              );
              const brainOffset = Math.max(
                0,
                Math.floor((rowCount - brainBase.lines.length) / 2)
              );
              const logoOffset = Math.max(
                0,
                Math.floor((rowCount - logoBase.lines.length) / 2)
              );

              for (let i = 0; i < rowCount; i++) {
                const brainI = i - brainOffset;
                const logoI = i - logoOffset;
                const brainLine =
                  brainI >= 0 && brainI < brainBase.lines.length
                    ? brainBase.lines[brainI]
                    : " ".repeat(brainBase.width);
                const logoLine =
                  logoI >= 0 && logoI < logoBase.lines.length
                    ? logoBase.lines[logoI]
                    : " ".repeat(logoBase.width);

                b.addRow();
                b.add("brain", brainLine);
                b.add("none", "   ");
                if (logoI >= 0 && logoI < logoBase.lines.length) {
                  b.lines[b.lines.length - 1].push(
                    ...buildPenLogoLine(
                      logoLine,
                      logoI,
                      logoBase.lines.length,
                      tick,
                      bannerConfig.animated
                    )
                  );
                } else {
                  b.add("none", " ".repeat(logoBase.width));
                }
                b.center(width);
              }
            } else {
              const showBanner =
                bannerConfig.showTextLogo && width >= logoBase.width + 2;
              const showBrain =
                bannerConfig.showBrain && width >= brainBase.width + 2;
              if (showBanner) {
                for (let logoI = 0; logoI < logoBase.lines.length; logoI++) {
                  const logoLine = logoBase.lines[logoI];
                  b.addRow();
                  b.lines[b.lines.length - 1].push(
                    ...buildPenLogoLine(
                      logoLine,
                      logoI,
                      logoBase.lines.length,
                      tick,
                      bannerConfig.animated
                    )
                  );
                  b.center(width);
                }
                if (showBrain) {
                  b.addRow();
                  b.center(width);
                }
              }
              if (showBrain) {
                for (const brainLine of brainBase.lines) {
                  b.addRow();
                  b.add("brain", brainLine);
                  b.center(width);
                }
              }
            }

            if (
              state.mode === "full" ||
              (!bannerConfig.showBrain && !bannerConfig.showTextLogo)
            ) {
              b.addRow();
              b.center(width);

              const fit = (v: unknown, w: number) =>
                String(v ?? "")
                  .replace(/\s+/g, " ")
                  .trim()
                  .slice(0, w)
                  .padEnd(w);

              const addWideRow = (
                l1: string,
                v1: string,
                l2: string,
                v2: string
              ) => {
                b.addRow();
                b.add("label", fit(l1, 10));
                b.add("none", " ");
                b.add("value", fit(v1, 48));
                b.add("none", "   ");
                b.add("label", fit(l2, 12));
                b.add("none", " ");
                b.add("value", fit(v2, 46));
                b.center(width);
              };

              const boardTitle = snapshot?.selectedBoard
                ? `[${snapshot.selectedBoard.board_id}]`
                : "No active board";
              const taskProgress = snapshot?.selectedBoard
                ? `${
                    snapshot.items.filter((i) => i.status === "done").length
                  }/${snapshot.items.length} done`
                : "0/0 tasks";
              const cognitiveStatus =
                snapshot?.ledger?.state === "available"
                  ? `Active (${snapshot.ledger.counts.facts} facts, :7331)`
                  : "Standby (:7331)";

              const narrowRows: Array<[string, string]> = [
                ["GIT:", gitBranch],
                ["PATH:", ctx.cwd],
                ["CONTROL:", `${cortexIaBin} (SQLite DAG)`],
                ["COGNITIVE:", cognitiveStatus],
                ["BOARD:", boardTitle],
                ["TASKS:", taskProgress],
                ["SKILLS:", `${skills.length} loaded`],
                ["TOOLS:", `${customTools.length} custom`],
                ["MCP:", `${mcpServersCount} server(s)`],
                ["VER:", `v${VERSION}`],
              ];

              const narrowLabelW = Math.max(
                ...narrowRows.map(([l]) => l.length)
              );
              const narrowValueW = Math.max(
                0,
                Math.min(
                  Math.max(...narrowRows.map(([, v]) => v.length)),
                  Math.max(8, width - narrowLabelW - 4)
                )
              );

              const addNarrowRow = (label: string, value: string) => {
                b.addRow();
                b.add("label", label.padEnd(narrowLabelW));
                b.add("none", "  ");
                b.add("value", fit(value, narrowValueW));
                b.center(width);
              };

              if (wideStats) {
                addWideRow("GIT:", gitBranch, "PATH:", ctx.cwd);
                addWideRow(
                  "CONTROL:",
                  `${cortexIaBin} (SQLite DAG)`,
                  "COGNITIVE:",
                  cognitiveStatus
                );
                addWideRow(
                  "BOARD:",
                  boardTitle,
                  "TASKS:",
                  taskProgress
                );
                addWideRow(
                  "SKILLS:",
                  `${skills.length} loaded`,
                  "TOOLS:",
                  `${customTools.length} custom`
                );
                addWideRow(
                  "MCP:",
                  `${mcpServersCount} server(s)`,
                  "VER:",
                  `v${VERSION}`
                );
              } else {
                for (const [l, v] of narrowRows) {
                  addNarrowRow(l, v);
                }
              }

              b.addRow();
              b.center(width);
            }

            const out: string[] = [];
            const layout = b.lines;

            const logoRows = layout
              .map((row, idx) => ({
                idx,
                hasLogo: (row || []).some((c) => isLogoCellType(c.type)),
              }))
              .filter((r) => r.hasLogo)
              .map((r) => r.idx);

            const sparkleY =
              logoRows.length > 0
                ? logoRows[Math.floor(logoRows.length / 2)]
                : -1;

            const logoLastX = Math.max(
              -1,
              ...layout.map((row) => {
                let last = -1;
                for (let i = 0; i < (row || []).length; i++) {
                  const cell = row?.[i];
                  if (cell && isLogoCellType(cell.type) && cell.char !== " ") {
                    last = i;
                  }
                }
                return last;
              })
            );

            const glintStartTick = WRITING_END_TICK + 2;
            const glintEndTick = WRITING_END_TICK + 12;
            const glintActive =
              bannerConfig.animated &&
              tick >= glintStartTick &&
              tick <= glintEndTick;
            const glintHead =
              ((tick - glintStartTick) /
                Math.max(1, glintEndTick - glintStartTick)) *
              (LOGO_BOUNDS.end - LOGO_BOUNDS.start + 1);
            const sparkleActive =
              bannerConfig.animated &&
              tick >= WRITING_END_TICK + 13 &&
              tick <= WRITING_END_TICK + 21;

            for (let y = 0; y < layout.length; y++) {
              const row = layout[y] || [];
              const firstLogoX = row.findIndex(
                (c) => isLogoCellType(c.type) && c.char !== " "
              );
              let line = "";

              for (let x = 0; x < row.length; x++) {
                const cell = row[x] || { char: " ", type: "none" as const };
                if (cell.char === " ") {
                  line += " ";
                  continue;
                }

                if (cell.type === "brain") {
                  const pulse =
                    bannerConfig.animated
                      ? 0.9 + Math.sin((x + y + frame) * 0.08) * 0.1
                      : 1.0;
                  const k = Math.max(0.01, brainOpacity * pulse);
                  const f = flashPhase ** 0.4;

                  if (f > 0.85) {
                    line += `\x1b[1m\x1b[38;2;255;255;255m${cell.char}\x1b[0m`;
                  } else {
                    const [r, g, b] = getBrainRgb(bannerConfig.color, x, y, k, f);
                    line += rgb(r, g, b, cell.char);
                  }
                  continue;
                }

                if (isLogoCellType(cell.type)) {
                  const localLogoX = firstLogoX >= 0 ? x - firstLogoX : x;
                  const glintOnCell =
                    glintActive &&
                    localLogoX >= glintHead - 2 &&
                    localLogoX <= glintHead + 1;
                  const sparkleOnCell =
                    sparkleActive &&
                    y === sparkleY &&
                    (x === logoLastX || x === logoLastX - 1);

                  if (sparkleOnCell) {
                    line +=
                      `\x1b[1m` + rgb(255, 255, 255, "✦") + `\x1b[22m`;
                    continue;
                  }

                  if (glintOnCell) {
                    line +=
                      `\x1b[1m` + rgb(255, 255, 255, cell.char) + `\x1b[22m`;
                    continue;
                  }

                  if (cell.type === "logo-tip") {
                    line +=
                      `\x1b[1m` + rgb(255, 255, 255, cell.char) + `\x1b[22m`;
                  } else if (cell.type === "logo-fresh") {
                    line += paletteColor(
                      bannerConfig.color,
                      "logoFresh",
                      cell.char
                    );
                  } else {
                    const [r, g, b] = getLogoRgb(bannerConfig.color, localLogoX);
                    line += rgb(r, g, b, cell.char);
                  }
                  continue;
                }

                switch (cell.type) {
                  case "label":
                    line += paletteColor(
                      bannerConfig.color,
                      "label",
                      cell.char
                    );
                    break;
                  case "value":
                    line += paletteColor(
                      bannerConfig.color,
                      "value",
                      cell.char
                    );
                    break;
                  case "dim":
                    line += theme.fg("dim", cell.char);
                    break;
                  case "accent":
                    line += theme.fg("accent", cell.char);
                    break;
                  default:
                    line += cell.char;
                }
              }

              out.push(truncateToWidth(line, Math.max(1, width), ""));
            }

            return out;
          },
          invalidate() {
            cleanup();
          },
          dispose() {
            cleanup();
          },
        };
      });
    }, 50);
  });
}

