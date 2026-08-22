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
- Never write or generate ad-hoc one-time patch/update scripts (`scripts/apply-*.ts`, `scripts/patch-*.ts`). All updates must be made via proposal JSON with `insert-kit-pending.ts --patch` / `--append`, or via the Kit Reader UI (`/kit-reader`).
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
6. [`src/lib/kit-reader/proposal-heuristics.ts`](src/lib/kit-reader/proposal-heuristics.ts) — enjoy detection, Steal STR pairing, **Devour copy provider group**, Tentacle DMG dual locals, aoe tag prefixes, **percent vs linear dependency_stat helpers**

## Workflow

1. Read the kit pack: `assumptions`, skills (base + upgrades), derivedCards, **`enlightens`** (standalone E1/E2/etc.), talents (`atmEligible`), `ignoreList`, `lexicon.tags`, `lexicon.flavorTagSynonyms`, **`lexicon.aoeTagPrefixes`**, **`lexicon.percentDependencyStats`**, **`lexicon.enjoyTentacleDmgModifierTagNames`**, **`lexicon.stealStrTagNames`**, **`lexicon.devourCopyProviderGroupName`**, **`sourceLabel` / layer `sourceLabelHint`**, **`cost`**, layer **`resolvedArgs` + `resolvedArgMeta`**, layer **`hasEnjoyClause`** / **`hasEnjoyTentacleDmgClause`** / **`hasStealClause`** / **`hasDevourClause`**.
2. Propose ATM + local rows for Path Carver math.
3. Write sparse proposal JSON to `sample-data/kit-reader/{slug}.proposal.json` (`schemaVersion: 1`).
   - **Write Sparse JSON:** Omit default values (`status: "ok"`, `instanceCount: 1`, `baseCopies: 1`, `locals: []`, `dependencyStat: null`, `isAccumulating: false`, `isPermanent: false`, etc.).
   - **Omit `sourceQuote` and redundant metadata:** The insert CLI resolves metadata and context from `sourceKitId` and `tagName`.
   - **Omit ignore-listed items:** Do not output JSON entries for Gnostic Potential, Madness Omen, or Soulforge boilerplate.
4. Run:

```bash
npx tsx --env-file=.env.local scripts/insert-kit-pending.ts sample-data/kit-reader/{slug}.proposal.json
```

Pass `--append` or `--patch` if appending/updating rows in an existing pending batch.
5. Summarize inserted vs skipped (`needs_review`) vs failed. Do **not** hand the user JSON to paste into admin. For minor row adjustments, guide the user to the Kit Reader UI (`/kit-reader`).

## Metadata (mandatory)

> **`.Fixed` split:** `tagName` uses `.Fixed` when synonyms allow it. **Never** put `.Fixed` in inserted metadata — the insert CLI builds metadata via `buildAtmMetadata` from the kit pack `sourceLabel` + `tagName`. Use `metadataSuffix` / `metadataOverride` in the proposal only for deliberate custom labels.

Do **not** put the skill/talent display name in as the source prefix (except Strike/Defense/cost-collision fallbacks already computed in the pack).

```text
metadata = "{sourceLabel} {effectLabel}" [+ " E1"|" E2"|" E3"]
```

Devour-bracketed effects (`copyProviderGroupName: "2x Devour"`):

```text
metadata = "{sourceLabel} Devour {effectLabel}" [+ " E1"|" E2"|" E3"]
```

- **`sourceLabel`:** resolved from kit pack via `sourceKitId` at insert (skill `sourceLabel`, upgrade `sourceLabelHint`, standalone enlighten `sourceLabel`, talent `Talent`/`SF`). Optional proposal `sourceLabel` only when pack lookup fails.
- **`effectLabel`:** `tagName` with leading `Attacker.` / `Support.` / `Defender.` / `Special.` / `When.` stripped, then trailing `.Fixed` removed (`Defender.Shield.Fixed` → `Shield`; `Attacker.Active Damage` → `Active Damage`).
- **E-suffix:** only when `requiredEnlightenment` is 1 / 2 / 3. Never append OE/AA again when source is already `OE` / `AA`.
- **Proposal `metadata` field:** documentation-only; insert CLI ignores it. Use `metadataSuffix` (appended to canonical, e.g. `+ SF` on **Talent** rows) or `metadataOverride` (full custom label, e.g. `OE Heal *3`) when the formula is not enough. Do **not** set `metadataSuffix: "+ SF"` when pack `sourceLabel` is already `SF` — insert skips redundant suffixes.

| `tagName` (DB) | Inserted metadata |
| --- | --- |
| `Defender.Shield.Fixed` | `{sourceLabel} Shield` |
| `Defender.Heal.Fixed` | `{sourceLabel} Heal` |
| `Support.Tentacle Damage Up.Fixed` | `{sourceLabel} Tentacle Damage Up` |
| `Support.STR Up.Fixed` | `{sourceLabel} STR Up` |
| `Attacker.Active Damage` | `{sourceLabel} Active Damage` (no `.Fixed` on this tree) |

Examples: `0 Cost Active Damage`, `0 Cost Active Damage E2`, `Exalt Active Damage`, `OE STR Up`, `Talent Tentacle Damage Up + SF`, `AA Tentacle Damage Up`, `Strike …`, `Defense …`.

## isAccumulating

Set `isAccumulating: true` when the kit quote is an every-turn effect — typically **“at turn start”** / **“at turn end”** (use `detectIsAccumulating`). Otherwise `false`.

## Enjoy → unique_scaling

When kit text has **enjoy / enjoys / enjoying** (`hasEnjoyClause: true` on pack layers, or `detectEnjoyClause`):

- Attach a **local** on the **subject** ATM (Active Damage / Exalt damage / Strike in that clause).
- Do **not** create a separate Support ATM for the modifier tag.
- `mode: unique_scaling`, `modifierTagName` = modifier **root** (not `.Fixed`).
- `valueScalar` = percent as factor (`50%` → `0.5`; use `parseEnjoyPercentFactor` or manual parse).
- Default `mathOperation: multiply_one_plus`, `targetType: self`.
- **Not** aftereffect; flat grants stay as ATMs.
- Ambiguous → `needs_review`.

**Tentacle DMG exception** (`hasEnjoyTentacleDmgClause` / `detectEnjoyTentacleDmgClause`): when enjoy is followed in the same clause by **Tentacle DMG** or **Tentacle Damage**, attach **two** locals with the **same** fields except `modifierTagName` — `Support.Tentacle Damage Up` **and** `Support.Unique Tentacle Damage Up` (Unique is a sibling, not a TDU prefix child). Both: `add_scaled`, `valueScalar` from the percent, `targetType: self`, `layer: add`. Use pack `lexicon.enjoyTentacleDmgModifierTagNames`. Do **not** dual-tag Counter / STR enjoy.

Examples: Caecus *"enjoying a 50% Tentacle DMG bonus"* → both TDU locals `add_scaled` `0.5`; `"24"` Aequor *"enjoys a 75% Tentacle DMG bonus"* → same pair at `0.75`; other `"24"` Rouse realm lines stay a single unique_scaling.

## Direct modifier → local direct_modifier

When kit text grants **card-specific or record-specific self-contained buffs** (e.g. *Temporary Enhance on specific cards in hand*, *this card gains +N% Crit DMG*, or other intrinsic card multipliers that must not broadcast to all cards of that awakener):

- Attach a **local** on the **subject** ATM with `mode: direct_modifier`.
- Do **not** create a global Support ATM (which would pollute the global tag pool and apply to all skills).
- `modifierTagName` = semantic tag (e.g. `Support.Enhance`, `Support.Crit Damage`), `targetTagName: null`.
- `valueScalar` = the direct bonus scalar (e.g. `50 stacks of Temporary Enhance` / `+50%` → `0.5`).
- Default `mathOperation: multiply_one_plus` (or `add_scaled`), `targetType: self`.
- Layer is resolved from the semantic tag (e.g. `Support.Enhance` → `add`) or explicit `layer`.

Example: Helot: Catena AA *"grant each unique 'Helot: Catena' Command Card in hand 50 stacks of Temporary Enhance"* → attach `mode: direct_modifier`, `modifierTagName: "Support.Enhance"`, `valueScalar: 0.5`, `mathOperation: "multiply_one_plus"`, `targetType: "self"` to the affected Command Card damage ATMs.

## Steal → STR Down + STR Up

When kit text has **`{Steal}`** / **Steal** + **STR** (`hasStealClause: true` on pack layers, or `detectStealClause`):

- Propose **two** `status: ok` ATMs (not locals): `Defender.STR Down` (enemy, `aoe`) **and** `Support.STR Up.Fixed` (self gain, `aoe`).
- **Identical** `valueScalar`, `dependencyStat`, `requiredEnlightenment`, `isPermanent`, `sourceType`, `sourceKitId`, `sourceQuote`, `metadataSuffix`.
- Flat `Steal N STR` → `valueScalar = N / 100` (`parseStealStrScalar`). `Steal STR equal to N% of ATK` → `N / 100` + `dependencyStat: atk`.
- **`[Power:Arg]` is not flat Steal** — use `resolvedArgMeta` (see SKeyDB arg scaling below).
- Client keys: `*-str-down` + `*-str-up`.
- **Not** Steal: plain `reduce … STR` / Exhaustion without Steal; `STR Reduction effect +N%` → `Support.Increase Gain.STR Down` only.
- Ambiguous amount → `needs_review`. Insert CLI warns when STR Down lacks matching STR Up in the same batch.

Examples (Faint): Rouse per-card `{Steal} 10 {STR}` → both at `0.1`; AA permanent Steal 25 → both at `0.25`, `isPermanent: true`; SF Steal 10% ATK → both at `0.1`, `dependencyStat: atk`.

## Devour → 2x Devour copy provider group

When kit text has **`[{Devour}: …]`** or **`{Devour}`** (`hasDevourClause: true` on pack layers, or `detectDevourClause`):

- Set **`copyProviderGroupName: "2x Devour"`** (`copy_provider_group_id: 7` at insert).
- Set **`triggerConditionTagName: null`** — never `Special.When.Devour` or `Special.Cause.Devour`.
- Insert CLI metadata includes **`Devour`**: `{sourceLabel} Devour {effectLabel}[ E#]` (e.g. `Exalt Devour Hand Size`).

Example (Helot Surviving Impasse): `[{Devour}: Draw 3 "Strike" cards, …]` → `Support.Draw.Command Card.Strike`, `copyProviderGroupName: "2x Devour"`, `triggerConditionTagName: null`, metadata `Exalt Devour Draw.Command Card.Strike`.

Insert CLI warns when Devour rows use When/Cause triggers or omit the copy provider group.

## Lemurian synergy → four ATMs

When kit text matches Lemurian team synergy (`detectLemurianSynergyClause` — e.g. *“1/2/3 other Lemurian Awakeners … DMG Amplification +20%/50%/100%”*):

- Propose **four** `status: ok` ATMs (not locals, not one flat AMP row).
- Row 1: `Special.Cause.Lemurian`, `valueScalar: 1`, `triggerConditionTagName: null`, `isPermanent: true`, `metadataOverride: "Lemurian"`.
- Rows 2–4: `Support.Damage AMP`, `targetType: "aoe"`, with `triggerConditionTagName` = `Special.When.Lemurian Synergy 1|2|3` and scalars from `parseLemurianSynergyTiers` (default `0.2` / `0.5` / `1.0`).
- **Client keys:** `lemurian-marker`, `lemurian-synergy-1`, `lemurian-synergy-2`, `lemurian-synergy-3`.
- **`sourceType`:** usually `talent`. Engine applies **one** tier When gate per team size — do not stack all three AMP rows on one awakener.
- Ambiguous tiers → `needs_review`.

See [`docs/admin/kit-reader.md`](docs/admin/kit-reader.md#lemurian-synergy) and [`lemurian-synergy.ts`](src/lib/path-carver/lemurian-synergy.ts).

## Always-aoe tags (ATM only)

When **ATM** `tagName` matches any prefix in `lexicon.aoeTagPrefixes` (includes subtags like `Support.STR Up.Fixed`), set ATM `targetType: "aoe"`. Use `defaultTargetTypeForTag` / `isAoeTagPrefix`. Insert CLI forces aoe on the ATM if Agent omits. **Does not apply to unique_scaling locals** — those always use `targetType: self`.

## Tag resolution

- Resolve via pack `lexicon.flavorTagSynonyms` (longest / most specific key, case-insensitive).
- Prefer `*.Fixed` when both parent and Fixed exist — **except** the `Attacker.Active Damage` tree (rarely fixed). Default Deal DMG → `Attacker.Active Damage`; use Fixed / Max HP only when kit text says so.
- Ambiguous / unmapped → `status: "needs_review"` (or `unsupported` for ignore-list). Never guess a new tag string.
- Dependency wording (Aliemus Regen Level, etc.) → `dependencyStat`, not a Support tag, when that is the ATM/local pattern.
- **Percent vs linear `dependencyStat`:** kit says **“every 1%”** of DR / Damage AMP / Crit Rate / etc. (see pack `lexicon.percentDependencyStats`) → `valueScalarPerPercentPointOfPercentDep(R)` (`R/10000`). Kit says **“every 1”** RM / level / flat unit → `valueScalarPerUnitLinearDep(R)` (`R/100`). **Do not** copy Casiah RM `0.002` onto `death_resist`. Use `previewAtmEffectiveScalar` to sanity-check (e.g. Cinders: 33.6% DR → +1.68% Shield at `0.000005`).

## SKeyDB arg scaling (`resolvedArgMeta`)

Each layer has `resolvedArgs` (lv6 values) and **`resolvedArgMeta`** (`stat`, `suffix`, `hasSubstatBonus`).

When `resolvedArgMeta.ArgN.stat` is set and `suffix` includes `%`:

- `valueScalar = valueScalarFromKitPercent(resolvedArgs.ArgN)` → `ArgN / 100`
- `dependencyStat = inferDependencyStatFromArgMeta(meta)` → usually `atk`, `def`, or `con`

Covers **`[Power:Arg]` → STR**, **`[Block:Arg]` → Shield**, **`[Damage:Arg]` → Active Damage**, **`[{Poison}:Arg]` → Attacker.Poison**, **`[Exhaustion:Arg]` → STR Down**, etc. Do **not** treat `[Power:Arg]` as flat +N% STR with `dependencyStat: null`.

**`hasSubstatBonus: true`** → **`status: needs_review`** (`argMetaRequiresReview`) — e.g. Agrippa Pale Blessing Poison scaled by ATK% × Sigil Yield; one ATM cannot express both.

**“equal {Poison}” / “equal {Bleed}”** — aftereffect local on the damage ATM (same scalar/dep as damage), not a separate arg row.

**“Trigger [ArgN]% {Poison}”** — flat trigger fraction when meta has no `stat`; not stack-application `Attacker.Poison`.

## Ignore list (omit from proposal JSON)

Do not output proposals for:
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

Use pack `sourceTypeHint`: Strike/Defense/Skill1/Skill2/derived → `command card`; Rouse → `rouse`; Exalt/OverExalt → `exalt`; talents → `talent`. `tentacle` is not a `source_type` value.

## Proposal status

| Status | Insert? |
|--------|---------|
| `ok` | Yes (pending) |
| `needs_review` | No |
| `unsupported` | No |

## Locals

Follow `admin-local-interaction` rules: `unique_scaling` needs modifier tag **or** dependencyStat (target null); `aftereffect` needs target tag, modifier null, op `multiply` | `add_scaled`. Kit Reader **enjoy** heuristic → unique_scaling on subject (see above); enjoy + Tentacle DMG → two add_scaled locals; not a modifier ATM grant.
