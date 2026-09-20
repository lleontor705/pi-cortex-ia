import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { defaultSubagentRunner, type CanonicalRole } from "../lib/cortex-subagents.ts";

export default function registerCortexSubagents(pi: ExtensionAPI): void {
  // cortex_subagent: Tool for delegating tasks to canonical Cortex-IA subagents
  pi.registerTool({
    name: "cortex_subagent",
    label: "Cortex Subagent",
    description: "Dispatch a specialized child subagent (discovery, investigate, planner, implement, reviewer) with isolated context.",
    parameters: Type.Object({
      role: Type.String({
        enum: ["discovery", "investigate", "planner", "implement", "reviewer"],
        description: "Canonical subagent role to dispatch",
      }),
      objective: Type.String({ description: "Specific and bounded objective for the subagent" }),
      task_id: Type.Optional(Type.String({ description: "Task ID in SQLite DAG (required for implement/reviewer)" })),
      allowed_files: Type.Optional(Type.Array(Type.String(), { description: "Allowed files for implementation scope" })),
      timeout_seconds: Type.Optional(Type.Integer({ description: "Timeout in seconds (default: 180s)" })),
    }),
    async execute(_id, params: any, signal, onUpdate, ctx) {
      const cwd = ctx.cwd || process.cwd();
      const role = params.role as CanonicalRole;

      onUpdate?.({
        content: [{ type: "text", text: `🚀 Dispatching Cortex subagent [${role}]...` }],
        details: { status: "dispatching", role },
      });

      try {
        const receipt = await defaultSubagentRunner.run(
          {
            role,
            objective: params.objective,
            taskId: params.task_id,
            allowedFiles: params.allowed_files,
            timeoutMs: (params.timeout_seconds || 180) * 1000,
            cwd,
          },
          (chunk) => {
            onUpdate?.({
              content: [{ type: "text", text: `[${role}] ${chunk.slice(-200)}` }],
              details: { status: "running", role, chunkLength: chunk.length },
            });
          }
        );

        const summaryText = `### Subagent [${receipt.role}] Receipt\n- **Status**: ${receipt.success ? "Success" : "Failed"}\n- **Verdict**: ${receipt.verdict || "N/A"}\n- **Duration**: ${Math.round(receipt.durationMs / 1000)}s\n\n\`\`\`\n${receipt.output.slice(0, 2000)}\n\`\`\``;

        return {
          content: [{ type: "text", text: summaryText }],
          details: receipt,
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Subagent Dispatch Error: ${err.message}` }],
          details: { error: err.message },
        };
      }
    },
  });
}
