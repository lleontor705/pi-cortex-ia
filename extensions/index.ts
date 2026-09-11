import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import registerCortexTools from "./cortex-tools.ts";
import registerQuietTools from "./cortex-quiet.ts";
import registerCortexCommands from "./cortex-commands.ts";
import registerCortexShell from "./cortex-shell.ts";

export default function activatePiCortexIA(pi: ExtensionAPI): void {
  registerCortexTools(pi);
  registerQuietTools(pi);
  registerCortexCommands(pi);
  registerCortexShell(pi);
}
