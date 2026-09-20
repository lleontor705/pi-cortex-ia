---
name: cortex-investigate
description: Repository diagnostics, read-only fact-finding, root-cause analysis, and AST structural assessment.
---

# Cortex-IA Investigate & Root-Cause Diagnosis

Use this skill when diagnosing errors, performing fact-finding without immediate file edits, or investigating architectural anomalies.

## Core Rules

1. **Strict Read-Only Boundary**:
   - The investigator holds no file editing or write permissions.
   - You must NEVER modify source files or make direct code edits.

2. **Targeted Inspection Budget**:
   - Enforce a strict inspection budget ($\le 5$ tool calls) when examining a specific artifact.
   - Query only the direct target; bypass full AST re-ingestion or broad unbounded searches.

3. **Cognitive Memory Synergy**:
   - Search prior decisions and bugfixes using `cortex_search`.
   - Inspect existing architectural patterns and known gotchas before forming hypotheses.

4. **AST Graph Traversal**:
   - Inspect symbol definitions, callers, and blast-radius via `cortex_ast` (command: "impact", "find", or "symbols").

5. **Diagnostic Receipt**:
   - Conclude with a falsifiable diagnostic hypothesis, reproduction proof, and minimal failure locality.
