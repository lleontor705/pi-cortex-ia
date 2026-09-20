import {
  CustomEditor,
  type KeybindingsManager,
} from "@earendil-works/pi-coding-agent";
import type { EditorTheme, TUI } from "@earendil-works/pi-tui";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

// Cortex-IA Prompt Frame: Wraps the Pi prompt editor in a cybernetic/neural
// rounded frame with a pulsing synaptic indicator that reflects agent activity.

export const PROMPT_STATE = {
  IDLE: "idle",
  WORKING: "working",
  QUEUED: "queued",
  APPROVAL: "approval",
} as const;

export type PromptState = (typeof PROMPT_STATE)[keyof typeof PROMPT_STATE];

const SYNAPTIC_TONE = {
  CYAN: "accent",
  VIOLET: "customMessageLabel",
  EMERALD: "success",
  AMBER: "warning",
  DIM: "dim",
} as const;

export type SynapticTone = (typeof SYNAPTIC_TONE)[keyof typeof SYNAPTIC_TONE];

// Cybernetic synaptic animation frames
export const SYNAPSE_FRAMES = ["◈", "⚡", "◉", "✦"] as const;
const SYNAPSE_TONE_FRAMES = [
  SYNAPTIC_TONE.CYAN,
  SYNAPTIC_TONE.VIOLET,
  SYNAPTIC_TONE.EMERALD,
  SYNAPTIC_TONE.VIOLET,
] as const;

export const PROMPT_HINT = "type your request, or / for cortex commands";
const LABEL_ROLE = "muted";
const HINT_ROLE = "dim";
const PROMPT_FRAME_ROLE = "border";
const SCROLL_INDICATOR = /[↑↓] \d+ more/;

const STATE_LABEL: Record<PromptState, string | undefined> = {
  [PROMPT_STATE.IDLE]: undefined,
  [PROMPT_STATE.WORKING]: "synapsing",
  [PROMPT_STATE.QUEUED]: "queued",
  [PROMPT_STATE.APPROVAL]: "waiting review",
};

export function synapticTone(state: PromptState, tick: number): string {
  if (state === PROMPT_STATE.QUEUED) return SYNAPTIC_TONE.AMBER;
  if (state === PROMPT_STATE.APPROVAL) return SYNAPTIC_TONE.EMERALD;
  if (state === PROMPT_STATE.WORKING) {
    return SYNAPSE_TONE_FRAMES[tick % SYNAPSE_TONE_FRAMES.length];
  }
  return SYNAPTIC_TONE.CYAN;
}

export function synapticGlyph(state: PromptState, tick: number): string {
  if (state === PROMPT_STATE.IDLE) return "◈";
  if (state === PROMPT_STATE.APPROVAL) return "⚖";
  return SYNAPSE_FRAMES[tick % SYNAPSE_FRAMES.length];
}

function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

function scrollIndicator(rule: string): string | undefined {
  return stripAnsi(rule).match(SCROLL_INDICATOR)?.[0];
}

function rule(length: number): string {
  return "─".repeat(Math.max(0, length));
}

export interface PromptFrameOptions {
  state: PromptState;
  tick: number;
  borderColor: (text: string) => string;
  fg: (color: string, text: string) => string;
  bold?: (text: string) => string;
}

function topRule(
  width: number,
  options: PromptFrameOptions,
  indicator: string | undefined
): string {
  const label = indicator ?? STATE_LABEL[options.state];
  const glyph = synapticGlyph(options.state, options.tick);
  const styledGlyph = options.fg(
    synapticTone(options.state, options.tick),
    options.bold ? options.bold(glyph) : glyph
  );
  const labelText = label ? ` ${options.fg(LABEL_ROLE, label)}` : "";
  const labelWidth = label ? label.length + 1 : 0;
  const fill = width - 3 - visibleWidth(glyph) - labelWidth - 1 - 1;
  if (fill < 0) return options.borderColor(`╭${rule(width - 2)}╮`);
  return (
    options.borderColor("╭─ ") +
    styledGlyph +
    labelText +
    options.borderColor(` ${rule(fill)}╮`)
  );
}

function bottomRule(
  width: number,
  options: PromptFrameOptions,
  indicator: string | undefined
): string {
  if (!indicator) return options.borderColor(`╰${rule(width - 2)}╯`);
  const fill = width - 3 - indicator.length - 1 - 1;
  if (fill < 0) return options.borderColor(`╰${rule(width - 2)}╯`);
  return (
    options.borderColor("╰─ ") +
    options.fg(LABEL_ROLE, indicator) +
    options.borderColor(` ${rule(fill)}╯`)
  );
}

function sideRules(
  line: string,
  innerWidth: number,
  options: PromptFrameOptions
): string {
  const clipped = innerWidth === 0 ? "" : truncateToWidth(line, innerWidth, "");
  const padding = " ".repeat(Math.max(0, innerWidth - visibleWidth(clipped)));
  const content = clipped + padding;
  return options.borderColor("│") + content + options.borderColor("│");
}

export function framePromptLines(
  lines: string[],
  width: number,
  options: PromptFrameOptions
): string[] {
  width = Math.max(0, Math.floor(width));
  if (lines.length < 2)
    return lines.map((line) => truncateToWidth(line, width, ""));
  if (width < 2)
    return lines.map((_line, index) =>
      width === 0
        ? ""
        : options.borderColor(
            index === 0 ? "╭" : index === lines.length - 1 ? "╰" : "│"
          )
    );

  const innerWidth = width - 2;
  const first = lines[0];
  const last = lines[lines.length - 1];
  const topIndicator = first ? scrollIndicator(first) : undefined;
  const bottomIndicator = last ? scrollIndicator(last) : undefined;

  const out: string[] = [];
  out.push(topRule(width, options, topIndicator));
  for (let i = 1; i < lines.length - 1; i++) {
    out.push(sideRules(lines[i], innerWidth, options));
  }
  out.push(bottomRule(width, options, bottomIndicator));
  return out;
}

export function withPromptHint(
  line: string,
  hint: string,
  fg: (color: string, text: string) => string
): string {
  return `${line}${fg(HINT_ROLE, hint)}`;
}

export interface PromptEditorDeps {
  fg: (color: string, text: string) => string;
  bold: (text: string) => string;
  requestRender(): void;
  pending(): boolean;
}

const SYNAPTIC_PULSE_MS = 160;

export class CortexPromptEditor extends CustomEditor {
  private promptState: PromptState = PROMPT_STATE.IDLE;
  private tick = 0;
  private pulse: NodeJS.Timeout | undefined;
  private readonly deps: PromptEditorDeps;

  constructor(
    tui: TUI,
    theme: EditorTheme,
    keybindings: KeybindingsManager,
    deps: PromptEditorDeps
  ) {
    super(tui, theme, keybindings);
    this.deps = deps;
  }

  setWorking(working: boolean): void {
    this.promptState = working ? PROMPT_STATE.WORKING : PROMPT_STATE.IDLE;
    this.stopPulse();
    if (working) {
      this.pulse = setInterval(() => {
        this.tick += 1;
        this.deps.requestRender();
      }, SYNAPTIC_PULSE_MS);
      this.pulse.unref();
    }
    this.deps.requestRender();
  }

  setApprovalState(waiting: boolean): void {
    if (waiting) {
      this.promptState = PROMPT_STATE.APPROVAL;
    } else if (this.promptState === PROMPT_STATE.APPROVAL) {
      this.promptState = PROMPT_STATE.IDLE;
    }
    this.deps.requestRender();
  }

  render(width: number): string[] {
    const lines = super.render(Math.max(1, width - 2));
    if (this.getText() === "" && lines.length === 3) {
      lines[1] = withPromptHint(lines[1], PROMPT_HINT, this.deps.fg);
    }
    const state =
      this.promptState === PROMPT_STATE.WORKING && this.deps.pending()
        ? PROMPT_STATE.QUEUED
        : this.promptState;

    return framePromptLines(lines, width, {
      state,
      tick: this.tick,
      borderColor: (text) => this.deps.fg(PROMPT_FRAME_ROLE, text),
      fg: this.deps.fg,
      bold: this.deps.bold,
    });
  }

  dispose(): void {
    this.stopPulse();
  }

  private stopPulse(): void {
    if (this.pulse) clearInterval(this.pulse);
    this.pulse = undefined;
    this.tick = 0;
  }
}
