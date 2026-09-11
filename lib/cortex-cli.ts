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
  revision: number;
  counts: Record<string, number>;
  created_at: string;
  updated_at: string;
}

export interface CortexWorkItem {
  id: string;
  title: string;
  status: "backlog" | "ready" | "in_progress" | "in_review" | "done" | "blocked";
  revision: number;
  created_at: string;
  updated_at: string;
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

export async function workApprove(id: string, reviewer: string, verdict: "PASS" | "FAIL", evidenceRef: string, cwd?: string): Promise<any> {
  const res = await execCortex(["work", "approve", id, "--reviewer", reviewer, "--verdict", verdict, "--evidence", evidenceRef], cwd);
  if (res.code !== 0) throw new Error(res.stderr || res.stdout);
  try { return JSON.parse(res.stdout); } catch { return { success: true }; }
}

export async function workRecover(cwd?: string): Promise<any> {
  const res = await execCortex(["work", "recover"], cwd);
  if (res.code !== 0) throw new Error(res.stderr || res.stdout);
  try { return JSON.parse(res.stdout); } catch { return { raw: res.stdout }; }
}

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
