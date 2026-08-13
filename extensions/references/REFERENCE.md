# Memento Reference

## Goal

Build a controlled external memory system that helps the agent choose the next best experiment, not just document past runs. The system should preserve the full landscape of what has been tried while exposing the highest-gradient next contrast and keeping stale fragments out of the default context.

## Mental model

Treat experimentation as belief updating under limited budget.

- `runs.csv` answers: what happened?
- `contrasts.csv` answers: what was tested, what was predicted, and what was learned?
- `hypotheses.md` answers: what do we currently believe, why, and what would change that belief?

The tracker is good when a new reader can answer these questions quickly:

- What are the main open questions?
- Which runs matter for each question?
- Which comparison is actually controlled?
- Which result changed the roadmap?
- What is the best next experiment and why?

For larger programs, add one more test:

- Can a fresh agent recover the current decision surface in a few minutes
  without reading stale experiments with near-zero gradient?

- If the answer is hidden in archive, can the agent find it without replaying
  the entire project history?

The core memory layers are:

- hot path: current state, active tracker, evidence log
- full ledger: runs, contrasts, hypotheses
- cold memory: archive, archive index, archive cards, recall notes

## Setup procedure

When creating a tracker from scratch:

1. Create `runs.csv`, `contrasts.csv`, and `hypotheses.md` from the templates.
2. Define `question_id` values for each important decision area.
3. Define `hypothesis_id` values for the active claims under each question.
4. Backfill old runs into `runs.csv`.
5. Group those runs into meaningful controlled comparisons in `contrasts.csv`.
6. Write the current belief state in `hypotheses.md`.
7. Rank the unresolved contrasts by expected information gain and decision leverage.

For an existing oversized tracker, do this refactor:

1. Identify the current roadmap and the few experiments that still change it.
2. Create `CURRENT_STATE.md` as the default entry point.
3. Create `ACTIVE_TRACKER.md` or `ACTIVE_TRACKER.csv` for only the still-live
   runs and contrasts.
4. Create `EVIDENCE_LOG.md` for the compressed justification of current beliefs.
5. Keep the full ledger in `runs.csv`, `contrasts.csv`, and `hypotheses.md`.
6. Move stale plans, dead branches, and superseded summaries into `archive/` or
   clearly mark them as historical only.
7. If the archive may still contain reusable findings, add an `ARCHIVE_INDEX.md`
   and short archive cards so recall is targeted rather than exploratory.

## Archive as cold memory

Archive is not just for traceability. In good research programs it is also a
low-frequency memory layer.

The problem is not that old experiments are unimportant. The problem is that
they are too expensive to keep on the hot path. The right answer is controlled
recall, not permanent amnesia and not default replay.

### What counts as a reusable archived asset

Archive may contain:

- hard constraints: branches that were cleanly falsified
- local positive signals: a sub-finding that survived even though the main route failed
- diagnostics: a probe, scorer, or control pattern worth reusing
- anomaly signatures: a recognizable failure pattern
- evaluation warnings: ways a metric can look better than reality

### Recall triggers

Recall archive when one of these is true:

- the current mainline has stalled or failed repeatedly
- the current problem is structurally similar to a past archived problem
- a new result conflicts with the current active belief state
- a high-value anomaly appears and active evidence does not explain it
- the user explicitly asks for a historical dig

### Recall budget and procedure

Use a bounded recall:

1. State the trigger.
2. Read `ARCHIVE_INDEX.md` or a likely archive card first.
3. Select at most 1-2 archive clusters.
4. Read at most 1-3 source files per cluster.
5. Write a recall note:
   - why recall happened
   - what was read
   - what asset was extracted
   - whether the current plan changed
6. If the asset is still live, promote it into the hot path.

This keeps archive useful without letting it consume the whole context budget.

## Schema guidance

### `runs.csv`

Use one row per run. Keep it factual.

Recommended column groups:

- Identity: `run_id`, `status`, `date`, `run_dir`
- Linkage: `question_id`, `hypothesis_id`, `contrast_id`, `role`
- Config axes: model size, dataset, split, layer, optimizer, seed, steps, intervention, eval mode
- Primary outcomes: the metrics that define success for this project
- Diagnostic outcomes: metrics that explain why the primary outcomes moved
- Trust signals: `quality_flags`, `notes`

Best practices:

- Include only axes that matter for comparison; do not dump every config field if they will never affect decisions.
- Use stable IDs and consistent naming.
- Put numbers in their own columns instead of burying them in notes.
- Use `quality_flags` for issues like `train_only_eval`, `confounded_control`, `partial_run`, `metric_bug`, `low_active`, `missing_seed_match`.
- If a run no longer affects current decisions, do not delete it. Keep it in
  `runs.csv`, but remove it from the default active view.

### `contrasts.csv`

Use one row per controlled comparison. This is the core unit of reasoning.

Recommended columns:

- Identity: `contrast_id`, `question_id`, `hypothesis_id`, `status`, `priority`
- Membership: `baseline_runs`, `treatment_runs`, `control_runs`
- Design: `changed_axis`, `controlled_axes`
- Prediction: `prediction_direction`, `predicted_min_delta`, `predicted_reason`
- Outcome: `actual_delta`, `actual_result`, `info_gain`, `belief_update`
- Decision: `next_action`, `risk`, `decision`

Best practices:

- Write the prediction before the run exists.
- If the contrast is one-to-many, explain the aggregation logic in `predicted_reason` or `notes`.
- `actual_result` should say what happened; `belief_update` should say what you now believe.
- `info_gain` can be qualitative (`low`, `medium`, `high`) unless the project has a rigorous numeric scoring rule.
- A completed contrast can remain historically important while still dropping
  out of the active working set.

### `hypotheses.md`

Use one section per claim. Each section should make future updating easy.

Include:

- Claim statement
- Current belief strength
- Evidence
- Risks or confounds
- Next most informative contrast
- Update rule

Good update rules are asymmetric and specific:

- "If held-out performance closes the gap, split the hypothesis."
- "If the cleaner features fail causal steering, downgrade the selection rule."
- "If recon improves without clean features increasing, deprioritize capacity expansion."

## Layered tracker files

### `CURRENT_STATE.md`

Purpose:

- Give a fresh agent the minimum facts needed to continue the project.

Should include:

- current target
- current benchmark rule
- strongest live evidence
- current best run
- next contrast
- important "do not misread this as X" boundaries

Keep it short. If it grows long, it is failing.

### `ACTIVE_TRACKER.md` or `ACTIVE_TRACKER.csv`

Purpose:

- Hold only experiments and comparisons that still have meaningful decision
  gradient.

Should usually include:

- current baseline row
- current best treatment
- 1-3 key supporting comparisons
- next planned contrast

Should usually exclude:

- old diagnostics whose lesson has already been absorbed
- superseded plans
- exploratory branches that no longer affect roadmap choices

### `EVIDENCE_LOG.md`

Purpose:

- Compress why the project currently believes what it believes.

Use short evidence blocks:

- claim
- strongest supporting experiments
- current caveat
- what evidence would overturn it

### `ARCHIVE_INDEX.md`

Purpose:

- Provide a searchable entry point into archive without requiring full replay.

Recommended fields:

- archive cluster id
- topic or question
- archive reason
- recall triggers
- likely treasure
- trust level
- entry files

Archive should be indexed by problem value, not only by date.

### Archive card

Purpose:

- Explain one archived cluster in a form short enough to read before opening
  raw files.

Should include:

- what question the cluster answered
- why it was archived
- what still might be reusable
- when to recall it
- which 1-3 files are best to open first

### Recall note

Purpose:

- Make archive reads auditable and bounded.

Should include:

- recall trigger
- selected archive clusters
- files actually read
- extracted asset
- whether the active plan changed
- whether any asset was promoted into the hot path

## Ranking candidate contrasts

The next experiment should maximize useful gradient. Rank candidate contrasts by:

1. Interpretability: one changed axis and adequate controls.
2. Decision leverage: the result changes what you do next.
3. Information gain: true and false outcomes both teach something.
4. Discriminative power: the contrast separates competing explanations.
5. Cost: cheap enough to run now.

Suggested heuristic labels:

- `P0`: highest information gain and immediate roadmap impact
- `P1`: important but not blocking
- `P2`: useful cleanup or confirmation
- `P3`: archival or low-value

Also classify historical relevance:

- `active`: still changes the next decision
- `reference`: supports the current story but not the immediate next step
- `archived`: retained for traceability only

For archive clusters, separately classify recall value:

- `dead_end`: mostly useful as a warning
- `reference_finding`: contains reusable local assets
- `snapshot`: mainly traceability, low expected recall value

## Result interpretation rubric

### Positive result

Keep it only if:

- the control was valid
- the effect size cleared the predicted minimum delta
- no quality flag invalidates the reading

### Negative result

Treat as valuable when:

- the prediction was explicit
- the contrast was well controlled
- the result rules out a previously plausible path

Negative results often create the strongest gradient because they remove a branch from the search tree.

### Flat result

Ask two questions:

- Was the axis actually irrelevant?
- Or was the contrast too noisy, underpowered, or confounded to show movement?

Do not record flat results as evidence of no effect without checking contrast quality.

### Surprising result

Use the gap between predicted and actual outcomes to inspect your reasoning:

- Was the hidden assumption about the metric?
- about the data?
- about the mechanism?
- about the control itself?

Then define the smallest follow-up contrast that isolates that assumption.

## Failure modes

Avoid these patterns:

- Logging runs without connecting them to questions or hypotheses
- Multi-axis changes masquerading as one conclusion
- Backfilling predictions after seeing the outcome
- Treating raw metric movement as insight when the contrast was confounded
- Writing vague hypotheses that cannot be updated
- Recording only successful runs and losing negative evidence
- Making every historical run part of the default reading path
- Confusing archival completeness with active decision support
- Letting the entry point become a replay of the whole project
- Treating archive as unreachable once it leaves the hot path
- Opening raw archive files before checking whether an indexed cluster is
  relevant
- Rediscovering the same archived asset repeatedly instead of promoting it

## Expected agent outputs

When the user asks for experiment management help, the agent should usually return:

- a short landscape summary
- a ranked contrast shortlist
- the predicted outcome for each shortlisted contrast
- the minimum controls required for clean interpretation
- the expected belief update under each possible outcome

If the tracker is large, also return:

- what remains in the active set
- what was demoted to reference
- what was archived out of the default read path

If archive recall happened, also return:

- the recall trigger
- the archive cluster(s) consulted
- the extracted reusable asset
- whether it changed the next contrast or only confirmed it

If asked to create files, generate the templates first and adapt them to the project's domain language.
