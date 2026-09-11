import test from "node:test";
import assert from "node:assert/strict";
import { resolveCortexBinary, boardList } from "../lib/cortex-cli.ts";
import { foldOutput } from "../lib/quiet-tools.ts";
import { calculateCorrectionBudget, evaluateCorrectionDiff } from "../lib/correction-budget.ts";
import { discoverSkills, syncSkillRegistry } from "../lib/skill-registry.ts";

test("Cortex CLI binary resolution", () => {
  const binary = resolveCortexBinary();
  assert.ok(binary.length > 0, "Binary path should be resolved");
  assert.ok(binary.includes("cortex-ia"), "Binary should contain cortex-ia");
});

test("Cortex CLI boardList execution", async () => {
  const boards = await boardList();
  assert.ok(Array.isArray(boards), "Boards should be an array");
  assert.ok(boards.length > 0, "Should have at least one board (e.g. default)");
  const def = boards.find((b) => b.board_id === "default");
  assert.ok(def, "Default board should exist");
});

test("Quiet Tools output folding", () => {
  // Short output: should not fold
  const shortOutput = "line 1\nline 2\nline 3";
  const shortResult = foldOutput("bash", shortOutput, 100, { maxLinesBeforeFold: 5 });
  assert.equal(shortResult.isFolded, false);
  assert.equal(shortResult.totalLines, 3);

  // Long output: should fold
  const longLines = Array.from({ length: 50 }, (_, i) => `log line ${i + 1}`).join("\n");
  const longResult = foldOutput("bash", longLines, 250, { maxLinesBeforeFold: 10, headLines: 2, tailLines: 2 });
  assert.equal(longResult.isFolded, true);
  assert.equal(longResult.totalLines, 50);
  assert.ok(longResult.display.includes("lines folded to protect LLM context window"));
  assert.ok(longResult.display.includes("log line 1"));
  assert.ok(longResult.display.includes("log line 50"));

  // Empty output: humanized message
  const emptyResult = foldOutput("grep", "");
  assert.equal(emptyResult.isFolded, false);
  assert.ok(emptyResult.summary.includes("0 matches found"));
});

test("Correction Budget calculations", () => {
  // Budget formula: min(200, ceil(delta / 2))
  assert.equal(calculateCorrectionBudget(10), 5);
  assert.equal(calculateCorrectionBudget(15), 8);
  assert.equal(calculateCorrectionBudget(100), 50);
  assert.equal(calculateCorrectionBudget(390), 195);
  assert.equal(calculateCorrectionBudget(600), 200); // capped at 200

  // Evaluation within budget
  const evalPass = evaluateCorrectionDiff(100, 30);
  assert.equal(evalPass.isWithinBudget, true);
  assert.equal(evalPass.excessLines, 0);

  // Evaluation exceeding budget
  const evalFail = evaluateCorrectionDiff(100, 70); // allowed 50, candidate 70
  assert.equal(evalFail.isWithinBudget, false);
  assert.equal(evalFail.excessLines, 20);
});

test("Skill Registry discovery and sync", async () => {
  const skills = discoverSkills(process.cwd());
  assert.ok(Array.isArray(skills), "Skills should be discovered");

  const syncRes = await syncSkillRegistry(process.cwd());
  assert.ok(syncRes.total >= 0, "Sync result should return total");
  assert.ok(syncRes.path.includes("skill-registry.md"), "Path should point to skill-registry.md");
});
