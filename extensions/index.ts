/**
 * pi-memento — controlled research memory for pi.
 *
 * An extension for layered experiment tracking: factual run ledgers,
 * controlled contrasts, hypothesis ledgers, and indexed cold-memory archives.
 *
 * Commands:
 *   /memento init [dir] [--full]  scaffold a tracker (never overwrites)
 *   /memento validate [dir]       validate a tracker directory
 *   /memento status [dir]         show memory layers and ledger sizes
 *
 * Agent tools:
 *   memento_init, memento_validate, memento_status, memento_guide
 *
 * Validation shells out to lib/validate_tracker.mjs (a Node port of the
 * original validate_tracker.py from Memento-skill), so rules stay in one place.
 */

import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

function extensionDir(): string {
  try {
    if (typeof import.meta?.url === "string" && import.meta.url.startsWith("file:")) {
      return dirname(fileURLToPath(import.meta.url));
    }
  } catch {
    // fall through
  }
  const g = globalThis as { __dirname?: string };
  if (g.__dirname) return g.__dirname;
  return process.cwd();
}

function validatorScriptPath(): string {
  return join(extensionDir(), "lib", "validate_tracker.mjs");
}

function referencePath(topic: string): string {
  const file = { guide: "GUIDE.md", templates: "TEMPLATES.md", reference: "REFERENCE.md" }[topic] ?? "GUIDE.md";
  return join(extensionDir(), "references", file);
}

// ---------------------------------------------------------------------------
// Scaffold templates (mirror references/TEMPLATES.md)
// ---------------------------------------------------------------------------

const RUNS_CSV_HEADER =
  "run_id,status,date,run_dir,config_path,question_id,hypothesis_id,contrast_id,role,changed_axis,model_family,dataset,split,layer_or_stage,capacity,sparsity_or_topk,seed,steps,primary_metric,secondary_metric,diagnostic_metric_1,diagnostic_metric_2,quality_flags,notes\n";

const CONTRASTS_CSV_HEADER =
  "contrast_id,question_id,hypothesis_id,status,priority,baseline_runs,treatment_runs,control_runs,changed_axis,controlled_axes,prediction_direction,predicted_min_delta,predicted_reason,actual_delta,actual_result,info_gain,belief_update,next_action,risk,decision\n";

const HYPOTHESES_MD = `# Project Hypotheses

## H01: <state the claim in one sentence>

Current belief: <low | medium | high | unresolved>

Evidence:
- ...

Risk:
- ...

Next most informative contrast:
- ...

Update rule:
- If <observation>, strengthen this hypothesis.
- If <observation>, weaken this hypothesis and deprioritize the branch.
`;

const CURRENT_STATE_MD = `# Current State

Last updated: <YYYY-MM-DD>

## Current target

- ...

## Benchmark rule

- ...

## Current best evidence

- ...

## Current best run

- ...

## Next contrast

- ...

## Claim boundary

- supported: ...
- not supported: ...
`;

const ACTIVE_TRACKER_CSV_HEADER =
  "entry_id,kind,status,question_id,hypothesis_id,source_id,role,current_gradient,why_it_still_matters,next_action\n";

const EVIDENCE_LOG_MD = `# Evidence Log

## Claim: ...

- Supporting evidence:
  - ...
- Caveat:
  - ...
- What would overturn this:
  - ...
`;

const ARCHIVE_INDEX_MD = `# Archive Index

## <ARCHIVE_CLUSTER_ID>

- Topic:
- Archive reason:
- Recall triggers:
- Likely treasure:
- Recall value: \`dead_end | reference_finding | snapshot\`
- Trust level:
- Open first:
`;

const CORE_FILES: Record<string, string> = {
  "runs.csv": RUNS_CSV_HEADER,
  "contrasts.csv": CONTRASTS_CSV_HEADER,
  "hypotheses.md": HYPOTHESES_MD,
};

const LAYERED_FILES: Record<string, string> = {
  "CURRENT_STATE.md": CURRENT_STATE_MD,
  "ACTIVE_TRACKER.csv": ACTIVE_TRACKER_CSV_HEADER,
  "EVIDENCE_LOG.md": EVIDENCE_LOG_MD,
  "ARCHIVE_INDEX.md": ARCHIVE_INDEX_MD,
};

const LAYERED_DIRS = ["archive", "RECALL_NOTES"];

// ---------------------------------------------------------------------------
// Core operations (shared by commands and tools)
// ---------------------------------------------------------------------------

interface InitResult {
  dir: string;
  created: string[];
  skipped: string[];
}

function initTracker(dir: string, full: boolean): InitResult {
  const root = resolve(dir);
  mkdirSync(root, { recursive: true });

  const files: Record<string, string> = full ? { ...CORE_FILES, ...LAYERED_FILES } : { ...CORE_FILES };
  const created: string[] = [];
  const skipped: string[] = [];

  for (const [name, content] of Object.entries(files)) {
    const target = join(root, name);
    if (existsSync(target)) {
      skipped.push(name);
      continue;
    }
    writeFileSync(target, content, "utf8");
    created.push(name);
  }

  if (full) {
    for (const d of LAYERED_DIRS) {
      const p = join(root, d);
      if (!existsSync(p)) {
        mkdirSync(p, { recursive: true });
        writeFileSync(join(p, ".gitkeep"), "", "utf8");
        created.push(`${d}/`);
      } else {
        skipped.push(`${d}/`);
      }
    }
  }

  return { dir: root, created, skipped };
}

interface ValidateResult {
  dir: string;
  ok: boolean;
  output: string;
}

function validateTrackerDir(dir: string): Promise<ValidateResult> {
  const root = resolve(dir);
  const script = validatorScriptPath();
  return new Promise((resolvePromise) => {
    execFile(
      process.execPath,
      [script, root],
      { timeout: 30_000, windowsHide: true },
      (error, stdout, stderr) => {
        const output = (stdout + (stderr ? `\n${stderr}` : "")).trim();
        if (error && (error as NodeJS.ErrnoException).code === "ENOENT") {
          resolvePromise({ dir: root, ok: false, output: `validator not found: ${script}` });
          return;
        }
        resolvePromise({ dir: root, ok: !error, output: output || (error ? String(error.message) : "") });
      },
    );
  });
}

interface StatusResult {
  dir: string;
  exists: boolean;
  layers: { file: string; present: boolean; rows?: number }[];
}

function csvRowCount(path: string): number | undefined {
  try {
    const text = readFileSync(path, "utf8").trim();
    if (!text) return 0;
    return Math.max(0, text.split(/\r?\n/).length - 1);
  } catch {
    return undefined;
  }
}

function trackerStatus(dir: string): StatusResult {
  const root = resolve(dir);
  const known = [
    "CURRENT_STATE.md",
    "ACTIVE_TRACKER.csv",
    "ACTIVE_TRACKER.md",
    "EVIDENCE_LOG.md",
    "runs.csv",
    "contrasts.csv",
    "hypotheses.md",
    "ARCHIVE_INDEX.md",
    "archive",
    "RECALL_NOTES",
  ];
  const layers = known.map((file) => {
    const p = join(root, file);
    const present = existsSync(p);
    const rows = present && file.endsWith(".csv") ? csvRowCount(p) : undefined;
    return { file, present, rows };
  });
  const exists = layers.some((l) => l.present);
  return { dir: root, exists, layers };
}

function hasTracker(dir: string): boolean {
  return (
    existsSync(join(dir, "runs.csv")) &&
    existsSync(join(dir, "contrasts.csv")) &&
    existsSync(join(dir, "hypotheses.md"))
  );
}

function formatStatus(status: StatusResult): string {
  if (!status.exists) {
    return `No memento tracker found in ${status.dir}. Run "/memento init" to create one.`;
  }
  const lines = [`Memento tracker in ${status.dir}:`];
  for (const layer of status.layers) {
    if (!layer.present) continue;
    const suffix = layer.rows !== undefined ? ` (${layer.rows} rows)` : "";
    lines.push(`  [x] ${layer.file}${suffix}`);
  }
  const missingCore = ["runs.csv", "contrasts.csv", "hypotheses.md"].filter(
    (f) => !status.layers.find((l) => l.file === f)?.present,
  );
  if (missingCore.length > 0) {
    lines.push(`  [!] missing core files: ${missingCore.join(", ")}`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Tool helpers
// ---------------------------------------------------------------------------

function textResult(text: string, details: Record<string, unknown> = {}) {
  return { content: [{ type: "text" as const, text }], details };
}

function resolveDir(params: { dir?: string }, ctx: ExtensionContext): string {
  return params.dir ? resolve(ctx.cwd, params.dir) : ctx.cwd;
}

// ---------------------------------------------------------------------------
// Extension entry
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
  // When the project has a memento tracker, remind the agent of the reading
  // order and tooling. Keeps stale fragments out of the default context.
  pi.on("before_agent_start", async (event, ctx) => {
    if (!hasTracker(ctx.cwd)) return;
    return {
      systemPrompt:
        event.systemPrompt +
        "\n\nThis project contains a memento experiment tracker. Read order: CURRENT_STATE.md -> ACTIVE_TRACKER.* -> EVIDENCE_LOG.md -> full ledger (runs.csv, contrasts.csv, hypotheses.md) only as needed. Do not read archive/ by default. Use memento_status to inspect layers, memento_guide for the methodology, and memento_validate after editing tracker files. Record facts in runs.csv, predictions and outcomes in contrasts.csv, beliefs in hypotheses.md; never treat stale notes as current facts.",
    };
  });

  pi.registerCommand("memento", {
    description: "Memento tracker: init [dir] [--full] | validate [dir] | status [dir]",
    handler: async (args, ctx) => {
      const tokens = (args ?? "").trim().split(/\s+/).filter(Boolean);
      const sub = tokens[0] ?? "status";
      const positional = tokens.slice(1).filter((t) => !t.startsWith("--"));
      const dir = positional[0] ? resolve(ctx.cwd, positional[0]) : ctx.cwd;

      if (sub === "init") {
        const result = initTracker(dir, tokens.includes("--full"));
        const created = result.created.length > 0 ? `created: ${result.created.join(", ")}` : "nothing created";
        const skipped = result.skipped.length > 0 ? ` (kept existing: ${result.skipped.join(", ")})` : "";
        ctx.ui.notify(`memento init: ${created}${skipped}`, result.created.length > 0 ? "info" : "warning");
        return;
      }

      if (sub === "validate") {
        const result = await validateTrackerDir(dir);
        ctx.ui.notify(result.output || (result.ok ? "tracker validation passed" : "validation failed"), result.ok ? "info" : "error");
        return;
      }

      if (sub === "status") {
        ctx.ui.notify(formatStatus(trackerStatus(dir)), "info");
        return;
      }

      ctx.ui.notify('Usage: /memento init [dir] [--full] | /memento validate [dir] | /memento status [dir]', "warning");
    },
  });

  pi.registerTool({
    name: "memento_init",
    label: "Memento Init",
    description:
      "Scaffold a memento experiment tracker (runs.csv, contrasts.csv, hypotheses.md; with full=true also CURRENT_STATE.md, ACTIVE_TRACKER.csv, EVIDENCE_LOG.md, ARCHIVE_INDEX.md, archive/, RECALL_NOTES/). Never overwrites existing files.",
    parameters: Type.Object({
      dir: Type.Optional(Type.String({ description: "Target directory (default: current working directory)" })),
      full: Type.Optional(Type.Boolean({ description: "Also scaffold the layered hot/cold memory layout (default: false)" })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const result = initTracker(resolveDir(params, ctx), params.full === true);
      const lines = [
        `memento tracker scaffold in ${result.dir}`,
        result.created.length > 0 ? `created: ${result.created.join(", ")}` : "nothing created",
        result.skipped.length > 0 ? `kept existing: ${result.skipped.join(", ")}` : "",
        "",
        "Next: fill in question_id/hypothesis_id values, then record runs and contrasts. Validate with memento_validate after edits.",
      ].filter(Boolean);
      return textResult(lines.join("\n"), { ...result });
    },
  });

  pi.registerTool({
    name: "memento_validate",
    label: "Memento Validate",
    description:
      "Validate a memento tracker directory (runs.csv, contrasts.csv, hypotheses.md schema, cross-references, hypothesis markers). Run after editing tracker files.",
    parameters: Type.Object({
      dir: Type.Optional(Type.String({ description: "Tracker directory (default: current working directory)" })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const result = await validateTrackerDir(resolveDir(params, ctx));
      return textResult(result.output || (result.ok ? "tracker validation passed" : "validation failed"), {
        dir: result.dir,
        ok: result.ok,
      });
    },
  });

  pi.registerTool({
    name: "memento_status",
    label: "Memento Status",
    description:
      "Report which memento memory layers exist in a directory (hot path, full ledger, cold memory) and ledger row counts.",
    parameters: Type.Object({
      dir: Type.Optional(Type.String({ description: "Directory to inspect (default: current working directory)" })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const status = trackerStatus(resolveDir(params, ctx));
      return textResult(formatStatus(status), {
        dir: status.dir,
        exists: status.exists,
        present: status.layers.filter((l) => l.present).map((l) => l.file),
      });
    },
  });

  pi.registerTool({
    name: "memento_guide",
    label: "Memento Guide",
    description:
      "Read the memento controlled-recall methodology: the core guide, starter file templates, or the full quality rubric. Load before designing experiment trackers, contrasts, or hypothesis updates.",
    parameters: Type.Object({
      topic: Type.Optional(
        Type.Union([Type.Literal("guide"), Type.Literal("templates"), Type.Literal("reference")], {
          description: "guide (default): methodology and workflow | templates: starter file schemas and examples | reference: full rubric, failure modes, expected outputs",
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      const topic = params.topic ?? "guide";
      const path = referencePath(topic);
      if (!existsSync(path)) {
        return textResult(`memento reference not found: ${path}`, { ok: false, topic });
      }
      const text = readFileSync(path, "utf8");
      return textResult(text, { ok: true, topic });
    },
  });
}
