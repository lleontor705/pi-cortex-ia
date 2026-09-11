import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { foldOutput } from "../lib/quiet-tools.ts";

const execAsync = promisify(exec);

export default function registerQuietTools(pi: ExtensionAPI): void {
  // cortex_quiet_bash: runs a bash/powershell command and automatically folds long outputs
  pi.registerTool({
    name: "cortex_quiet_bash",
    label: "Quiet Bash",
    description: "Run shell command with automatic output folding, protecting LLM context from verbose logs.",
    parameters: Type.Object({
      command: Type.String({ description: "Command line to execute" }),
      max_lines: Type.Optional(Type.Integer({ description: "Max lines before folding (default 12)" })),
    }),
    async execute(_id, params: { command: string; max_lines?: number }, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd || process.cwd();
      const start = Date.now();
      try {
        const { stdout, stderr } = await execAsync(params.command, {
          cwd,
          timeout: 60000,
          maxBuffer: 5 * 1024 * 1024,
        });
        const duration = Date.now() - start;
        const raw = stdout ? stdout : stderr;
        const folded = foldOutput("bash", raw, duration, {
          maxLinesBeforeFold: params.max_lines || 12,
        });

        return {
          content: [{ type: "text", text: folded.display }],
          details: {
            totalLines: folded.totalLines,
            isFolded: folded.isFolded,
            durationMs: duration,
          },
        };
      } catch (err: any) {
        const duration = Date.now() - start;
        const raw = (err.stdout ? err.stdout : "") + "\n" + (err.stderr ? err.stderr : err.message);
        const folded = foldOutput("bash:error", raw, duration, {
          maxLinesBeforeFold: params.max_lines || 12,
        });
        return {
          content: [{ type: "text", text: `[Exit code ${err.code || 1}]\n${folded.display}` }],
          details: { error: err.message, isFolded: folded.isFolded },
        };
      }
    },
  });
}
