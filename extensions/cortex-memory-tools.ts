import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  cortexCode,
  cortexContext,
  cortexIngest,
  cortexSave,
  cortexSearch,
  cortexMemoryDoctor,
} from "../lib/cortex-memory-cli.ts";

export default function registerCortexMemoryTools(pi: ExtensionAPI): void {
  // 1. cortex_search: HippoRAG & adaptive RAG memory search
  pi.registerTool({
    name: "cortex_search",
    label: "Cortex Memory Search",
    description: "Search persistent cognitive memories, decisions, bugfixes, and patterns using HippoRAG / adaptive RAG.",
    parameters: Type.Object({
      query: Type.String({ description: "Search query or question" }),
      mode: Type.Optional(Type.String({ description: "Search mode: auto, vector, lexical, multi_hop" })),
      limit: Type.Optional(Type.Integer({ description: "Maximum memories to return (default: 10)" })),
      project: Type.Optional(Type.String({ description: "Target project filter" })),
    }),
    async execute(_id, params: { query: string; mode?: string; limit?: number; project?: string }, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd || process.cwd();
      try {
        const res = await cortexSearch(params.query, {
          mode: params.mode,
          limit: params.limit,
          project: params.project,
        }, cwd);

        return {
          content: [{ type: "text", text: res.raw }],
          details: { count: res.memories.length, memories: res.memories },
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Memory Search Error: ${err.message}` }],
          details: { error: err.message },
        };
      }
    },
  });

  // 2. cortex_save: Save architectural decisions, bugfixes, gotchas, patterns
  pi.registerTool({
    name: "cortex_save",
    label: "Cortex Memory Save",
    description: "Persist architectural decisions, verified bugfixes, gotchas, or patterns to permanent Cortex memory.",
    parameters: Type.Object({
      title: Type.String({ description: "Title of the memory observation" }),
      content: Type.String({ description: "Detailed Markdown content explaining what, why, and learned" }),
      type: Type.Optional(Type.String({
        enum: ["decision", "bugfix", "discovery", "pattern", "architecture"],
        description: "Classification type of the memory",
      })),
      topic_key: Type.Optional(Type.String({ description: "Structured topic key (e.g. architecture/api, gotchas/cache)" })),
      project: Type.Optional(Type.String({ description: "Project name scope" })),
      scope: Type.Optional(Type.String({ description: "Scope (project or global)" })),
    }),
    async execute(_id, params: any, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd || process.cwd();
      try {
        const res = await cortexSave(params.title, params.content, {
          type: params.type || "decision",
          topicKey: params.topic_key,
          project: params.project,
          scope: params.scope,
        }, cwd);

        return {
          content: [{ type: "text", text: `Memory persisted successfully: "${params.title}"` }],
          details: res,
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Memory Save Error: ${err.message}` }],
          details: { error: err.message },
        };
      }
    },
  });

  // 3. cortex_context: Get recent project context & rules
  pi.registerTool({
    name: "cortex_context",
    label: "Cortex Memory Context",
    description: "Fetch recent memory context, active session timeline, and recent observations for the project.",
    parameters: Type.Object({
      project: Type.Optional(Type.String({ description: "Target project name" })),
    }),
    async execute(_id, params: { project?: string }, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd || process.cwd();
      try {
        const text = await cortexContext(params.project, cwd);
        return {
          content: [{ type: "text", text }],
          details: { raw: text },
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Context Error: ${err.message}` }],
          details: { error: err.message },
        };
      }
    },
  });

  // 4. cortex_ast: AST structural graph, blast radius, cycle detection, impacted tests
  pi.registerTool({
    name: "cortex_ast",
    label: "Cortex Code Graph",
    description: "Query AST symbols, callers, dependency cycles, blast radius, impacted tests, or repo-map.",
    parameters: Type.Object({
      command: Type.String({
        enum: ["scan", "symbols", "analyze", "impact", "diff", "graph", "map", "tests", "find"],
        description: "AST analysis command",
      }),
      target: Type.Optional(Type.String({ description: "Target symbol, file path, or search query" })),
      project: Type.Optional(Type.String({ description: "Project name scope" })),
      hops: Type.Optional(Type.Integer({ description: "Graph traversal hops depth" })),
      kind: Type.Optional(Type.String({ description: "Symbol kind filter (e.g. function, struct, interface)" })),
      budget: Type.Optional(Type.Integer({ description: "Token budget for repo-map" })),
      format: Type.Optional(Type.String({ description: "Output format (e.g. mermaid, text)" })),
      staged: Type.Optional(Type.Boolean({ description: "Inspect staged git changes only" })),
    }),
    async execute(_id, params: any, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd || process.cwd();
      try {
        const out = await cortexCode(params.command, params.target, {
          project: params.project,
          hops: params.hops,
          kind: params.kind,
          budget: params.budget,
          format: params.format,
          staged: params.staged,
        }, cwd);

        return {
          content: [{ type: "text", text: out }],
          details: { raw: out },
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `AST Analysis Error: ${err.message}` }],
          details: { error: err.message },
        };
      }
    },
  });

  // 5. cortex_ingest: Scan and index repository AST symbols
  pi.registerTool({
    name: "cortex_ingest",
    label: "Cortex AST Ingestion",
    description: "Run 2-pass static AST ingestion over the workspace, indexing symbols, imports, and calls into SQLite.",
    parameters: Type.Object({
      path: Type.Optional(Type.String({ description: "Absolute or relative path to index (defaults to workspace)" })),
      project: Type.Optional(Type.String({ description: "Project identifier name" })),
    }),
    async execute(_id, params: { path?: string; project?: string }, _signal, _onUpdate, ctx) {
      const cwd = ctx.cwd || process.cwd();
      try {
        const out = await cortexIngest(params.path, { project: params.project }, cwd);
        return {
          content: [{ type: "text", text: out || "AST ingestion completed successfully." }],
          details: { raw: out },
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Ingestion Error: ${err.message}` }],
          details: { error: err.message },
        };
      }
    },
  });
}
