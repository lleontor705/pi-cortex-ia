import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

export type CanonicalRole = "discovery" | "investigate" | "planner" | "implement" | "reviewer";

export interface SubagentTaskRequest {
  role: CanonicalRole;
  objective: string;
  taskId?: string;
  allowedFiles?: string[];
  artifactRefs?: string[];
  projectRules?: string[];
  timeoutMs?: number;
  cwd?: string;
}

export interface SubagentReceipt {
  role: CanonicalRole;
  taskId?: string;
  success: boolean;
  verdict?: "PASS" | "FAIL" | "BLOCKED";
  changedFiles?: string[];
  evidence?: string;
  output: string;
  durationMs: number;
}

export function getRoleDirectives(role: CanonicalRole, req: SubagentTaskRequest): string {
  switch (role) {
    case "discovery":
      return `
[CORTEX ROLE: DISCOVERY]
You are the native discovery agent for Cortex-IA.
Your objective is to profile the project: inspect repository manifests, detect languages, framework versions, installed skills, required engines, and architecture.
Write or update your findings strictly to .cortex-ia/discovery.md.
Do NOT modify production source code or run destructive operations.
`.trim();

    case "investigate":
      return `
[CORTEX ROLE: INVESTIGATE]
You are the read-only investigation and diagnostic agent.
Objective: ${req.objective}
Rules:
1. Conduct fact-finding and root-cause analysis using read-only tools (read, grep, cortex_search, cortex_ast).
2. Produce a falsifiable diagnostic hypothesis and minimal failure locality.
3. You must NEVER modify source files or make direct code edits.
`.trim();

    case "planner":
      return `
[CORTEX ROLE: PLANNER]
You are the SDD planning agent for Cortex-IA.
Objective: ${req.objective}
Rules:
1. Ground your plan in existing code contracts and design boundaries.
2. Produce RFC 2119 delta specifications (MUST, SHOULD) in openspec/.
3. Decompose implementation into vertical-slice DAG nodes <= 350 LOC (TypeScript/Python) or <= 500 LOC (Go/Rust/Java).
4. Register tasks into the SQLite DAG via 'cortex_work' (action: "create").
5. Do NOT claim tasks or edit product code.
`.trim();

    case "implement":
      return `
[CORTEX ROLE: IMPLEMENT]
You are an ephemeral implementation minion for task: ${req.taskId || "ad-hoc"}.
Objective: ${req.objective}
Allowed files: ${req.allowedFiles ? req.allowedFiles.join(", ") : "Defined in task"}
Rules:
1. Claim the task using 'cortex_work' (action: "claim").
2. Acquire exclusive file leases via 'cortex_lease' before editing any file.
3. Keep changes strictly within allowed_files and the budget min(200, ceil(delta / 2)).
4. Run proportional tests to prove observable behavior.
5. On success, transition task to 'in_review' via 'cortex_work' (action: "transition").
6. You CANNOT self-approve. Approval requires the independent reviewer.
`.trim();

    case "reviewer":
      return `
[CORTEX ROLE: REVIEWER]
You are the independent adversarial reviewer for task: ${req.taskId || "ad-hoc"}.
Objective: ${req.objective}
Rules:
1. Independently audit the changes without author bias.
2. Verify that unit and integration tests run and pass deterministically.
3. Verify no coupling spikes or cycle regressions via 'cortex_ast' (command: "cycles").
4. If passed, grant approval via 'cortex_work' (action: "approve", verdict: "PASS", evidence: "...").
5. If failed, return FAIL with minimal failure locality saved to Cortex memory ('cortex_save').
`.trim();
  }
}

interface PiResolutionDeps {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  exists?: (path: string) => boolean;
  readFile?: (path: string) => string;
}

interface PiInvocation {
  command: string;
  argsPrefix: string[];
  displayPath: string;
  error?: string;
}

interface CortexSubagentRunnerDeps extends PiResolutionDeps {
  spawn?: (command: string, args: string[], options: SpawnOptions) => ChildProcess;
}

const PI_PACKAGE = "@earendil-works/pi-coding-agent";

function safeExists(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isFile();
  } catch {
    return false;
  }
}

function resolvePackagePiEntry(cwd: string, exists: (path: string) => boolean, readFile: (path: string) => string): string | undefined {
  const packageJson = resolve(cwd, "node_modules", PI_PACKAGE, "package.json");
  if (!exists(packageJson)) return undefined;

  try {
    const pkg = JSON.parse(readFile(packageJson)) as { bin?: string | Record<string, string> };
    const bin = typeof pkg.bin === "string" ? pkg.bin : pkg.bin?.pi;
    if (!bin) return undefined;
    const entry = resolve(dirname(packageJson), bin);
    return exists(entry) && /\.(?:c|m)?js$/i.test(entry) ? entry : undefined;
  } catch {
    return undefined;
  }
}

function resolveCmdShimTarget(cmdPath: string, exists: (path: string) => boolean, readFile: (path: string) => string): string | undefined {
  let text = "";
  try {
    text = readFile(cmdPath).slice(0, 65536);
  } catch {
    return undefined;
  }

  const base = dirname(cmdPath);
  const jsRefs = text.match(/"[^"]+\.(?:c|m)?js"|\S+\.(?:c|m)?js/gi) || [];
  for (const ref of jsRefs) {
    const raw = ref.replace(/^"|"$/g, "").replace(/%dp0%|%~dp0/gi, base).replace(/\\/g, "/");
    const candidate = resolve(base, raw);
    if (exists(candidate) && /\.(?:c|m)?js$/i.test(candidate)) return candidate;
  }

  return undefined;
}

function resolvePiInvocation(deps: PiResolutionDeps = {}): PiInvocation {
  const cwd = deps.cwd || process.cwd();
  const env = deps.env || process.env;
  const platform = deps.platform || process.platform;
  const exists = deps.exists || safeExists;
  const readFile = deps.readFile || ((path: string) => readFileSync(path, "utf8"));
  const isWindows = platform === "win32";

  const explicit = env.PI_BIN;
  if (explicit) {
    if (!exists(explicit)) {
      return { command: process.execPath, argsPrefix: [], displayPath: explicit, error: `PI_BIN is configured but does not exist: ${explicit}` };
    }

    const jsEntry = /\.cmd$/i.test(explicit) ? resolveCmdShimTarget(explicit, exists, readFile) : explicit;
    if (jsEntry && /\.(?:c|m)?js$/i.test(jsEntry) && exists(jsEntry)) {
      return { command: process.execPath, argsPrefix: [jsEntry], displayPath: jsEntry };
    }

    if (!isWindows) return { command: explicit, argsPrefix: [], displayPath: explicit };
    return { command: process.execPath, argsPrefix: [], displayPath: explicit, error: `PI_BIN must resolve to a Pi JavaScript entry on Windows: ${explicit}` };
  }

  const packageEntry = resolvePackagePiEntry(cwd, exists, readFile);
  if (packageEntry) return { command: process.execPath, argsPrefix: [packageEntry], displayPath: packageEntry };

  if (isWindows) {
    const npmShim = join(cwd, "node_modules", ".bin", "pi.cmd");
    const shimEntry = exists(npmShim) ? resolveCmdShimTarget(npmShim, exists, readFile) : undefined;
    if (shimEntry) return { command: process.execPath, argsPrefix: [shimEntry], displayPath: shimEntry };
    return { command: process.execPath, argsPrefix: [], displayPath: npmShim, error: "Unable to resolve a Pi JavaScript entry; refusing to spawn pi.cmd or shell fallback." };
  }

  const standard = [
    join(homedir(), ".pi", "bin", "pi"),
    join(homedir(), "go", "bin", "pi"),
  ];
  for (const loc of standard) {
    if (exists(loc)) return { command: loc, argsPrefix: [], displayPath: loc };
  }
  return { command: "pi", argsPrefix: [], displayPath: "pi" };
}

export function resolvePiBinary(): string {
  return resolvePiInvocation().displayPath;
}

export class CortexSubagentRunner {
  private activeChildren = new Map<string, ChildProcess>();
  private readonly deps: CortexSubagentRunnerDeps;

  constructor(deps: CortexSubagentRunnerDeps = {}) {
    this.deps = deps;
  }

  async run(req: SubagentTaskRequest, onLog?: (chunk: string) => void): Promise<SubagentReceipt> {
    const start = Date.now();
    const cwd = req.cwd || process.cwd();
    const rolePrompt = getRoleDirectives(req.role, req);
    const fullPrompt = `${rolePrompt}\n\nTask Instructions:\n${req.objective}`;
    const timeout = req.timeoutMs || 180000; // 3 min default

    return new Promise((resolve) => {
      const pi = resolvePiInvocation({ ...this.deps, cwd, env: this.deps.env || process.env });
      let stdout = "";
      let stderr = "";
      let timedOut = false;

      if (pi.error) {
        resolve({
          role: req.role,
          taskId: req.taskId,
          success: false,
          verdict: "BLOCKED",
          output: pi.error,
          durationMs: Date.now() - start,
        });
        return;
      }

      // Launch child Pi process in print/rpc or non-interactive mode.
      // Windows must execute the real JS entry through Node; prompt text is argv data, never shell text.
      const child = (this.deps.spawn || spawn)(pi.command, [...pi.argsPrefix, "--print", fullPrompt], {
        cwd,
        env: {
          ...(this.deps.env || process.env),
          CORTEX_SUBAGENT_ROLE: req.role,
          CORTEX_TASK_ID: req.taskId || "",
        },
        shell: false,
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      });

      const childKey = `${req.role}-${req.taskId || Date.now()}`;
      this.activeChildren.set(childKey, child);

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
      }, timeout);

      child.stdout?.on("data", (data) => {
        const text = data.toString();
        stdout += text;
        onLog?.(text);
      });

      child.stderr?.on("data", (data) => {
        const text = data.toString();
        stderr += text;
        onLog?.(text);
      });

      child.on("close", (code) => {
        clearTimeout(timer);
        this.activeChildren.delete(childKey);
        const durationMs = Date.now() - start;

        if (timedOut) {
          resolve({
            role: req.role,
            taskId: req.taskId,
            success: false,
            verdict: "BLOCKED",
            output: `Subagent [${req.role}] timed out after ${timeout}ms.\n${stdout}`,
            durationMs,
          });
          return;
        }

        const isSuccess = code === 0;
        let verdict: "PASS" | "FAIL" | "BLOCKED" = isSuccess ? "PASS" : "FAIL";
        if (stdout.includes("VERDICT: PASS") || stdout.includes("verdict: PASS")) verdict = "PASS";
        if (stdout.includes("VERDICT: FAIL") || stdout.includes("verdict: FAIL")) verdict = "FAIL";
        if (stdout.includes("VERDICT: BLOCKED") || stdout.includes("verdict: BLOCKED")) verdict = "BLOCKED";

        resolve({
          role: req.role,
          taskId: req.taskId,
          success: isSuccess,
          verdict,
          evidence: stdout.includes("evidence:") ? stdout.split("evidence:")[1].split("\n")[0].trim() : undefined,
          output: stdout || stderr,
          durationMs,
        });
      });

      child.on("error", (err) => {
        clearTimeout(timer);
        this.activeChildren.delete(childKey);
        resolve({
          role: req.role,
          taskId: req.taskId,
          success: false,
          verdict: "BLOCKED",
          output: `Failed to spawn subagent [${req.role}]: ${err.message}`,
          durationMs: Date.now() - start,
        });
      });
    });
  }

  cancelAll(): void {
    for (const [key, child] of this.activeChildren) {
      child.kill("SIGKILL");
      this.activeChildren.delete(key);
    }
  }
}

export const defaultSubagentRunner = new CortexSubagentRunner();
