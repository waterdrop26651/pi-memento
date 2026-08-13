#!/usr/bin/env node
/**
 * Validate a memento experiment tracker directory.
 *
 * Node.js port of the original validate_tracker.py from Memento-skill
 * (https://github.com/waterdrop26651/Memento-skill), so pi users do not need
 * a Python runtime. The validation rules are identical.
 *
 * Usage: node validate_tracker.mjs <tracker_dir>
 * Exit codes: 0 = passed, 1 = validation errors, 2 = usage error.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const REQUIRED_FILES = ["runs.csv", "contrasts.csv", "hypotheses.md"];

const RUN_REQUIRED_COLUMNS = new Set([
  "run_id",
  "status",
  "date",
  "question_id",
  "hypothesis_id",
  "contrast_id",
  "role",
  "quality_flags",
  "notes",
]);

const CONTRAST_REQUIRED_COLUMNS = new Set([
  "contrast_id",
  "question_id",
  "hypothesis_id",
  "status",
  "priority",
  "baseline_runs",
  "treatment_runs",
  "control_runs",
  "changed_axis",
  "controlled_axes",
  "prediction_direction",
  "predicted_min_delta",
  "predicted_reason",
  "actual_delta",
  "actual_result",
  "info_gain",
  "belief_update",
  "next_action",
  "risk",
  "decision",
]);

/** Minimal RFC-4180 CSV parser (quoted fields, "" escapes, CRLF/LF). */
export function parseCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      // skip fully empty trailing lines
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }
  if (rows.length === 0) return { fieldnames: [], rows: [] };
  const fieldnames = rows[0].map((h) => h.trim());
  const records = rows.slice(1).map((cells) => {
    const rec = {};
    fieldnames.forEach((name, idx) => {
      rec[name] = cells[idx] ?? "";
    });
    return rec;
  });
  return { fieldnames, rows: records };
}

function splitIds(value) {
  if (!value || !value.trim()) return [];
  return value
    .split(/[,|]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function validateRuns(rows, errors) {
  const seen = new Set();
  rows.forEach((row, i) => {
    const line = i + 2;
    const runId = (row.run_id ?? "").trim();
    if (!runId) {
      errors.push(`runs.csv:${line} missing run_id`);
      return;
    }
    if (seen.has(runId)) errors.push(`runs.csv:${line} duplicate run_id ${runId}`);
    seen.add(runId);
    for (const key of ["question_id", "hypothesis_id", "contrast_id", "role", "status"]) {
      if (!(row[key] ?? "").trim()) errors.push(`runs.csv:${line} missing ${key} for ${runId}`);
    }
  });
  return seen;
}

function validateContrasts(rows, runIds, errors) {
  const seen = new Set();
  rows.forEach((row, i) => {
    const line = i + 2;
    const contrastId = (row.contrast_id ?? "").trim();
    if (!contrastId) {
      errors.push(`contrasts.csv:${line} missing contrast_id`);
      return;
    }
    if (seen.has(contrastId)) errors.push(`contrasts.csv:${line} duplicate contrast_id ${contrastId}`);
    seen.add(contrastId);

    if (!(row.changed_axis ?? "").trim()) {
      errors.push(`contrasts.csv:${line} missing changed_axis for ${contrastId}`);
    }

    const status = (row.status ?? "").trim();
    const isPlanned = ["planned", "queued", "running"].includes(status);
    const allowsFutureRuns = ["planned", "queued"].includes(status);
    if (isPlanned) {
      for (const key of ["prediction_direction", "predicted_min_delta", "predicted_reason"]) {
        if (!(row[key] ?? "").trim()) {
          errors.push(`contrasts.csv:${line} missing ${key} for planned contrast ${contrastId}`);
        }
      }
    }

    for (const field of ["baseline_runs", "treatment_runs", "control_runs"]) {
      for (const runId of splitIds(row[field] ?? "")) {
        if (allowsFutureRuns && (field === "treatment_runs" || field === "control_runs")) continue;
        if (runIds.has(runId)) continue;
        errors.push(`contrasts.csv:${line} references unknown run_id ${runId} in ${contrastId}`);
      }
    }
  });
  return seen;
}

function validateHypotheses(path, errors) {
  const text = readFileSync(path, "utf8");
  for (const marker of [
    "Current belief:",
    "Evidence:",
    "Risk:",
    "Next most informative contrast:",
    "Update rule:",
  ]) {
    if (!text.includes(marker)) errors.push(`hypotheses.md missing marker: ${marker}`);
  }
}

/** Validate a tracker directory. Returns a list of error messages ([] = valid). */
export function validateTracker(root) {
  const errors = [];
  for (const filename of REQUIRED_FILES) {
    if (!existsSync(join(root, filename))) errors.push(`missing required file: ${filename}`);
  }
  if (errors.length > 0) return errors;

  const runs = parseCsv(readFileSync(join(root, "runs.csv"), "utf8"));
  const contrasts = parseCsv(readFileSync(join(root, "contrasts.csv"), "utf8"));

  for (const field of [...RUN_REQUIRED_COLUMNS].filter((f) => !runs.fieldnames.includes(f)).sort()) {
    errors.push(`runs.csv missing required column: ${field}`);
  }
  for (const field of [...CONTRAST_REQUIRED_COLUMNS].filter((f) => !contrasts.fieldnames.includes(f)).sort()) {
    errors.push(`contrasts.csv missing required column: ${field}`);
  }
  if (errors.length > 0) return errors;

  const runIds = validateRuns(runs.rows, errors);
  validateContrasts(contrasts.rows, runIds, errors);
  validateHypotheses(join(root, "hypotheses.md"), errors);
  return errors;
}

// CLI entry (only when executed directly, not when imported)
const isMain = process.argv[1] && import.meta.url === new URL(`file://${resolve(process.argv[1])}`).href;
if (isMain) {
  if (process.argv.length !== 3) {
    console.error("usage: validate_tracker.mjs <tracker_dir>");
    process.exit(2);
  }
  const errors = validateTracker(resolve(process.argv[2]));
  if (errors.length > 0) {
    console.error(errors.join("\n"));
    process.exit(1);
  }
  console.log("tracker validation passed");
}
