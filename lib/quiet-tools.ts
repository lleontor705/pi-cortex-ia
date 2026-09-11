export interface QuietFoldingOptions {
  headLines?: number;
  tailLines?: number;
  maxLinesBeforeFold?: number;
}

export interface FoldedResult {
  summary: string;
  display: string;
  isFolded: boolean;
  totalLines: number;
  fullOutput?: string;
}

const DEFAULT_OPTIONS: Required<QuietFoldingOptions> = {
  headLines: 3,
  tailLines: 5,
  maxLinesBeforeFold: 12,
};

export function foldOutput(
  toolName: string,
  rawOutput: string,
  durationMs?: number,
  options: QuietFoldingOptions = {}
): FoldedResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const trimmed = rawOutput.trim();

  if (!trimmed) {
    const emptyMsg = getEmptyMessage(toolName);
    return {
      summary: emptyMsg,
      display: emptyMsg,
      isFolded: false,
      totalLines: 0,
    };
  }

  const lines = trimmed.split(/\r?\n/);
  const totalLines = lines.length;
  const timeStr = typeof durationMs === "number" ? ` (${(durationMs / 1000).toFixed(2)}s)` : "";

  if (totalLines <= opts.maxLinesBeforeFold) {
    return {
      summary: `Completed${timeStr}: ${totalLines} line(s)`,
      display: trimmed,
      isFolded: false,
      totalLines,
      fullOutput: rawOutput,
    };
  }

  const head = lines.slice(0, opts.headLines);
  const tail = lines.slice(-opts.tailLines);
  const omitted = totalLines - (opts.headLines + opts.tailLines);

  const display = [
    `⚡ [cortex-quiet: ${toolName}]${timeStr} ➔ ${totalLines} lines produced`,
    "--- (preview start) ---",
    ...head,
    `... [${omitted} lines folded to protect LLM context window] ...`,
    ...tail,
    "--- (preview end) ---",
  ].join("\n");

  return {
    summary: `[Folded] ${totalLines} lines (${omitted} hidden)${timeStr}`,
    display,
    isFolded: true,
    totalLines,
    fullOutput: rawOutput,
  };
}

function getEmptyMessage(toolName: string): string {
  switch (toolName) {
    case "grep":
      return "↳ 0 matches found.";
    case "find":
      return "↳ 0 files found matching pattern.";
    case "ls":
      return "↳ (empty directory)";
    case "bash":
      return "↳ (no output, exit code 0)";
    default:
      return "↳ (empty result)";
  }
}
