import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface CortexBoardSummary {
  board_id: string;
  title: string;
  description: string;
  status: "active" | "archived";
  revision?: number;
  counts: Record<string, number>;
  created_at?: string;
  updated_at?: string;
}

export interface CortexWorkItem {
  id: string;
  title: string;
  status: "backlog" | "ready" | "in_progress" | "in_review" | "done" | "blocked" | "superseded";
  revision?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CortexWorkItemDetails {
  item: CortexWorkItem;
  claim?: {
    owner: string;
    expires_at: string;
    attempt: number;
  };
  leases?: Array<{
    path: string;
    expires_at: string;
  }>;
  dependencies?: string[];
  approvals?: Array<{
    reviewer: string;
    verdict: string;
    evidence_ref: string;
    created_at: string;
  }>;
}

export interface LedgerFact {
  id?: number;
  /** Cortex ledger status JSON currently names the text field "fact"; text is accepted for older test seams. */
  fact?: string;
  text?: string;
  board_id: string;
  source: string;
  synced_cortex?: boolean;
  created_at?: string;
}

export interface LedgerProgress {
  summary: string;
  drift: boolean;
  action?: string;
  created_at?: string;
}

export interface LedgerStatusReport {
  board_id: string;
  facts: LedgerFact[];
  progress: LedgerProgress[];
}

export interface CortexLedgerSnapshotSummary {
  readonly state: CortexStatusSnapshotState;
  readonly board_id?: string;
  readonly facts?: ReadonlyArray<Readonly<LedgerFact>>;
  readonly progress?: ReadonlyArray<Readonly<LedgerProgress>>;
  readonly counts?: Readonly<{ facts: number; progress: number; drift: number }>;
  readonly unavailableReason?: string;
}

export type CortexStatusSnapshotState = "available" | "unavailable";

export interface CortexStatusSnapshot {
  readonly state: CortexStatusSnapshotState;
  readonly cwd: string;
  readonly selectedBoardId?: string;
  readonly selectedBoard?: Readonly<CortexBoardSummary>;
  readonly boards: ReadonlyArray<Readonly<CortexBoardSummary>>;
  readonly items: ReadonlyArray<Readonly<CortexWorkItem>>;
  readonly counts: Readonly<Record<string, number>>;
  readonly ledger?: Readonly<CortexLedgerSnapshotSummary>;
  readonly unavailableReason?: string;
}

export interface CortexStatusSnapshotStore {
  getSnapshot(): Promise<CortexStatusSnapshot>;
  invalidate(): void;
  dispose(): void;
}

export interface CortexStatusSnapshotClient {
  boardList(cwd?: string): Promise<unknown>;
  boardStatus(id: string, cwd?: string): Promise<unknown>;
  ledgerStatus?(options: { board?: string }, cwd?: string): Promise<unknown>;
}

export interface CortexStatusSnapshotOptions {
  cwd?: string;
  boardId?: string;
  client?: CortexStatusSnapshotClient;
}

export function resolveCortexBinary(): string {
  if (process.env.CORTEX_IA_BIN && existsSync(process.env.CORTEX_IA_BIN)) {
    return process.env.CORTEX_IA_BIN;
  }
  const standardLocations = [
    "D:\\cortex-ia\\cortex-ia.exe",
    join(homedir(), ".cortex-ia", "bin", "cortex-ia.exe"),
    join(homedir(), ".cortex-ia", "bin", "cortex-ia"),
    join(homedir(), "go", "bin", "cortex-ia.exe"),
    join(homedir(), "go", "bin", "cortex-ia"),
  ];
  for (const loc of standardLocations) {
    if (existsSync(loc)) return loc;
  }
  return "cortex-ia"; // fallback to PATH
}

export async function execCortex(args: string[], cwd: string = process.cwd()): Promise<{ stdout: string; stderr: string; code: number }> {
  const binary = resolveCortexBinary();
  try {
    const res = await execFileAsync(binary, args, {
      cwd,
      timeout: 30000,
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { stdout: res.stdout.trim(), stderr: res.stderr.trim(), code: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout ? String(error.stdout).trim() : "",
      stderr: error.stderr ? String(error.stderr).trim() : (error.message || ""),
      code: typeof error.code === "number" ? error.code : 1,
    };
  }
}

// ----------------- Boards -----------------

export async function boardList(cwd?: string): Promise<CortexBoardSummary[]> {
  const res = await execCortex(["board", "list"], cwd);
  if (res.code !== 0) {
    throw new Error(`cortex-ia board list failed: ${res.stderr || res.stdout}`);
  }
  try {
    return JSON.parse(res.stdout);
  } catch {
    return [];
  }
}

export async function boardCreate(id: string, title: string, desc?: string, cwd?: string): Promise<any> {
  const args = ["board", "create", id, title];
  if (desc) args.push(desc);
  const res = await execCortex(args, cwd);
  if (res.code !== 0) throw new Error(res.stderr || res.stdout);
  try { return JSON.parse(res.stdout); } catch { return { success: true }; }
}

export async function boardStatus(id: string, cwd?: string): Promise<{ board: CortexBoardSummary; items: CortexWorkItem[] }> {
  const res = await execCortex(["board", "status", id], cwd);
  if (res.code !== 0) throw new Error(res.stderr || res.stdout);
  return JSON.parse(res.stdout);
}

// ----------------- Work Items & Leases -----------------

export async function workCreate(id: string, title: string, options: { board?: string; depends?: string[] } = {}, cwd?: string): Promise<any> {
  const args = ["work", "create", id, title];
  if (options.board) args.push("--board", options.board);
  if (options.depends) {
    for (const d of options.depends) {
      args.push("--depends", d);
    }
  }
  const res = await execCortex(args, cwd);
  if (res.code !== 0) throw new Error(res.stderr || res.stdout);
  try { return JSON.parse(res.stdout); } catch { return { id, title }; }
}

export async function workStatus(id: string, cwd?: string): Promise<CortexWorkItemDetails> {
  const res = await execCortex(["work", "status", id], cwd);
  if (res.code !== 0) throw new Error(res.stderr || res.stdout);
  return JSON.parse(res.stdout);
}

export async function workClaim(id: string, owner: string, ttl: string = "15m", cwd?: string): Promise<{ claim_token: string; item: CortexWorkItem }> {
  const res = await execCortex(["work", "claim", id, "--owner", owner, "--ttl", ttl], cwd);
  if (res.code !== 0) throw new Error(res.stderr || res.stdout);
  return JSON.parse(res.stdout);
}

export async function workRenew(id: string, claimToken: string, ttl: string = "15m", cwd?: string): Promise<any> {
  const res = await execCortex(["work", "renew", id, "--claim-token", claimToken, "--ttl", ttl], cwd);
  if (res.code !== 0) throw new Error(res.stderr || res.stdout);
  try { return JSON.parse(res.stdout); } catch { return { success: true }; }
}

export async function workLease(id: string, claimToken: string, path: string, ttl: string = "15m", cwd?: string): Promise<{ lease_token: string; path: string }> {
  const res = await execCortex(["work", "lease", id, "--claim-token", claimToken, "--path", path, "--ttl", ttl], cwd);
  if (res.code !== 0) throw new Error(res.stderr || res.stdout);
  return JSON.parse(res.stdout);
}

export async function workLeaseRenew(path: string, leaseToken: string, cwd?: string): Promise<any> {
  const res = await execCortex(["work", "lease-renew", "--path", path, "--lease-token", leaseToken], cwd);
  if (res.code !== 0) throw new Error(res.stderr || res.stdout);
  try { return JSON.parse(res.stdout); } catch { return { success: true }; }
}

export async function workRelease(path: string, leaseToken: string, cwd?: string): Promise<any> {
  const res = await execCortex(["work", "release", "--path", path, "--lease-token", leaseToken], cwd);
  if (res.code !== 0) throw new Error(res.stderr || res.stdout);
  try { return JSON.parse(res.stdout); } catch { return { success: true }; }
}

export async function workTransition(id: string, claimToken: string, toStatus: "in_progress" | "in_review" | "blocked", cwd?: string): Promise<any> {
  const res = await execCortex(["work", "transition", id, "--claim-token", claimToken, "--to", toStatus], cwd);
  if (res.code !== 0) throw new Error(res.stderr || res.stdout);
  try { return JSON.parse(res.stdout); } catch { return { success: true }; }
}

export async function workApprove(id: string, reviewer: string, verdict: "PASS" | "FAIL", evidenceRef: string, revisionOrCwd?: number | string, cwd?: string): Promise<any> {
  const revision = typeof revisionOrCwd === "number" ? revisionOrCwd : undefined;
  const actualCwd = typeof revisionOrCwd === "string" ? revisionOrCwd : cwd;
  const args = ["work", "approve", id, "--reviewer", reviewer, "--verdict", verdict, "--evidence", evidenceRef];
  if (typeof revision === "number") args.push("--revision", String(revision));
  const res = await execCortex(args, actualCwd);
  if (res.code !== 0) throw new Error(res.stderr || res.stdout);
  try { return JSON.parse(res.stdout); } catch { return { success: true }; }
}

export async function workRecover(cwd?: string): Promise<any> {
  const res = await execCortex(["work", "recover"], cwd);
  if (res.code !== 0) throw new Error(res.stderr || res.stdout);
  try { return JSON.parse(res.stdout); } catch { return { raw: res.stdout }; }
}

// ----------------- Read-only Status Snapshots -----------------

const defaultStatusSnapshotClient: CortexStatusSnapshotClient = { boardList, boardStatus, ledgerStatus };
const workStatuses = new Set(["backlog", "ready", "in_progress", "in_review", "done", "blocked", "superseded"]);
const rec = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const unavailable = (cwd: string, unavailableReason: string): CortexStatusSnapshot => ({ state: "unavailable", cwd, boards: [], items: [], counts: {}, unavailableReason });
const dateRank = (value?: string): number => typeof value === "string" && Number.isFinite(Date.parse(value)) ? Date.parse(value) : Number.NEGATIVE_INFINITY;
const isIsoDate = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
const isRevision = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0;

function asBoard(value: unknown): CortexBoardSummary | undefined {
  if (!rec(value) || typeof value.board_id !== "string" || typeof value.title !== "string" || (value.status !== "active" && value.status !== "archived")) return undefined;
  if (("revision" in value && !isRevision(value.revision)) || ("created_at" in value && !isIsoDate(value.created_at)) || ("updated_at" in value && !isIsoDate(value.updated_at))) return undefined;
  const counts = rec(value.counts) ? Object.fromEntries(Object.entries(value.counts).filter((e): e is [string, number] => typeof e[1] === "number")) : {};
  return { board_id: value.board_id, title: value.title, description: typeof value.description === "string" ? value.description : "", status: value.status, counts, ...(typeof value.revision === "number" ? { revision: value.revision } : {}), ...(typeof value.created_at === "string" ? { created_at: value.created_at } : {}), ...(typeof value.updated_at === "string" ? { updated_at: value.updated_at } : {}) };
}

function asWorkItem(value: unknown): CortexWorkItem | undefined {
  if (!rec(value) || typeof value.title !== "string" || !workStatuses.has(String(value.status))) return undefined;
  if (("revision" in value && !isRevision(value.revision)) || ("created_at" in value && !isIsoDate(value.created_at)) || ("updated_at" in value && !isIsoDate(value.updated_at))) return undefined;
  const id = typeof value.id === "string" ? value.id : (typeof value.task_id === "string" ? value.task_id : undefined);
  if (!id) return undefined;
  return { id, title: value.title, status: value.status as CortexWorkItem["status"], ...(typeof value.revision === "number" ? { revision: value.revision } : {}), ...(typeof value.created_at === "string" ? { created_at: value.created_at } : {}), ...(typeof value.updated_at === "string" ? { updated_at: value.updated_at } : {}) };
}

function asLedgerFact(value: unknown): LedgerFact | undefined {
  if (!rec(value) || typeof value.board_id !== "string" || typeof value.source !== "string") return undefined;
  if (("id" in value && (typeof value.id !== "number" || !Number.isInteger(value.id))) || ("synced_cortex" in value && typeof value.synced_cortex !== "boolean") || ("created_at" in value && !isIsoDate(value.created_at))) return undefined;
  const body = typeof value.fact === "string" ? value.fact : (typeof value.text === "string" ? value.text : undefined);
  if (!body) return undefined;
  return { id: typeof value.id === "number" ? value.id : undefined, board_id: value.board_id, fact: body, text: typeof value.text === "string" ? value.text : undefined, source: value.source, synced_cortex: typeof value.synced_cortex === "boolean" ? value.synced_cortex : undefined, created_at: typeof value.created_at === "string" ? value.created_at : undefined };
}

function asLedgerProgress(value: unknown): LedgerProgress | undefined {
  if (!rec(value) || typeof value.summary !== "string" || typeof value.drift !== "boolean") return undefined;
  if (("action" in value && typeof value.action !== "string") || ("created_at" in value && !isIsoDate(value.created_at))) return undefined;
  return { summary: value.summary, drift: value.drift, action: typeof value.action === "string" ? value.action : undefined, created_at: typeof value.created_at === "string" ? value.created_at : undefined };
}

function asLedgerStatusReport(value: unknown, boardId?: string): LedgerStatusReport | undefined {
  if (!rec(value) || typeof value.board_id !== "string" || !Array.isArray(value.facts) || !Array.isArray(value.progress)) return undefined;
  if (boardId && value.board_id !== boardId) return undefined;
  const facts = value.facts.map(asLedgerFact), progress = value.progress.map(asLedgerProgress);
  if (facts.some((f) => !f) || progress.some((p) => !p)) return undefined;
  return { board_id: value.board_id, facts: facts as LedgerFact[], progress: progress as LedgerProgress[] };
}

async function loadLedgerSummary(cwd: string, client: CortexStatusSnapshotClient, boardId: string): Promise<CortexLedgerSnapshotSummary> {
  if (!client.ledgerStatus) return { state: "unavailable", board_id: boardId, unavailableReason: "Cortex ledger status client unavailable" };
  try {
    const report = asLedgerStatusReport(await client.ledgerStatus({ board: boardId }, cwd), boardId);
    if (!report) return { state: "unavailable", board_id: boardId, unavailableReason: "Malformed Cortex ledger status" };
    return { state: "available", board_id: report.board_id, facts: report.facts, progress: report.progress, counts: { facts: report.facts.length, progress: report.progress.length, drift: report.progress.filter((p) => p.drift).length } };
  } catch (error: any) {
    return { state: "unavailable", board_id: boardId, unavailableReason: error?.message ? String(error.message) : "Cortex ledger status unavailable" };
  }
}

/** Selects preferred board id first; otherwise active boards before archived, newest updated_at first, then board_id. */
export function selectCortexStatusBoard(boards: ReadonlyArray<CortexBoardSummary>, preferredBoardId?: string): CortexBoardSummary | undefined {
  return (preferredBoardId && boards.find((b) => b.board_id === preferredBoardId)) || [...boards].sort((a, b) => a.status !== b.status ? (a.status === "active" ? -1 : 1) : dateRank(b.updated_at) - dateRank(a.updated_at) || a.board_id.localeCompare(b.board_id))[0];
}

async function loadStatusSnapshot(cwd: string, client: CortexStatusSnapshotClient, boardId?: string): Promise<CortexStatusSnapshot> {
  try {
    const rawBoards = await client.boardList(cwd);
    if (!Array.isArray(rawBoards)) return unavailable(cwd, "Malformed Cortex board list");
    const boards = rawBoards.map(asBoard);
    if (boards.some((b) => !b)) return unavailable(cwd, "Malformed Cortex board data");
    const selected = selectCortexStatusBoard(boards as CortexBoardSummary[], boardId);
    if (!selected) return { state: "available", cwd, boards: [], items: [], counts: {} };
    const rawStatus = await client.boardStatus(selected.board_id, cwd);
    if (!rec(rawStatus) || !Array.isArray(rawStatus.items)) return unavailable(cwd, "Malformed Cortex board status");
    const statusBoard = asBoard(rawStatus.board);
    if (!statusBoard) return unavailable(cwd, "Malformed Cortex board status");
    const items = rawStatus.items.map(asWorkItem);
    if (items.some((i) => !i)) return unavailable(cwd, "Malformed Cortex work item data");
    const counts = Object.keys(statusBoard.counts).length ? statusBoard.counts : (items as CortexWorkItem[]).reduce<Record<string, number>>((acc, item) => ({ ...acc, [item.status]: (acc[item.status] ?? 0) + 1 }), {});
    const ledger = await loadLedgerSummary(cwd, client, statusBoard.board_id);
    return { state: "available", cwd, selectedBoardId: statusBoard.board_id, selectedBoard: statusBoard, boards: boards as CortexBoardSummary[], items: items as CortexWorkItem[], counts, ledger };
  } catch (error: any) {
    return unavailable(cwd, error?.message ? String(error.message) : "Cortex status unavailable");
  }
}

export function createCortexStatusSnapshotStore(options: CortexStatusSnapshotOptions = {}): CortexStatusSnapshotStore {
  const cwd = options.cwd ?? process.cwd();
  const client = options.client ?? defaultStatusSnapshotClient;
  let cache: CortexStatusSnapshot | undefined, inFlight: Promise<CortexStatusSnapshot> | undefined, generation = 0, disposed = false;
  const clear = () => { generation += 1; cache = undefined; inFlight = undefined; };
  return {
    getSnapshot() {
      if (disposed) return Promise.resolve(unavailable(cwd, "Cortex status snapshot store disposed"));
      if (cache) return Promise.resolve(cache);
      if (inFlight) return inFlight;
      const started = generation;
      inFlight = loadStatusSnapshot(cwd, client, options.boardId).then((snapshot) => {
        inFlight = undefined;
        if (!disposed && started === generation) cache = snapshot;
        return snapshot;
      });
      return inFlight;
    },
    invalidate: clear,
    dispose() { disposed = true; clear(); },
  };
}

// ----------------- Dual Ledger -----------------

export async function ledgerFactAdd(text: string, options: { board?: string; source?: string; syncCortex?: boolean } = {}, cwd?: string): Promise<{ success: boolean; raw?: string }> {
  const args = ["ledger", "fact", "add", text];
  if (options.board) args.push("--board", options.board);
  if (options.source) args.push("--source", options.source);
  if (options.syncCortex) args.push("--sync-cortex");
  const res = await execCortex(args, cwd);
  if (res.code !== 0) throw new Error(res.stderr || res.stdout);
  return { success: true, raw: res.stdout };
}

export async function ledgerFactList(options: { board?: string } = {}, cwd?: string): Promise<LedgerFact[]> {
  const args = ["ledger", "fact", "list", "--json"];
  if (options.board) args.push("--board", options.board);
  const res = await execCortex(args, cwd);
  if (res.code !== 0) throw new Error(res.stderr || res.stdout);
  try {
    return JSON.parse(res.stdout);
  } catch {
    return [];
  }
}

export async function ledgerProgressRecord(summary: string, options: { drift?: boolean; action?: string } = {}, cwd?: string): Promise<{ success: boolean; raw?: string }> {
  const args = ["ledger", "progress", "record", "--summary", summary];
  if (options.drift) args.push("--drift");
  if (options.action) args.push("--action", options.action);
  const res = await execCortex(args, cwd);
  if (res.code !== 0) throw new Error(res.stderr || res.stdout);
  return { success: true, raw: res.stdout };
}

export async function ledgerStatus(options: { board?: string } = {}, cwd?: string): Promise<LedgerStatusReport> {
  const args = ["ledger", "status", "--json"];
  if (options.board) args.push("--board", options.board);
  const res = await execCortex(args, cwd);
  if (res.code !== 0) throw new Error(res.stderr || res.stdout);
  let raw: unknown;
  try { raw = JSON.parse(res.stdout); } catch { throw new Error("Malformed Cortex ledger status JSON"); }
  const report = asLedgerStatusReport(raw, options.board);
  if (!report) throw new Error("Malformed Cortex ledger status");
  return report;
}

// ----------------- OpenSpec SDD -----------------

export async function openspecValidate(change: string, options: { workflow: string; phase: string; project?: string }, cwd?: string): Promise<any> {
  const args = ["openspec", "validate", change, "--workflow", options.workflow, "--phase", options.phase, "--json"];
  if (options.project) args.push("--project", options.project);
  const res = await execCortex(args, cwd);
  if (res.code !== 0) throw new Error(res.stderr || res.stdout);
  try {
    return JSON.parse(res.stdout);
  } catch {
    return { valid: true, raw: res.stdout };
  }
}

export async function openspecList(cwd?: string): Promise<string[]> {
  const res = await execCortex(["openspec", "list"], cwd);
  if (res.code !== 0) throw new Error(res.stderr || res.stdout);
  return res.stdout.split("\n").map(l => l.trim()).filter(Boolean);
}

export async function openspecStatus(change?: string, cwd?: string): Promise<string> {
  const args = ["openspec", "status"];
  if (change) args.push(change);
  const res = await execCortex(args, cwd);
  if (res.code !== 0) throw new Error(res.stderr || res.stdout);
  return res.stdout;
}

export async function openspecNew(change: string, domain: string = "core", cwd?: string): Promise<string> {
  const res = await execCortex(["openspec", "new", change, domain], cwd);
  if (res.code !== 0) throw new Error(res.stderr || res.stdout);
  return res.stdout;
}

export async function openspecArchive(change: string, options: { board: string; workflow: string; specPlane: string }, cwd?: string): Promise<string> {
  const args = ["openspec", "archive", change, "--board", options.board, "--workflow", options.workflow, "--spec-plane", options.specPlane];
  const res = await execCortex(args, cwd);
  if (res.code !== 0) throw new Error(res.stderr || res.stdout);
  return res.stdout;
}

// ----------------- Delegation -----------------

export async function delegatePolicy(role: string, cwd?: string): Promise<{ role: string; external_enabled: boolean; reason: string }> {
  const res = await execCortex(["delegate", "policy", "--role", role], cwd);
  if (res.code !== 0) throw new Error(res.stderr || res.stdout);
  return JSON.parse(res.stdout);
}

export async function delegateModels(cwd?: string): Promise<Array<{ id: string; name: string }>> {
  const res = await execCortex(["delegate", "models", "--json"], cwd);
  if (res.code !== 0) throw new Error(res.stderr || res.stdout);
  try {
    return JSON.parse(res.stdout);
  } catch {
    return [];
  }
}

export async function delegateCreate(requestFilePath: string, transport: "herdr" | "direct" = "direct", cwd?: string): Promise<any> {
  const res = await execCortex(["delegate", "create", "--request-file", requestFilePath, "--transport", transport], cwd);
  if (res.code !== 0) throw new Error(res.stderr || res.stdout);
  return JSON.parse(res.stdout);
}

export async function delegateStatus(jobId: string, cwd?: string): Promise<any> {
  const res = await execCortex(["delegate", "status", jobId], cwd);
  if (res.code !== 0) throw new Error(res.stderr || res.stdout);
  return JSON.parse(res.stdout);
}

export async function delegateResult(jobId: string, cwd?: string): Promise<any> {
  const res = await execCortex(["delegate", "result", jobId], cwd);
  if (res.code !== 0) throw new Error(res.stderr || res.stdout);
  return JSON.parse(res.stdout);
}

export async function delegateCancel(jobId: string, cwd?: string): Promise<any> {
  const res = await execCortex(["delegate", "cancel", jobId], cwd);
  if (res.code !== 0) throw new Error(res.stderr || res.stdout);
  return JSON.parse(res.stdout);
}

export async function delegateRecover(cwd?: string): Promise<{ recovered: number }> {
  const res = await execCortex(["delegate", "recover"], cwd);
  if (res.code !== 0) throw new Error(res.stderr || res.stdout);
  return JSON.parse(res.stdout);
}

// ----------------- Diagnostics & Web -----------------

export async function cortexDoctor(cwd?: string): Promise<{ stdout: string; ok: boolean }> {
  const res = await execCortex(["doctor"], cwd);
  return { stdout: res.stdout || res.stderr, ok: res.code === 0 };
}

export function launchWebDashboard(openBrowser: boolean = true): void {
  const binary = resolveCortexBinary();
  const args = ["web"];
  if (openBrowser) args.push("--open");
  const child = spawn(binary, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: false,
  });
  child.unref();
}
