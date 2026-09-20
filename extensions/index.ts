import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import registerCortexTools from "./cortex-tools.ts";
import registerCortexMemoryTools from "./cortex-memory-tools.ts";
import registerCortexSubagents from "./cortex-subagents.ts";
import registerQuietTools from "./cortex-quiet.ts";
import registerCortexCommands from "./cortex-commands.ts";
import registerCortexShell from "./cortex-shell.ts";
import registerCortexBanner from "./cortex-banner.ts";
import registerCortexTodo from "./cortex-todo.ts";

const activatedApis = new WeakSet<ExtensionAPI>();

export default function activatePiCortexIA(pi: ExtensionAPI): void {
  if (activatedApis.has(pi)) {
    console.warn("[pi-cortex-ia] Duplicate extension activation skipped: extensions/index.ts");
    return;
  }

  activatedApis.add(pi);
  registerCortexTools(pi);
  registerCortexMemoryTools(pi);
  registerCortexSubagents(pi);
  registerQuietTools(pi);
  registerCortexCommands(pi);
  registerCortexShell(pi);
  registerCortexBanner(pi);
  registerCortexTodo(pi);
}
