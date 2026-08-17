---
name: kit-reader
description: >-
  Propose MotherTree ATM + local-interaction rows from an exported SKeyDB kit
  pack, then insert them as pending (verified=false) via the Kit Reader CLI.
  Use when the user pastes a Kit Reader Cursor prompt, mentions kit-reader,
  sample-data/kit-reader, insert-kit-pending, or asks to read an awakener kit
  into pending ATMs.
---

# MotherTree Kit Reader

## Locked rules

- Cursor-assisted only — do **not** call in-app LLMs or ask for provider API keys.
- Write path = **validated insert CLI only**. Never invent an admin JSON import UI.
- Every inserted ATM must be **`verified = false`**. The CLI forces this; never set verified true.
- One awakener per run. Clear pending (verify or soft-delete) before a new batch — CLI aborts if pending exist; **no `--force`**.
- Locals inherit pending/live from parent ATM (no separate verified column).
- Prefer existing MotherTree tags only (`lexicon.tags`). Never invent `tag_name`s.

## Required reading

1. The exported kit pack path from the prompt (usually `sample-data/kit-reader/{slug}.kit.json`)
2. [`docs/admin/kit-reader.md`](docs/admin/kit-reader.md)
3. [`docs/admin/atm-and-local-interaction-inputs.md`](docs/admin/atm-and-local-interaction-inputs.md)
4. [`src/lib/kit-reader/proposal-schema.ts`](src/lib/kit-reader/proposal-schema.ts)
5. [`src/lib/kit-reader/atm-metadata.ts`](src/lib/kit-reader/atm-metadata.ts) — `buildAtmMetadata` / `detectIsAccumulating`
6. [`src/lib/kit-reader/proposal-heuristics.ts`](src/lib/kit-reader/proposal-heuristics.ts) — enjoy detection, aoe tag prefixes

## Workflow

1. Read the kit pack: `assumptions`, skills (base + upgrades), derivedCards, talents (`atmEligible`), `ignoreList`, `lexicon.tags`, `lexicon.flavorTagSynonyms`, **`lexicon.aoeTagPrefixes`**, **`sourceLabel` / layer `sourceLabelHint`**, **`cost`**, layer **`hasEnjoyClause`**.
2. Propose ATM + local rows for Path Carver math.
3. Write proposal JSON to `sample-data/kit-reader/{slug}.proposal.json` (`schemaVersion: 1`).
4. Run:

```bash
npx tsx --env-file=.env.local scripts/insert-kit-pending.ts sample-data/kit-reader/{slug}.proposal.json
```

5. Summarize inserted vs skipped (`needs_review` / `unsupported`) vs failed. Do **not** hand the user JSON to paste into admin.

## Metadata (mandatory)

Do **not** put the skill/talent display name in as the source prefix (except Strike/Defense/cost-collision fallbacks already computed in the pack).

```text
metadata = "{sourceLabel} {effectLabel}" [+ " E1"|" E2"|" E3"]
```

- **`sourceLabel`:** use pack skill/talent `sourceLabel`, or upgrade layer `sourceLabelHint` (AbsoluteAxiom → `AA`).
- **`effectLabel`:** `tagName` with leading `Attacker.` / `Support.` / `Defender.` / `Special.` / `When.` stripped (`Attacker.Active Damage` → `Active Damage`). Prefer `buildAtmMetadata` from `atm-metadata.ts`.
- **E-suffix:** only when `requiredEnlightenment` is 1 / 2 / 3. Never append OE/AA again when source is already `OE` / `AA`.

Examples: `0 Cost Active Damage`, `0 Cost Active Damage E2`, `Exalt Active Damage`, `OE STR Up`, `Talent …`, `SF …`, `Rouse …`, `AA …`, `Strike …`, `Defense …`.

## isAccumulating

Set `isAccumulating: true` when the kit quote is an every-turn effect — typically **“at turn start”** / **“at turn end”** (use `detectIsAccumulating`). Otherwise `false`.

## Enjoy → unique_scaling

When kit text has **enjoy / enjoys / enjoying** (`hasEnjoyClause: true` on pack layers, or `detectEnjoyClause`):

- Attach a **local** on the **subject** ATM (Active Damage / Exalt damage / Strike in that clause).
- Do **not** create a separate Support ATM for the modifier tag.
- `mode: unique_scaling`, `modifierTagName` = modifier **root** (e.g. `Support.Tentacle Damage Up`, not `.Fixed`).
- `valueScalar` = percent as factor (`50%` → `0.5`; use `parseEnjoyPercentFactor` or manual parse).
- Default `mathOperation: multiply_one_plus`, `targetType: aoe`.
- **Not** aftereffect; flat grants stay as ATMs.
- Ambiguous → `needs_review`.

Examples: Caecus *"enjoying a 50% Tentacle DMG bonus"*; `"24"` Rouse realm lines *"enjoys a … bonus"*.

## Always-aoe tags

When ATM `tagName` matches any prefix in `lexicon.aoeTagPrefixes` (includes subtags like `Support.STR Up.Fixed`), set `targetType: "aoe"`. Use `defaultTargetTypeForTag` / `isAoeTagPrefix`. Insert CLI forces aoe if Agent omits.

## Tag resolution

- Resolve via pack `lexicon.flavorTagSynonyms` (longest / most specific key, case-insensitive).
- Prefer `*.Fixed` when both parent and Fixed exist — **except** the `Attacker.Active Damage` tree (rarely fixed). Default Deal DMG → `Attacker.Active Damage`; use Fixed / Max HP only when kit text says so.
- Ambiguous / unmapped → `status: "needs_review"` (or `unsupported` for ignore-list). Never guess a new tag string.
- Dependency wording (Aliemus Regen Level, etc.) → `dependencyStat`, not a Support tag, when that is the ATM/local pattern.

## Ignore list (never propose as `ok`)

- Gnostic Potential
- Madness Omen
- Dimensional Image
- Soulforge boilerplate only: Astral Reign-only line; CON/ATK/DEF +N%; Keyflare on first Rouse
- Do propose remaining kit-specific Soulforge lines (`sourceLayer: "soulforge_kit"`, metadata source `SF`)

## Layers / enlightenment

- Skill **base** → `requiredEnlightenment` from pack (`defaultRequiredEnlightenment`; Over Exalt = **7** / OE).
- Enlighten upgrades: E1/E2/E3 → 1 / 2 / 3; **`AbsoluteAxiom` → 15 (AA)** — use layer `sourceLabelHint: "AA"`, not Rouse.
- Judge **replace vs add** (`replacesClientKey` vs new row).
- Use `replacesClientKey` only (never raw DB ids). Insert CLI two-pass resolves to `replaces_manifestation_id`.

## Slot → `sourceType`

Use pack `sourceTypeHint`: Strike/Defense/Skill1/Skill2/derived → `command card`; Rouse → `rouse`; Exalt/OverExalt → `exalt`; talents → `talent`. Do not map slot alone to `tentacle`.

## Proposal status

| Status | Insert? |
|--------|---------|
| `ok` | Yes (pending) |
| `needs_review` | No |
| `unsupported` | No |

## Locals

Follow `admin-local-interaction` rules: `unique_scaling` needs modifier tag **or** dependencyStat (target null); `aftereffect` needs target tag, modifier null, op `multiply` | `add_scaled`. Kit Reader **enjoy** heuristic → unique_scaling on subject (see above); not a modifier ATM grant.
