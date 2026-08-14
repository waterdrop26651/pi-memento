// Smoke test for pi-memento extension wiring (run with tsx).
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert";

const logs = [];
const commands = {};
const tools = {};
let startHook;
const pi = {
  on: (ev, fn) => { if (ev === "before_agent_start") startHook = fn; },
  registerCommand: (name, cmd) => { commands[name] = cmd; },
  registerTool: (spec) => { tools[spec.name] = spec; },
};

const mod = await import(process.argv[2] ?? "../extensions/index.ts");
mod.default(pi);

const ctxFor = (cwd) => ({ cwd, ui: { notify: (msg, level) => logs.push([level, msg]) } });
const mk = () => mkdtempSync(join(tmpdir(), "memento-test-"));

// 1. init defaults into memento/ subdir, keeps root clean
{
  const dir = mk();
  await commands.memento.handler("init --full", ctxFor(dir));
  assert.ok(existsSync(join(dir, "memento", "runs.csv")), "memento/runs.csv created");
  assert.ok(existsSync(join(dir, "memento", "CURRENT_STATE.md")), "full layout created");
  assert.ok(existsSync(join(dir, "memento", "archive")), "archive/ created");
  assert.ok(!existsSync(join(dir, "runs.csv")), "root stays clean (no runs.csv at root)");
  console.log("ok 1: init defaults to memento/ subdir");
}

// 2. init is idempotent
{
  const dir = mk();
  const ctx = ctxFor(dir);
  await commands.memento.handler("init", ctx);
  await commands.memento.handler("init", ctx);
  assert.ok(logs.some(([l, m]) => l === "warning" && m.includes("nothing created")), "second init creates nothing");
  console.log("ok 2: init never overwrites");
}

// 3. init --root keeps legacy root-level behavior
{
  const dir = mk();
  await commands.memento.handler("init --root", ctxFor(dir));
  assert.ok(existsSync(join(dir, "runs.csv")), "root-level runs.csv created with --root");
  console.log("ok 3: --root legacy layout");
}

// 4. status + validate auto-locate the memento/ subdir from project root
{
  const dir = mk();
  const ctx = ctxFor(dir);
  await commands.memento.handler("init", ctx);
  logs.length = 0;
  await commands.memento.handler("status", ctx);
  assert.ok(logs.some(([, m]) => m.includes(join(dir, "memento"))), "status reports memento/ subdir");
  await commands.memento.handler("validate", ctx);
  assert.ok(logs.some(([l, m]) => l === "info" && m.includes("validation passed")), "validate passes on subdir tracker");
  console.log("ok 4: status/validate auto-locate subdir");
}

// 5. before_agent_start hook fires with subdir-aware paths
{
  const dir = mk();
  await commands.memento.handler("init", ctxFor(dir));
  const result = await startHook({ systemPrompt: "BASE" }, ctxFor(dir));
  assert.ok(result.systemPrompt.includes("`memento/`"), "prompt names memento/ dir");
  assert.ok(result.systemPrompt.includes("memento/CURRENT_STATE.md"), "prompt uses prefixed paths");
  console.log("ok 5: hook injects subdir-aware read order");
}

// 6. legacy root tracker still detected
{
  const dir = mk();
  await commands.memento.handler("init --root", ctxFor(dir));
  const result = await startHook({ systemPrompt: "BASE" }, ctxFor(dir));
  assert.ok(result.systemPrompt.includes("memento experiment tracker"), "root tracker detected");
  assert.ok(!result.systemPrompt.includes("memento/CURRENT_STATE.md"), "root tracker uses unprefixed paths");
  console.log("ok 6: legacy root layout detected");
}

// 7. experiment_tracker/ subdir candidate detected by hook
{
  const dir = mk();
  await commands.memento.handler("init", ctxFor(dir));
  // simulate a tracker living in experiment_tracker/
  const { renameSync } = await import("node:fs");
  renameSync(join(dir, "memento"), join(dir, "experiment_tracker"));
  const result = await startHook({ systemPrompt: "BASE" }, ctxFor(dir));
  assert.ok(result.systemPrompt.includes("experiment_tracker/CURRENT_STATE.md"), "experiment_tracker/ candidate detected");
  console.log("ok 7: experiment_tracker/ candidate");
}

// 8. init refuses to create a second tracker elsewhere
{
  const dir = mk();
  const ctx = ctxFor(dir);
  await commands.memento.handler("init", ctx);
  rmSync(join(dir, "memento", "runs.csv")); // break core so hasTracker fails? no — use existing tracker case properly
  console.log("skip 8 (covered by 2)");
}

// 8b. init at project root when tracker already in memento/ subdir -> warns, no root files
{
  const dir = mk();
  const ctx = ctxFor(dir);
  await commands.memento.handler("init", ctx);
  logs.length = 0;
  await commands.memento.handler("init --root", ctx); // explicit --root with existing subdir tracker
  assert.ok(logs.some(([l]) => l === "warning"), "existing tracker warns");
  assert.ok(!existsSync(join(dir, "runs.csv")), "no root tracker created");
  console.log("ok 8: init refuses duplicate tracker");
}

// 9. tools work: memento_init into subdir, memento_status locates it
{
  const dir = mk();
  const ctx = ctxFor(dir);
  const r1 = await tools.memento_init.execute("1", { full: true }, undefined, undefined, ctx);
  assert.ok(r1.details.dir.endsWith("memento"), "tool init targets memento/ subdir");
  const r2 = await tools.memento_status.execute("2", {}, undefined, undefined, ctx);
  assert.ok(r2.details.exists === true, "tool status finds tracker");
  const r3 = await tools.memento_validate.execute("3", {}, undefined, undefined, ctx);
  assert.ok(r3.details.ok === true, "tool validate passes");
  console.log("ok 9: agent tools subdir-aware");
}

// 10. init into a dir already named memento/ does not double-nest
{
  const dir = mk();
  const target = join(dir, "memento");
  const r = await tools.memento_init.execute("1", { dir: target }, undefined, undefined, ctxFor(dir));
  assert.ok(r.details.dir === target, "no memento/memento nesting");
  assert.ok(existsSync(join(target, "runs.csv")), "files directly in named dir");
  console.log("ok 10: no double nesting");
}

console.log("\nALL TESTS PASSED");
