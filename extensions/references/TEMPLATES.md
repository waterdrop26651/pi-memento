# Memento Templates

Use these as starter files for controlled research memory. Adapt metric columns
and config axes to the project.

For small projects, the three core files may be enough. For medium or large
projects, add the layered files below so a fresh agent does not need to read the
full ledger by default.

## `CURRENT_STATE.md`

```md
# Current State

Last updated: YYYY-MM-DD

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
```

Rules:

- Keep it short.
- Prefer current decisions over historical narrative.
- Link to the full ledger only when needed.

## `ACTIVE_TRACKER.csv`

```csv
entry_id,kind,status,question_id,hypothesis_id,source_id,role,current_gradient,why_it_still_matters,next_action
```

Example:

```csv
baseline_seed,run,active,Q_A,H_A,e2v_seed,baseline,high,Current benchmark row for all A11 comparisons,Keep fixed
a11a_full,run,active,Q_A,H_A,a11a_full_ser_finetune,current_best_treatment,high,Best completed SAE-guided small model and current reference point,Use as baseline for A11b
a10,contrast,reference,Q_A,H_A,A10,supporting_evidence,medium,Justifies carrier score as a structural prior,Keep as justification only
a03,contrast,archived,Q_A,H_A,A03,old_diagnostic,low,Explained TopK bank collapse but no longer changes A11 decisions,Leave in full ledger only
```

Rules:

- `source_id` points to a run or contrast in the full ledger.
- `current_gradient` can be `high`, `medium`, or `low`.
- Only `active` and a small number of `reference` entries should remain here.

## `EVIDENCE_LOG.md`

```md
# Evidence Log

## Claim: ...

- Supporting evidence:
  - ...
- Caveat:
  - ...
- What would overturn this:
  - ...
```

Rules:

- Compress to the few points that still matter.
- Do not turn this into another run log.

## `ARCHIVE_INDEX.md`

```md
# Archive Index

## ARCHIVE_CLUSTER_ID

- Topic:
- Archive reason:
- Recall triggers:
- Likely treasure:
- Recall value: `dead_end | reference_finding | snapshot`
- Trust level:
- Open first:
```

Rules:

- Keep each cluster short enough to scan quickly.
- Index by problem/question, not only by date.
- `Open first` should point to 1-3 files, not the whole directory.

## Archive card

```md
# ARCHIVE_CLUSTER_ID

- Topic:
- Answered question:
- Why archived:
- What may still be reusable:
- Recall when:
- Open first:
- Avoid misreading as:
```

Rules:

- One card per archive cluster.
- Make the reusable value explicit.
- Say what this cluster does *not* justify.

## `RECALL_NOTES/YYYY-MM-DD_<topic>.md`

```md
# Recall Note

- Trigger:
- Archive cluster:
- Files read:
- Extracted asset:
- Did the active plan change:
- Promoted into hot path:
```

Rules:

- Only write when recall materially informs the next step.
- Keep the note short and decision-oriented.

## Promoted finding snippet

Use this shape when moving an archive result back into the hot path:

```md
Promoted finding:

- Source archive cluster:
- Reused asset:
- Why it is active again:
- Where it now lives:
```

## `runs.csv`

```csv
run_id,status,date,run_dir,config_path,question_id,hypothesis_id,contrast_id,role,changed_axis,model_family,dataset,split,layer_or_stage,capacity,sparsity_or_topk,seed,steps,primary_metric,secondary_metric,diagnostic_metric_1,diagnostic_metric_2,quality_flags,notes
```

Example:

```csv
v1_baseline,completed,2026-05-27,exp/v1_baseline,configs/v1_baseline.yaml,Q01,H01,C01,baseline,none,sae,dataset_a,val,L24,4096,32,0,5000,0.341,0.287,0.021,0.004,heldout_eval,
v1_capacity8192,completed,2026-05-28,exp/v1_capacity8192,configs/v1_capacity8192.yaml,Q01,H01,C01,treatment,capacity,sae,dataset_a,val,L24,8192,32,0,5000,0.357,0.301,0.029,0.006,heldout_eval,
```

Rules:

- `role` should usually be `baseline`, `treatment`, `control`, or `diagnostic`.
- `changed_axis` can be duplicated here for readability, but the authoritative contrast definition belongs in `contrasts.csv`.
- `quality_flags` should be a semicolon-delimited list.

## `contrasts.csv`

```csv
contrast_id,question_id,hypothesis_id,status,priority,baseline_runs,treatment_runs,control_runs,changed_axis,controlled_axes,prediction_direction,predicted_min_delta,predicted_reason,actual_delta,actual_result,info_gain,belief_update,next_action,risk,decision
```

Example:

```csv
C01,Q01,H01,recorded,P0,v1_baseline,v1_capacity8192,,capacity,dataset;split;layer_or_stage;sparsity_or_topk;seed;steps,increase,primary_metric +0.01,Higher capacity should help only if it creates more clean features.,primary_metric +0.016; diagnostic_metric_1 +0.008,Primary metric improved and diagnostics moved in the same direction.,high,Capacity looks promising only when diagnostic signals also improve.,Run capacity x seed replication with matched controls.,moderate,advance
C02,Q01,H01,planned,P1,v1_baseline,v1_new_loss,,loss_family,dataset;split;layer_or_stage;capacity;sparsity_or_topk;seed;steps,increase,primary_metric +0.01,Loss change should improve representation quality without changing capacity.,,,medium,,Prepare config and matching seed plan.,moderate,planned
```

Rules:

- Create the row before the run when possible.
- `predicted_min_delta` should define what counts as meaningful movement.
- `actual_result` is an observation; `belief_update` is the interpretation.
- If the control is dirty, set `decision` to `inconclusive`.

## `hypotheses.md`

```md
# Project Hypotheses

## H01: Capacity helps only if it increases clean task-relevant features

Current belief: medium

Evidence:
- Baseline capacity reaches acceptable reconstruction but weak task selectivity.
- Prior runs suggest reconstruction alone does not predict downstream utility.

Risk:
- Capacity may improve the primary metric for unrelated reasons such as easier optimization.

Next most informative contrast:
- Match all settings and compare 4096 vs 8192 capacity with held-out evaluation and seed replication.

Update rule:
- If capacity improves the primary metric and the clean-feature diagnostics, strengthen the hypothesis.
- If capacity improves reconstruction only, weaken the hypothesis and deprioritize more scaling.
```

## Landscape summary template

Use this shape in agent responses:

```md
## Landscape

- Active question: ...
- Strongest current hypothesis: ...
- Highest-trust evidence: ...
- Main confound or risk: ...

## Next contrasts

1. `Cxx`: what changes, what stays controlled, expected gradient, why it matters
2. `Cyy`: what changes, what stays controlled, expected gradient, why it matters

## Belief updates

- Hypothesis `Hxx`: how recent results changed confidence
```

## Oversized-tracker refactor template

Use this when shrinking an existing tracker:

```md
## Active set

- keep:
  - ...
- demote to reference:
  - ...
- archive from default path:
  - ...

## Why

- ...

## New default read order

1. `CURRENT_STATE.md`
2. `ACTIVE_TRACKER.*`
3. `EVIDENCE_LOG.md`
4. full ledger only if needed
```

## Archive-recall summary template

Use this in agent responses when recall happens:

```md
## Archive recall

- Trigger: ...
- Cluster consulted: ...
- Files opened: ...
- Reusable asset found: ...
- Plan impact: ...
- Promoted finding: yes / no
```
