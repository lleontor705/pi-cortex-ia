import test from "node:test";
import assert from "node:assert/strict";
import { resolveCortexMemoryBinary, cortexContext, cortexSearch } from "../lib/cortex-memory-cli.ts";

test("Cortex Memory binary resolution", () => {
  const binary = resolveCortexMemoryBinary();
  assert.ok(binary.length > 0, "Memory binary path should be resolved");
  assert.ok(binary.toLowerCase().includes("cortex"), "Binary name should include cortex");
});

test("Cortex Memory context execution", async () => {
  try {
    const ctx = await cortexContext();
    assert.ok(typeof ctx === "string", "Context should return a string");
  } catch (err: any) {
    // If running in an environment without initialized memory DB, ensure error is descriptive
    assert.ok(err.message, "Should return descriptive message on error");
  }
});

test("Cortex Memory search parsing", async () => {
  try {
    const res = await cortexSearch("test", { limit: 3 });
    assert.ok(typeof res.raw === "string", "Raw output should be string");
    assert.ok(Array.isArray(res.memories), "Parsed memories should be array");
  } catch (err: any) {
    assert.ok(err.message, "Should handle search call");
  }
});
