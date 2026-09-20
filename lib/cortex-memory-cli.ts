import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface CortexMemoryObservation {
  id?: number;
  type?: string;
  title: string;
  content: string;
  project?: string;
  scope?: string;
  topic_key?: string;
  score?: number;
  created_at?: string;
}

export interface CortexSearchResult {
  raw: string;
  memories: CortexMemoryObservation[];
}

export function resolveCortexMemoryBinary(): string {
  if (process.env.CORTEX_BIN && existsSync(process.env.CORTEX_BIN)) {
    return process.env.CORTEX_BIN;
  }
  const standardLocations = [
    join(homedir(), "go", "bin", "cortex.exe"),
    join(homedir(), "go", "bin", "cortex"),
    join(homedir(), ".cortex", "bin", "cortex.exe"),
    join(homedir(), ".cortex", "bin", "cortex"),
    "C:\\Users\\usrLuisLeon\\go\\bin\\cortex.exe",
  ];
  for (const loc of standardLocations) {
    if (existsSync(loc)) return loc;
  }
  return "cortex"; // fallback to PATH
}

export async function execCortexMemory(args: string[], cwd: string = process.cwd()): Promise<{ stdout: string; stderr: string; code: number }> {
  const binary = resolveCortexMemoryBinary();
  try {
    const res = await execFileAsync(binary, args, {
      cwd,
      timeout: 45000,
      windowsHide: true,
      maxBuffer: 15 * 1024 * 1024,
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

export async function cortexSearch(
  query: string,
  options: { mode?: string; limit?: number; project?: string } = {},
  cwd?: string
): Promise<CortexSearchResult> {
  const args = ["search", query];
  if (options.mode) args.push(`--mode=${options.mode}`);
  if (options.limit) args.push(`--limit=${options.limit}`);
  if (options.project) args.push(`--project=${options.project}`);

  const res = await execCortexMemory(args, cwd);
  if (res.code !== 0 && !res.stdout) {
    throw new Error(`cortex search failed: ${res.stderr || res.stdout}`);
  }

  const memories: CortexMemoryObservation[] = [];
  const lines = res.stdout.split("\n");
  let current: Partial<CortexMemoryObservation> | null = null;

  for (const line of lines) {
    const match = line.match(/^\[(\d+)\]\s+#(\d+)\s+\(([^)]+)\)\s+-\s+(.*)$/);
    if (match) {
      if (current && current.title) memories.push(current as CortexMemoryObservation);
      current = {
        id: parseInt(match[2], 10),
        type: match[3],
        title: match[4],
        content: "",
      };
    } else if (current) {
      current.content = (current.content + "\n" + line).trim();
    }
  }
  if (current && current.title) memories.push(current as CortexMemoryObservation);

  return { raw: res.stdout, memories };
}

export async function cortexSave(
  title: string,
  content: string,
  options: {
    type?: "decision" | "bugfix" | "discovery" | "pattern" | "architecture";
    topicKey?: string;
    project?: string;
    scope?: string;
  } = {},
  cwd?: string
): Promise<{ success: boolean; stdout: string }> {
  const args = ["save", title, content];
  if (options.type) args.push("--type", options.type);
  if (options.topicKey) args.push("--topic", options.topicKey);
  if (options.project) args.push("--project", options.project);
  if (options.scope) args.push("--scope", options.scope);

  const res = await execCortexMemory(args, cwd);
  if (res.code !== 0) {
    throw new Error(`cortex save failed: ${res.stderr || res.stdout}`);
  }
  return { success: true, stdout: res.stdout };
}

export async function cortexContext(project?: string, cwd?: string): Promise<string> {
  const args = ["context"];
  if (project) args.push(project);
  const res = await execCortexMemory(args, cwd);
  if (res.code !== 0) throw new Error(res.stderr || res.stdout);
  return res.stdout;
}

export async function cortexIngest(path?: string, options: { project?: string } = {}, cwd?: string): Promise<string> {
  const args = ["ingest"];
  if (path) args.push(path);
  if (options.project) args.push(`--project=${options.project}`);
  const res = await execCortexMemory(args, cwd);
  if (res.code !== 0) throw new Error(res.stderr || res.stdout);
  return res.stdout;
}

export async function cortexCode(
  subcommand: "scan" | "symbols" | "analyze" | "impact" | "diff" | "graph" | "map" | "tests" | "find",
  targetOrQuery?: string,
  options: {
    project?: string;
    hops?: number;
    kind?: string;
    maxFiles?: number;
    budget?: number;
    format?: string;
    staged?: boolean;
  } = {},
  cwd?: string
): Promise<string> {
  const args = ["code", subcommand];
  if (targetOrQuery) args.push(targetOrQuery);
  if (options.project) args.push(`--project=${options.project}`);
  if (options.hops !== undefined) args.push(`--hops=${options.hops}`);
  if (options.kind) args.push(`--kind=${options.kind}`);
  if (options.maxFiles !== undefined) args.push(`--max-files=${options.maxFiles}`);
  if (options.budget !== undefined) args.push(`--budget=${options.budget}`);
  if (options.format) args.push(`--format=${options.format}`);
  if (options.staged) args.push("--staged");

  const res = await execCortexMemory(args, cwd);
  if (res.code !== 0) throw new Error(res.stderr || res.stdout);
  return res.stdout;
}

export async function cortexMemoryDoctor(cwd?: string): Promise<{ stdout: string; ok: boolean }> {
  const res = await execCortexMemory(["doctor"], cwd);
  return { stdout: res.stdout || res.stderr, ok: res.code === 0 };
}
