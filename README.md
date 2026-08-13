# pi-memento

English | [中文](./README.zh-CN.md)

> Controlled recall for [pi](https://pi.dev) — a research-memory extension for
> agents that run many experiments and must not let stale notes pollute the
> next decision.

A pi-native port of [Memento-skill](https://github.com/waterdrop26651/Memento-skill)
(MIT, by waterdrop26651), rebuilt as a pure pi **extension**: scaffolding
commands, agent-callable tools, tracker validation, and the full methodology
available on demand — no skill, no Python, no extra runtime.

## What it does

Memento turns fragmented experiments, notes, and hypotheses into layered external
memory, so a fresh agent session recovers the *current decision surface* in
minutes instead of replaying the whole project history:

```text
CURRENT_STATE.md    ->  the minimum entry point for a fresh agent
ACTIVE_TRACKER.*    ->  only evidence that still has decision gradient
EVIDENCE_LOG.md     ->  compressed justification of current beliefs
runs.csv            ->  factual ledger, one row per run
contrasts.csv       ->  predictions, controls, observed deltas
hypotheses.md       ->  beliefs + what evidence would change them
archive/            ->  cold memory: indexed, recallable, never deleted
```

Facts, contrasts, and beliefs live in separate ledgers. Old branches are
archived behind an index and recalled only when a trigger justifies it.

When a tracker exists in the current project, the extension automatically
reminds the agent of the reading order (hot path first, archive last) so stale
fragments stay out of the default context.

## Install

```bash
pi install npm:pi-memento
```

Or from a local checkout:

```bash
pi install /path/to/pi-memento
```

## Usage

### Commands

| Command | Effect |
|---|---|
| `/memento init [dir] [--full]` | Scaffold a tracker. Core files by default; `--full` adds the layered hot/cold layout. Never overwrites. |
| `/memento validate [dir]` | Validate tracker files (schema, cross-references, hypothesis markers). |
| `/memento status [dir]` | Show which memory layers exist and ledger row counts. |

### Agent tools

| Tool | Purpose |
|---|---|
| `memento_init` | Scaffold trackers while the agent works. |
| `memento_validate` | Self-check trackers after edits. |
| `memento_status` | Inspect memory layers and ledger sizes. |
| `memento_guide` | Load the methodology on demand: `guide` (default), `templates` (starter schemas), or `reference` (full rubric). |

### Standalone validation

No Python needed — the validator is a faithful Node.js port of the original
`validate_tracker.py`:

```bash
node <package>/extensions/lib/validate_tracker.mjs <tracker_dir>
```

## Use it when

- Your project has many runs and ad-hoc notes keep contradicting each other.
- You hand off research across sessions and don't want full context replay.
- You want the next ablation/contrast ranked by information gain, not vibes.
- You want negative results preserved as decision assets, not lost.

## Package layout

```text
extensions/index.ts                  -> /memento commands, agent tools, tracker-aware context
extensions/lib/validate_tracker.mjs  -> Node validator (CLI + used by the tools)
extensions/references/GUIDE.md       -> methodology served by memento_guide
extensions/references/TEMPLATES.md   -> starter file schemas and examples
extensions/references/REFERENCE.md   -> full quality rubric
assets/banner.jpg                    -> gallery art (original, from upstream)
```

## Credits & license

MIT. Methodology, templates, and banner adapted from
[Memento-skill](https://github.com/waterdrop26651/Memento-skill) by
waterdrop26651. The pi extension and Node validator port follow the same
license.

## Publishing (maintainer checklist)

1. Update `author` / add `repository` in `package.json` for your account.
2. Optional gallery preview: push to GitHub, then add to the `pi` manifest:
   `"image": "https://raw.githubusercontent.com/<user>/<repo>/main/assets/banner.jpg"`.
3. `npm publish` — the `pi-package` keyword puts it on
   [pi.dev/packages](https://pi.dev/packages) automatically.
