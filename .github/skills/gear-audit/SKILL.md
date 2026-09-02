---
name: gear-audit
description: >-
  Full-table compare of SKeyDB gear records to MotherTree posse_tag_manifestation,
  wheel_tag_manifestation, or covenant_tag_manifestation. Use after gear:export
  and gear:audit, when the user pastes a Gear Audit prompt, mentions gear-audit,
  sample-data/gear-audit, or asks to audit posse/wheel/covenant manifestations
  against SKeyDB at scale.
---

# MotherTree Gear Audit

## Locked rules

- **Audit-only** — do **not** insert, update, or soft-delete database rows.
- Do **not** write ad-hoc patch scripts (`scripts/apply-*.ts`, `scripts/patch-*.ts`).
- **Full-table scope:** read `full.skeydb.json`, `full.mothertree.json`, and `full.findings.json` for the prompt's `auditKind` only.
- Do **not** read other kinds' packs under `sample-data/gear-audit/`.
- Deterministic script (`npm run gear:audit`) runs first — agents add **semantic** findings only; do not duplicate definite/suspicious script findings.
- Prefer existing MotherTree tags only (`tagsById` in mothertree pack). Never invent `tag_name`s.

## Required reading

All paths below are repo-root-relative — read each from the workspace root.

1. Full pack paths from the prompt (`sample-data/gear-audit/{kind}/full.*.json`)
2. `docs/admin/gear-audit.md`
3. `src/lib/gear-audit/finding-schema.ts`
4. For tag / scalar encoding: `docs/admin/kit-reader.md` (§ SKeyDB arg scaling)
5. `src/lib/kit-reader/flavor-tag-synonyms.ts`

## Workflow (agent semantic pass)

1. Confirm `full.findings.json` exists (operator ran `gear:export` + `gear:audit`).
2. Read full SKeyDB + MotherTree packs for the target kind.
3. For each matched parent, parse SKeyDB `descriptionTemplate` / `descriptionArgs` / `setEffects` → expected manifestations.
4. Compare against MotherTree rows; emit **new** findings only.
5. Write appended findings to `full.agent-findings.json` OR merge into `full.findings.json` preserving existing ids.
6. Chat report: new finding counts by severity + blockers only.

## What the script already checked

Do **not** re-report unless you disagree with rationale:

- Parent name coverage (missing_in_db / missing_in_skeydb)
- Zero manifestation rows when SKeyDB has effect text
- Wheel rarity / mainstatKey vs parent row
- Covenant replacement chain FK integrity
- Duplicate logical keys
- Orphan manifestations
- Posse non-null dependency_stat
- Wheel/covenant dependency_stat_missing (fractional non-percent heuristic)
- Wheel tier / covenant set count heuristics

## Semantic checks (agent responsibility)

| Kind     | Focus                                                                                   |
| -------- | --------------------------------------------------------------------------------------- |
| Posse    | `group_key` tiers, `required_awakener`, `required_realm`, tag from descriptionTemplate  |
| Wheel    | Graded `descriptionArgs` → realm/enlightenment rows, `trigger_condition`, exact scalars |
| Covenant | `setEffects[]` → rows + `replaces_manifestation_id`, dual realm gates, triggers         |

When alignment is ambiguous → `needs_review` with rationale.

## Posse runtime note

`posse_tag_manifestation` scales **`team_max_hp` only**; other non-null `dependency_stat` values are ignored at runtime and are usually mistakes.

## Output (chat)

```text
Gear audit semantic pass — wheel (full_table)
New findings: definite=0 suspicious=3 needs_review=12
Written: sample-data/gear-audit/wheel/full.agent-findings.json
```

Do **not** paste full finding arrays or row dumps.
