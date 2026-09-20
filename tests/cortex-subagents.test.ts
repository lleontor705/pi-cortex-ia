import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { ChildProcess, SpawnOptions } from "node:child_process";
import { CortexSubagentRunner, getRoleDirectives, resolvePiBinary, type CanonicalRole } from "../lib/cortex-subagents.ts";

test("Cortex Subagent role directives generation", () => {
  const roles: CanonicalRole[] = ["discovery", "investigate", "planner", "implement", "reviewer"];

  for (const role of roles) {
    const directives = getRoleDirectives(role, {
      role,
      objective: "Test objective",
      taskId: "task-001",
      allowedFiles: ["file.ts"],
    });

    assert.ok(directives.length > 50, `Directives for ${role} should be detailed`);
    assert.ok(directives.toLowerCase().includes(role), `Directives should contain role name: ${role}`);
  }

  // Check specific invariant reminders
  const implementDirectives = getRoleDirectives("implement", { role: "implement", objective: "code", taskId: "task-001" });
  assert.ok(implementDirectives.includes("cortex_lease"), "Implement role must mention cortex_lease");
  assert.ok(implementDirectives.includes("cortex_work"), "Implement role must mention cortex_work");

  const reviewerDirectives = getRoleDirectives("reviewer", { role: "reviewer", objective: "audit", taskId: "task-001" });
  assert.ok(reviewerDirectives.includes("cortex_ast"), "Reviewer role must mention cortex_ast");
  assert.ok(reviewerDirectives.includes("approve"), "Reviewer role must mention approve");
});

test("Pi binary resolution", () => {
  const piBin = resolvePiBinary();
  assert.ok(piBin.length > 0, "Pi binary should be resolved");
});

test("Windows subagent spawn resolves package Pi JS entry through node without shell", async () => {
  const cwd = "/repo with spaces/project";
  const entry = `${cwd}/node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js`;
  const packageJson = `${cwd}/node_modules/@earendil-works/pi-coding-agent/package.json`;
  const existing = new Set([entry, packageJson].map(canonicalPath));
  const calls: Array<{ command: string; args: string[]; options: SpawnOptions }> = [];

  const runner = new CortexSubagentRunner({
    cwd,
    platform: "win32",
    env: {},
    exists: (path) => existing.has(canonicalPath(path)),
    readFile: (path) => {
      assert.equal(canonicalPath(path), canonicalPath(packageJson));
      return JSON.stringify({ bin: { pi: "dist/bundle/cli.js" } });
    },
    spawn: (command, args, options) => {
      calls.push({ command, args, options });
      return successfulChild("VERDICT: PASS\nevidence: spawn-seam\n");
    },
  });

  const receipt = await runner.run({ role: "investigate", objective: "do not shell $MODEL && rm -rf .", cwd, timeoutMs: 1000 });

  assert.equal(receipt.success, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, process.execPath);
  assert.deepEqual([canonicalPath(calls[0].args[0]), calls[0].args[1]], [canonicalPath(entry), "--print"]);
  assert.match(calls[0].args[2], /do not shell/);
  assert.equal(calls[0].options.shell, false);
});

test("Windows explicit PI_BIN pi.cmd resolves shim JS without spawning cmd", async () => {
  const cwd = "/repo/project";
  const shim = `${cwd}/node_modules/.bin/pi.cmd`;
  const entry = `${cwd}/node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js`;
  const existing = new Set([shim, entry].map(canonicalPath));
  const calls: Array<{ command: string; args: string[] }> = [];

  const runner = new CortexSubagentRunner({
    cwd,
    platform: "win32",
    env: { PI_BIN: shim },
    exists: (path) => existing.has(canonicalPath(path)),
    readFile: () => `@ECHO off\nendLocal & "%_prog%" "%dp0%\\..\\@earendil-works\\pi-coding-agent\\dist\\bundle\\cli.js" %*`,
    spawn: (command, args, options) => {
      assert.equal(options.shell, false);
      calls.push({ command, args });
      return successfulChild("VERDICT: PASS\n");
    },
  });

  const receipt = await runner.run({ role: "discovery", objective: "inventory", cwd, timeoutMs: 1000 });

  assert.equal(receipt.verdict, "PASS");
  assert.equal(calls[0].command, process.execPath);
  assert.equal(canonicalPath(calls[0].args[0]), canonicalPath(entry));
  assert.notEqual(calls[0].command, shim);
});

test("Windows invalid explicit PI_BIN fails closed without fallback spawn", async () => {
  let spawned = false;
  const runner = new CortexSubagentRunner({
    platform: "win32",
    env: { PI_BIN: "C:/missing/pi.cmd" },
    exists: () => false,
    spawn: () => {
      spawned = true;
      return successfulChild("");
    },
  });

  const receipt = await runner.run({ role: "planner", objective: "plan", timeoutMs: 1000 });

  assert.equal(receipt.success, false);
  assert.equal(receipt.verdict, "BLOCKED");
  assert.match(receipt.output, /PI_BIN is configured but does not exist/);
  assert.equal(spawned, false);
});

function canonicalPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^[A-Z]:/i, "").replace(/\/node_modules\/\.bin\/\.\.\//g, "/node_modules/");
}

function successfulChild(stdoutText: string): ChildProcess {
  const child = new EventEmitter() as ChildProcess;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = () => true;
  setImmediate(() => {
    child.stdout?.emit("data", Buffer.from(stdoutText));
    child.emit("close", 0);
  });
  return child;
}
