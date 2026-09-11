import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type, type Static } from "typebox";
import {
  boardCreate,
  boardList,
  boardStatus,
  cortexDoctor,
  workApprove,
  workClaim,
  workCreate,
  workLease,
  workLeaseRenew,
  workRecover,
  workRelease,
  workRenew,
  workStatus,
  workTransition,
} from "../lib/cortex-cli.ts";
import { SimpleChoiceList, type ChoiceOption, type ChoiceSelection } from "../lib/choice-modal.ts";

const ChoiceOptionSchema = Type.Object({
  label: Type.String({ description: "Label shown to the user" }),
  value: Type.String({ description: "Value returned when selected" }),
  description: Type.Optional(Type.String({ description: "Optional explanation of the option" })),
});

const ChoiceParamsSchema = Type.Object({
  question: Type.String({ description: "The decision or question to pose to the user" }),
  options: Type.Array(ChoiceOptionSchema, { minItems: 2, maxItems: 4, description: "2 to 4 closed options" }),
});

export default function registerCortexTools(pi: ExtensionAPI): void {
  // 1. cortex_board
  pi.registerTool({
    name: "cortex_board",
    label: "Cortex Board",
    description: "Manage and inspect Cortex-IA task boards and DAG topology.",
    parameters: Type.Object({
      action: Type.String({ enum: ["list", "status", "create"], description: "Action to perform" }),
      board_id: Type.Optional(Type.String({ description: "Board ID for status or create" })),
      title: Type.Optional(Type.String({ description: "Board title for create" })),
      description: Type.Optional(Type.String({ description: "Board description for create" })),
    }),
    async execute(_id, params: any, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd || process.cwd();
      try {
        if (params.action === "list") {
          const boards = await boardList(cwd);
          return {
            content: [{ type: "text", text: JSON.stringify(boards, null, 2) }],
            details: { boards },
          };
        } else if (params.action === "status") {
          const bId = params.board_id || "default";
          const status = await boardStatus(bId, cwd);
          return {
            content: [{ type: "text", text: JSON.stringify(status, null, 2) }],
            details: status,
          };
        } else if (params.action === "create") {
          if (!params.board_id || !params.title) {
            throw new Error("board_id and title are required for create");
          }
          const res = await boardCreate(params.board_id, params.title, params.description, cwd);
          return {
            content: [{ type: "text", text: `Board ${params.board_id} created successfully.` }],
            details: res,
          };
        }
        throw new Error(`Unknown action: ${params.action}`);
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Error: ${err.message}` }],
          details: { error: err.message },
        };
      }
    },
  });

  // 2. cortex_work
  pi.registerTool({
    name: "cortex_work",
    label: "Cortex Work",
    description: "Manage Cortex-IA deterministic task lifecycle (create, claim, renew, transition, approve, recover).",
    parameters: Type.Object({
      action: Type.String({
        enum: ["create", "status", "claim", "renew", "transition", "approve", "recover"],
        description: "Lifecycle action to perform",
      }),
      task_id: Type.Optional(Type.String({ description: "Task ID" })),
      title: Type.Optional(Type.String({ description: "Title when creating task" })),
      board_id: Type.Optional(Type.String({ description: "Board ID for task" })),
      depends_on: Type.Optional(Type.Array(Type.String(), { description: "Prerequisite task IDs" })),
      owner: Type.Optional(Type.String({ description: "Agent or worker owner identity" })),
      claim_token: Type.Optional(Type.String({ description: "Claim token acquired from work claim" })),
      to_status: Type.Optional(Type.String({
        enum: ["in_progress", "in_review", "blocked"],
        description: "Target state for transition",
      })),
      reviewer: Type.Optional(Type.String({ description: "Reviewer agent identity for approve" })),
      verdict: Type.Optional(Type.String({ enum: ["PASS", "FAIL"], description: "Review verdict" })),
      evidence: Type.Optional(Type.String({ description: "Evidence reference (e.g. test run or diff commit)" })),
      ttl: Type.Optional(Type.String({ description: "Claim TTL (e.g. 15m)" })),
    }),
    async execute(_id, params: any, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd || process.cwd();
      try {
        switch (params.action) {
          case "create": {
            if (!params.task_id || !params.title) throw new Error("task_id and title are required for create");
            const res = await workCreate(params.task_id, params.title, { board: params.board_id, depends: params.depends_on }, cwd);
            return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }], details: res };
          }
          case "status": {
            if (!params.task_id) throw new Error("task_id is required for status");
            const res = await workStatus(params.task_id, cwd);
            return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }], details: res };
          }
          case "claim": {
            if (!params.task_id) throw new Error("task_id is required for claim");
            const owner = params.owner || "pi-agent";
            const res = await workClaim(params.task_id, owner, params.ttl || "15m", cwd);
            return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }], details: res };
          }
          case "renew": {
            if (!params.task_id || !params.claim_token) throw new Error("task_id and claim_token are required for renew");
            const res = await workRenew(params.task_id, params.claim_token, params.ttl || "15m", cwd);
            return { content: [{ type: "text", text: `Task ${params.task_id} claim renewed.` }], details: res };
          }
          case "transition": {
            if (!params.task_id || !params.claim_token || !params.to_status) {
              throw new Error("task_id, claim_token, and to_status are required for transition");
            }
            const res = await workTransition(params.task_id, params.claim_token, params.to_status, cwd);
            return { content: [{ type: "text", text: `Task ${params.task_id} transitioned to ${params.to_status}.` }], details: res };
          }
          case "approve": {
            if (!params.task_id || !params.verdict) throw new Error("task_id and verdict are required for approve");
            const reviewer = params.reviewer || "pi-reviewer";
            const evidence = params.evidence || "test-oracle-passed";
            const res = await workApprove(params.task_id, reviewer, params.verdict, evidence, cwd);
            return { content: [{ type: "text", text: `Task ${params.task_id} approved with verdict ${params.verdict}.` }], details: res };
          }
          case "recover": {
            const res = await workRecover(cwd);
            return { content: [{ type: "text", text: "Work recovery sweep completed." }], details: res };
          }
          default:
            throw new Error(`Unknown action: ${params.action}`);
        }
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], details: { error: err.message } };
      }
    },
  });

  // 3. cortex_lease
  pi.registerTool({
    name: "cortex_lease",
    label: "Cortex File Lease",
    description: "Acquire exclusive TTL lock on specific files before editing, preventing race conditions.",
    parameters: Type.Object({
      action: Type.String({ enum: ["lease", "renew", "release"], description: "Lease action" }),
      path: Type.String({ description: "Workspace-relative file path to lock/unlock" }),
      task_id: Type.Optional(Type.String({ description: "Task ID when acquiring lease" })),
      claim_token: Type.Optional(Type.String({ description: "Claim token when acquiring lease" })),
      lease_token: Type.Optional(Type.String({ description: "Lease token for renew or release" })),
      ttl: Type.Optional(Type.String({ description: "Lease TTL (e.g. 15m)" })),
    }),
    async execute(_id, params: any, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd || process.cwd();
      try {
        switch (params.action) {
          case "lease": {
            if (!params.task_id || !params.claim_token || !params.path) {
              throw new Error("task_id, claim_token, and path are required for lease");
            }
            const res = await workLease(params.task_id, params.claim_token, params.path, params.ttl || "15m", cwd);
            return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }], details: res };
          }
          case "renew": {
            if (!params.path || !params.lease_token) throw new Error("path and lease_token are required for renew");
            const res = await workLeaseRenew(params.path, params.lease_token, cwd);
            return { content: [{ type: "text", text: `Lease on ${params.path} renewed.` }], details: res };
          }
          case "release": {
            if (!params.path || !params.lease_token) throw new Error("path and lease_token are required for release");
            const res = await workRelease(params.path, params.lease_token, cwd);
            return { content: [{ type: "text", text: `Lease on ${params.path} released.` }], details: res };
          }
          default:
            throw new Error(`Unknown action: ${params.action}`);
        }
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], details: { error: err.message } };
      }
    },
  });

  // 4. cortex_ask_choice
  pi.registerTool({
    name: "cortex_ask_choice",
    label: "Ask Choice",
    description: "Render an interactive closed-choice modal in the terminal (2-4 options) to resolve architectural or planning ambiguities.",
    parameters: ChoiceParamsSchema,
    async execute(_id, params: Static<typeof ChoiceParamsSchema>, _signal, _onUpdate, ctx) {
      if (ctx.mode !== "tui" || !ctx.hasUI) {
        // Fallback for headless / non-interactive
        const first = params.options[0];
        return {
          content: [{ type: "text", text: `[Auto-selected first option in non-TUI mode]: ${first.label} (${first.value})` }],
          details: { selection: first },
        };
      }

      const selection = await ctx.ui.custom<ChoiceSelection | null>((_tui, _theme, _keybindings, done) => {
        return new SimpleChoiceList(
          params.options,
          params.question,
          (sel) => done(sel),
          () => done(null)
        );
      });

      if (!selection) {
        return {
          content: [{ type: "text", text: "User cancelled choice selection." }],
          details: { cancelled: true },
        };
      }

      return {
        content: [{ type: "text", text: `Selected: ${selection.label} (Value: ${selection.value})` }],
        details: { selection },
      };
    },
  });

  // 5. cortex_doctor
  pi.registerTool({
    name: "cortex_doctor",
    label: "Cortex Doctor",
    description: "Inspect health and environment status of Cortex-IA control plane.",
    parameters: Type.Object({}),
    async execute(_id, _params, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd || process.cwd();
      const res = await cortexDoctor(cwd);
      return {
        content: [{ type: "text", text: res.stdout }],
        details: { ok: res.ok },
      };
    },
  });
}
