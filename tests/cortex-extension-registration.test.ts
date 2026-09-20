import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import activatePiCortexIA from "../extensions/index.ts";
import { DefaultResourceLoader } from "../node_modules/@earendil-works/pi-coding-agent/dist/core/resource-loader.js";
import { SettingsManager } from "../node_modules/@earendil-works/pi-coding-agent/dist/core/settings-manager.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

type Registered = {
  tools: string[];
  commands: string[];
  hooks: string[];
  warnings: string[];
};

function createRecordingPi(registry: Registered) {
  return {
    on(event: string) {
      registry.hooks.push(event);
    },
    registerTool(definition: { name: string }) {
      registry.tools.push(definition.name);
    },
    registerCommand(name: string) {
      registry.commands.push(name);
    },
  };
}

function assertUnique(values: string[], label: string): void {
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
  assert.deepEqual([...new Set(duplicates)], [], `duplicate ${label}: ${duplicates.join(", ")}`);
}

async function loadProjectPackageExtensions() {
  const agentDir = mkdtempSync(`${tmpdir()}/pi-cortex-registration-`);
  const settingsManager = SettingsManager.create(repoRoot, agentDir, { projectTrusted: true });
  const loader = new DefaultResourceLoader({
    cwd: repoRoot,
    agentDir,
    settingsManager,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
  });

  await loader.reload();
  return loader.getExtensions();
}

test("package manifest exposes a single extension entrypoint", () => {
  const manifest = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8"));
  const projectSettings = JSON.parse(readFileSync(resolve(repoRoot, ".pi/settings.json"), "utf8"));

  assert.deepEqual(manifest.pi.extensions, ["./extensions/index.ts"]);
  assert.deepEqual(projectSettings.packages, [".."]);
});

test("real Pi project package discovery loads Cortex registrations once and can reload", async () => {
  for (const phase of ["startup", "reload"] as const) {
    const result = await loadProjectPackageExtensions();
    const visibleExtensions = result.extensions.filter((extension) => !extension.hidden);

    assert.deepEqual(
      visibleExtensions.map((extension) => extension.path.replaceAll("\\", "/").replace(repoRoot.replaceAll("\\", "/"), "<repo>")),
      ["<repo>/extensions/index.ts"],
      phase,
    );
    assert.deepEqual(result.errors, [], phase);

    const tools = visibleExtensions.flatMap((extension) => [...extension.tools.keys()]);
    const commands = visibleExtensions.flatMap((extension) => [...extension.commands.keys()]);
    assert.ok(tools.includes("cortex_work"), phase);
    assert.ok(commands.includes("cortex:status"), phase);
    assertUnique(tools, `${phase} tools`);
    assertUnique(commands, `${phase} commands`);
  }
});

test("duplicate aggregate activation emits compact diagnostic and skips duplicate registrations", () => {
  const registry: Registered = { tools: [], commands: [], hooks: [], warnings: [] };
  const pi = createRecordingPi(registry);
  const originalWarn = console.warn;
  console.warn = (message?: unknown) => {
    registry.warnings.push(String(message));
  };

  try {
    activatePiCortexIA(pi as never);
    const first = { tools: registry.tools.length, commands: registry.commands.length, hooks: registry.hooks.length };
    activatePiCortexIA(pi as never);

    assert.ok(first.tools > 0);
    assert.ok(first.commands > 0);
    assert.ok(first.hooks > 0);
    assert.equal(registry.tools.length, first.tools);
    assert.equal(registry.commands.length, first.commands);
    assert.equal(registry.hooks.length, first.hooks);
    assert.deepEqual(registry.warnings, ["[pi-cortex-ia] Duplicate extension activation skipped: extensions/index.ts"]);
    assertUnique(registry.tools, "recorded tools");
    assertUnique(registry.commands, "recorded commands");
  } finally {
    console.warn = originalWarn;
  }
});

test("idempotent guard is per runtime so reload-style activation is not permanently blocked", () => {
  const first: Registered = { tools: [], commands: [], hooks: [], warnings: [] };
  const second: Registered = { tools: [], commands: [], hooks: [], warnings: [] };

  activatePiCortexIA(createRecordingPi(first) as never);
  activatePiCortexIA(createRecordingPi(second) as never);

  assert.deepEqual(second.tools, first.tools);
  assert.deepEqual(second.commands, first.commands);
  assert.deepEqual(second.hooks, first.hooks);
});
