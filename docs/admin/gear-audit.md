# Gear Audit (SKeyDB vs MotherTree — full table)

Compare **entire** SKeyDB gear catalogs against MotherTree `posse_tag_manifestation`, `wheel_tag_manifestation`, and `covenant_tag_manifestation`. **Audit-only** — no `verified` column on gear tables; findings guide manual fixes in admin UI.

## Quick start

```bash
# 1. Export full-table packs (SKeyDB @ latest main + live Supabase)
npm run gear:export

# 2. Deterministic audit (coverage, structural, heuristics)
npm run gear:audit

# Single table
npm run gear:export -- --kind wheel
npm run gear:audit -- --kind wheel

# Pin SKeyDB commit instead of latest main
npm run gear:export -- --skeydb-sha 3b6685364d7d21ba564ada281e0f9a28c64eef6a
```

Exit code: `gear:audit` exits **1** when `definite` or `suspicious` findings remain.

Optional **agent semantic pass** (after deterministic audit) — one agent per table; prompts in [Prompt templates](#optional-agent-semantic-pass).

## Architecture

```text
npm run gear:export
  → sample-data/gear-audit/{posse,wheel,covenant}/full.skeydb.json
  → sample-data/gear-audit/{posse,wheel,covenant}/full.mothertree.json

npm run gear:audit
  → sample-data/gear-audit/{posse,wheel,covenant}/full.findings.json

(Optional) Agent × 3 — semantic review of needs_review + descriptionTemplate parsing
```

Run **posse**, **wheel**, and **covenant** in parallel — no cross-table dependencies.

| Component      | Path                                                                                 |
| -------------- | ------------------------------------------------------------------------------------ |
| Export script  | [`scripts/export-gear-audit-pack.ts`](../../scripts/export-gear-audit-pack.ts)       |
| Audit script   | [`scripts/audit-gear-manifestations.ts`](../../scripts/audit-gear-manifestations.ts) |
| Audit logic    | [`src/lib/gear-audit/audit-run.ts`](../../src/lib/gear-audit/audit-run.ts)           |
| Finding schema | [`src/lib/gear-audit/finding-schema.ts`](../../src/lib/gear-audit/finding-schema.ts) |
| Agent prompts  | [`src/lib/gear-audit/cursor-prompt.ts`](../../src/lib/gear-audit/cursor-prompt.ts)   |
| Agent skill    | [`.github/skills/gear-audit/SKILL.md`](../../.github/skills/gear-audit/SKILL.md)     |

## File layout

Gitignored under `sample-data/gear-audit/`:

| File                          | Writer        | Contents                                                |
| ----------------------------- | ------------- | ------------------------------------------------------- |
| `{kind}/full.skeydb.json`     | `gear:export` | SKeyDB catalog + all records at chosen commit           |
| `{kind}/full.mothertree.json` | `gear:export` | All parents + manifestations + tag/realm/awakener joins |
| `{kind}/full.findings.json`   | `gear:audit`  | Full-table deterministic findings + stats               |

## Deterministic checks (script)

### All kinds

| Check                                           | Severity   | Category            |
| ----------------------------------------------- | ---------- | ------------------- |
| SKeyDB parent missing in MotherTree             | definite   | `missing_in_db`     |
| MotherTree parent missing in SKeyDB             | suspicious | `missing_in_skeydb` |
| SKeyDB has effect text, zero MT rows            | suspicious | `missing_in_db`     |
| Manifestation references deleted/missing parent | definite   | `orphan_parent`     |
| Duplicate logical key per parent                | definite   | `duplicate_row`     |

Wheel duplicate key: `wheel_id` + tag name + `required_realm` + `trigger_condition` + `value_scalar` + `target_type` + `buff_target_type_restriction`. Rows that differ only in `metadata` (e.g. assumption notes) may still match.

### Wheel

| Check                                          | Severity   | Category                  |
| ---------------------------------------------- | ---------- | ------------------------- |
| `rarity` mismatch vs SKeyDB catalog            | definite   | `rarity_mismatch`         |
| `stat` mismatch vs SKeyDB `mainstatKey`        | definite   | `parent_stat_mismatch`    |
| Fractional non-percent, null `dependency_stat` | suspicious | `dependency_stat_missing` |

Skipped from audit (intentional): rarity **N/R**, and named wheels in `audit-exclusions.ts`.

### Covenant

| Check                                                                 | Severity   | Category                  |
| --------------------------------------------------------------------- | ---------- | ------------------------- |
| Row count < SKeyDB `setEffects` minus 1 (first set → `covenant.stat`) | suspicious | `structural_error`        |
| Broken `replaces_manifestation_id` chain                              | definite   | `replacement_chain_error` |
| Fractional non-percent, null `dependency_stat`                        | suspicious | `dependency_stat_missing` |

### Posse

| Check                                             | Severity   | Category                     |
| ------------------------------------------------- | ---------- | ---------------------------- |
| Non-null `dependency_stat` (except `team_max_hp`) | suspicious | `dependency_stat_unexpected` |

Skipped from audit: `Primordial Memory: *` (see `audit-exclusions.ts`).

Semantic checks (tag mapping from `descriptionTemplate`, trigger conditions, exact scalars from args) are **not** fully automated — use the optional agent pass.

## Finding report shape

```json
{
  "schemaVersion": 1,
  "scope": "full_table",
  "auditKind": "wheel",
  "skeydbCommit": "abc123…",
  "auditedAt": "2026-08-31T04:00:00.000Z",
  "stats": {
    "skeydbParentCount": 140,
    "mothertreeParentCount": 138,
    "mothertreeAliveParentCount": 138,
    "manifestationCount": 520,
    "matchedParents": 135,
    "missingInDb": 5,
    "missingInSkeydb": 3
  },
  "findings": ["…"],
  "summary": { "definite": 2, "suspicious": 8, "needsReview": 0 }
}
```

Severity: `definite` | `suspicious` | `needs_review`.

Full category lists: [`finding-schema.ts`](../../src/lib/gear-audit/finding-schema.ts).

## Optional agent semantic pass

Run **after** `gear:audit`. One new Agent chat per table. Agents read the full packs + existing findings; add semantic findings only.

Generate prompts programmatically:

```typescript
import { buildWheelGearAuditPrompt } from "@/lib/gear-audit/cursor-prompt";

buildWheelGearAuditPrompt({ auditKind: "wheel" });
// also: buildPosseGearAuditPrompt, buildCovenantGearAuditPrompt
```

### Posse (full table)

```text
Posse — Gear Audit (full table): semantic review after deterministic pass.

Use the MotherTree Gear Audit skill.
Scope: full_table
…
Prerequisite: npm run gear:export && npm run gear:audit

Focus: parse descriptionTemplate → tags, group_key tiers, awakener/realm gates.
Do NOT re-emit script findings. Report new finding counts only.
```

### Wheel / Covenant

Same pattern — see [`cursor-prompt.ts`](../../src/lib/gear-audit/cursor-prompt.ts).

## Shared encoding rules (agent + future script)

Reuse Kit Reader conventions where SKeyDB uses `descriptionArgs`:

- **Percent stat scaling:** `value_scalar = N / 100`, `dependency_stat = atk|def|con` — [kit-reader.md § SKeyDB arg scaling](kit-reader.md#skeydb-arg-scaling-resolvedargmeta)
- **Tags:** [`flavor-tag-synonyms.ts`](../../src/lib/kit-reader/flavor-tag-synonyms.ts) — never invent tag names
- **Posse `dependency_stat`:** runtime scales `team_max_hp` only; other non-null values are ignored and usually wrong

## SKeyDB source

- Default commit: **latest `main`** on `dansa/SKeyDB` (via GitHub API)
- Override: `--skeydb-sha`
- Record paths: `src/data/public-v3/catalogs/{posses,wheels,covenants}.json` + `src/data/public-v3/records/{posses,wheels,covenants}/{id}.json`

## Operator workflow

1. `npm run gear:export` — refresh packs against current SKeyDB + live DB
2. `npm run gear:audit` — deterministic findings
3. Fix `definite` / `suspicious` items in admin UI
4. (Optional) Run agent semantic pass per table for remaining ambiguity
5. Re-export + re-audit until clean
