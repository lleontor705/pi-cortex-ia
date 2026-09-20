import { truncateToWidth } from "@earendil-works/pi-tui";

// Cortex-IA Git Working-Tree & Workload Budget Tracker:
// Monitored against HEAD to enforce Cortex-IA SDD limits:
// 1. Source Logic Budget: <= 350 LOC (Go/Rust/Java) or <= 250 LOC (TS/Python)
// 2. Test Fixtures Budget: <= 600 LOC total
// 3. Correction Budget: min(200, ceil(delta_lines / 2))

export const CHANGE_STATUS = {
  MODIFIED: "modified",
  ADDED: "added",
  DELETED: "deleted",
  RENAMED: "renamed",
  UNTRACKED: "untracked",
} as const;

export type ChangeStatus = (typeof CHANGE_STATUS)[keyof typeof CHANGE_STATUS];

export interface ChangedFile {
  path: string;
  added: number;
  deleted: number;
  status: ChangeStatus;
}

export interface WorkloadEvaluation {
  sourceLinesChanged: number;
  testLinesChanged: number;
  sourceBudgetLimit: number;
  testBudgetLimit: number;
  verdict: "PASS" | "EXCEEDED_SOURCE" | "EXCEEDED_TEST";
  reason?: string;
}

export const CORTEX_SOURCE_BUDGET_CAP = 350;
export const CORTEX_TEST_BUDGET_CAP = 600;

export function isTestPath(path: string): boolean {
  return (
    /\.(test|spec)\.[a-zA-Z0-9]+$/.test(path) ||
    /_test\.[a-zA-Z0-9]+$/.test(path) ||
    path.includes("/tests/") ||
    path.includes("\\tests\\")
  );
}

export function parseNumstat(text: string): Array<{ path: string; added: number; deleted: number }> {
  const entries: Array<{ path: string; added: number; deleted: number }> = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/\t+/);
    if (parts.length >= 3) {
      const added = parseInt(parts[0]!, 10) || 0;
      const deleted = parseInt(parts[1]!, 10) || 0;
      const path = parts.slice(2).join("\t");
      entries.push({ path, added, deleted });
    }
  }
  return entries;
}

const STATUS_MAP: Record<string, ChangeStatus> = {
  M: CHANGE_STATUS.MODIFIED,
  A: CHANGE_STATUS.ADDED,
  D: CHANGE_STATUS.DELETED,
  R: CHANGE_STATUS.RENAMED,
  "?": CHANGE_STATUS.UNTRACKED,
};

export function parsePorcelain(text: string): Map<string, ChangeStatus> {
  const statuses = new Map<string, ChangeStatus>();
  const records = text.split("\0").filter((r) => r.length > 0);
  for (let i = 0; i < records.length; i++) {
    const record = records[i]!;
    const code = record.slice(0, 2).trim();
    const path = record.slice(3).trim();
    const status = STATUS_MAP[code[0] ?? ""] ?? STATUS_MAP[code[1] ?? ""] ?? CHANGE_STATUS.MODIFIED;
    statuses.set(path, status);
    if (code.startsWith("R") || code.startsWith("C")) {
      i++; // skip original rename path
    }
  }
  return statuses;
}

export function evaluateWorkloadBudget(
  files: ChangedFile[],
  sourceLimit: number = CORTEX_SOURCE_BUDGET_CAP,
  testLimit: number = CORTEX_TEST_BUDGET_CAP
): WorkloadEvaluation {
  let sourceLines = 0;
  let testLines = 0;

  for (const file of files) {
    // Weighted deletions (0.2x) as defined in Cortex-IA AGENTS.md
    const weightedDelta = Math.ceil(file.added + file.deleted * 0.2);
    if (isTestPath(file.path)) {
      testLines += file.added + file.deleted;
    } else {
      sourceLines += weightedDelta;
    }
  }

  if (sourceLines > sourceLimit) {
    return {
      sourceLinesChanged: sourceLines,
      testLinesChanged: testLines,
      sourceBudgetLimit: sourceLimit,
      testBudgetLimit: testLimit,
      verdict: "EXCEEDED_SOURCE",
      reason: `Source logic changes (${sourceLines} LOC) exceed Cortex-IA budget limit of ${sourceLimit} LOC. Decompose into stacked units.`,
    };
  }

  if (testLines > testLimit) {
    return {
      sourceLinesChanged: sourceLines,
      testLinesChanged: testLines,
      sourceBudgetLimit: sourceLimit,
      testBudgetLimit: testLimit,
      verdict: "EXCEEDED_TEST",
      reason: `Test fixture changes (${testLines} LOC) exceed Cortex-IA budget limit of ${testLimit} LOC. Split test suites.`,
    };
  }

  return {
    sourceLinesChanged: sourceLines,
    testLinesChanged: testLines,
    sourceBudgetLimit: sourceLimit,
    testBudgetLimit: testLimit,
    verdict: "PASS",
  };
}

export function renderChangesWidgetSummary(
  files: ChangedFile[],
  evalBudget: WorkloadEvaluation,
  options: { theme?: { fg(color: string, text: string): string }; maxWidth?: number } = {}
): string {
  const maxWidth = options.maxWidth ?? 80;
  const col = (color: string, text: string) =>
    options.theme ? options.theme.fg(color, text) : text;

  if (files.length === 0) {
    return truncateToWidth(col("dim", "✎ Git: clean working tree"), maxWidth);
  }

  const totalAdded = files.reduce((acc, f) => acc + f.added, 0);
  const totalDeleted = files.reduce((acc, f) => acc + f.deleted, 0);

  const countStr = `✎ ${files.length} file${files.length === 1 ? "" : "s"} (+${totalAdded} / -${totalDeleted})`;
  const statusCol = evalBudget.verdict === "PASS" ? "success" : "error";
  const budgetStr = `Workload: ${evalBudget.sourceLinesChanged}/${evalBudget.sourceBudgetLimit} LOC [${evalBudget.verdict}]`;

  const full = `${col("accent", countStr)} · ${col(statusCol, budgetStr)}`;
  return truncateToWidth(full, maxWidth);
}
