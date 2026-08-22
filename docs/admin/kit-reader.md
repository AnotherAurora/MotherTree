# Kit Reader (local admin)

Propose-then-verify pipeline: export one awakener’s SKeyDB kit → paste a Cursor Agent prompt → Agent inserts **pending** ATMs (`verified = false`) via CLI → you Edit / Verify in Kit Reader → live loaders use verified rows.

## Local-only gate

Same as Path Carver / admin tables:

- `ADMIN_ENABLED=true` in `.env.local`
- **Not** on Vercel (`isAdminRuntimeEnabled()` is always false when `VERCEL` is set)

UI: `/kit-reader` (sidebar Tools). Export writes the repo file `sample-data/kit-reader/{slug}.kit.json` — no browser download.

## Operator flow

1. Open **Kit Reader**, pick **one** awakener.
2. If that awakener has pending ATMs: **Verify** or soft-delete until the queue is empty. Export / new batch is blocked while pending remain.
3. **Export kit pack & fill prompt** → writes `sample-data/kit-reader/{slug}.kit.json`.
4. **Copy Cursor prompt** → paste into Cursor Agent mode.
5. Agent proposes + runs insert CLI (`verified=false` only). Never write ad-hoc patch scripts (`scripts/apply-*.ts`); use `insert-kit-pending.ts --patch`/`--append` or the UI.
6. Back in Kit Reader: **Edit** pending rows as needed → **Verify** (or soft-delete). The Awakener Manifestations table remains available for broader CRUD.

```text
Export → Copy prompt → Cursor Agent → insert-kit-pending.ts → pending Edit / Verify
```

## Insert CLI

```bash
npx tsx --env-file=.env.local scripts/insert-kit-pending.ts sample-data/kit-reader/{slug}.proposal.json
```

- Requires `ADMIN_ENABLED=true` (local).
- Aborts if any alive pending ATM exists for that awakener unless `--append` / `--patch` is passed (or `KIT_READER_APPEND=true`). **No `--force`.**
- Inserts only `status: "ok"` rows (default if omitted); always `verified = false`.
- Supports sparse proposals: default fields (`instanceCount: 1`, `baseCopies: 1`, `locals: []`, `status: "ok"`, `dependencyStat: null`, etc.) and `sourceQuote` can be omitted to minimize token overhead.
- Two-pass for `replacesClientKey` → `replaces_manifestation_id`, then nested locals.
- **Metadata is computed at insert** from the kit pack (`sourceKitId` → `sourceLabel`) + `tagName` via `buildAtmMetadata` (trailing `.Fixed` stripped from effect label). Proposal `metadata` is ignored. Use proposal `metadataSuffix` (e.g. `+ SF` on **Talent** rows only) or `metadataOverride` (e.g. `OE Heal *3`) for custom labels. When `sourceLabel` is already `SF`, `metadataSuffix: "+ SF"` is ignored (no `SF … + SF`). CLI output includes `metadataResolved` per row.

Proposal schema: [`src/lib/kit-reader/proposal-schema.ts`](../../src/lib/kit-reader/proposal-schema.ts).

## Pack assumptions

| Field | Value |
| --- | --- |
| Awakener level | 60 |
| Soulforge | 10 (clamped to talent max; 0 if absent) |
| Gnostic | 0, except SKeyDB `defaultMaxed` → lv5 |
| Skill level | lv6 (last scaling index) |

Pinned SKeyDB commit: [`SKEYDB_COMMIT`](../../src/lib/assets/skeydb-base.ts).

**`derivedCards`:** loaded from SKeyDB `records/derived-skills/` using relationship keys `ownedDerivedSkills`, `ownedDerivedCards`, and `derivedSkills` (IDs starting with `derived.`). Primary skills stay in `records/skills/`.

**`enlightens`:** standalone awakener enlightens from SKeyDB `ownedEnlightens` that are **not** already linked via a skill/derived `upgrades[]` entry (by `upgraderId`). OverExalt enlightens are omitted (exported as OverExalt skills). Use `sourceKitId: enlighten.{slug}.{name}` and pack `sourceLabel` (enlighten display name) for metadata.

## Flavor → tag

Resolve kit wording via the pack’s `lexicon.flavorTagSynonyms` (built from [`src/lib/kit-reader/flavor-tag-synonyms.ts`](../../src/lib/kit-reader/flavor-tag-synonyms.ts)). Prefer `.Fixed` except the `Attacker.Active Damage` tree. Never invent tags — only names in `lexicon.tags`.

## ATM metadata + is_accumulating

Helpers: [`src/lib/kit-reader/atm-metadata.ts`](../../src/lib/kit-reader/atm-metadata.ts). Pack export fills `cost`, `sourceLabel`, and per-layer `sourceLabelHint`.

### Metadata formula

```text
{sourceLabel} {effectLabel}[ E1|E2|E3]
```

Devour-bracketed effects (copy provider group `"2x Devour"`):

```text
{sourceLabel} Devour {effectLabel}[ E1|E2|E3]
```

| Kit source | `sourceLabel` (from pack) |
| --- | --- |
| Non-Soulforge talent | `Talent` |
| Soulforge Aptitude (kit-specific) | `SF` |
| Exalt | `Exalt` |
| OverExalt (OE / enlightenment 7) | `OE` |
| Absolute Axiom upgrade (AA / enlightenment **15**) | `AA` |
| Rouse base | `Rouse` |
| Strike / Defense | card name |
| Other Command / Derived | `{N} Cost` from SKeyDB `cost`, or **card name** if cost missing/`—` or duplicated |

- `effectLabel`: strip leading `Attacker.` / `Support.` / `Defender.` / `Special.` / `When.` from `tagName`, then strip trailing `.Fixed` (e.g. `Defender.Shield.Fixed` → `Shield`; tag resolution still prefers `.Fixed`).
- Append `E1`/`E2`/`E3` only when `required_enlightenment` is 1/2/3. Do not double-append OE/AA.

Aurita examples: Gland Division → `0 Cost Active Damage` / `0 Cost Active Damage E2`; Clamorous Ocean → `Exalt …`; Jellyfish Congregation → `OE …`; Sparkling Friendship (AbsoluteAxiom on Rouse) → `AA …` with enlightenment **15**; Happy Little Fairy → `Talent …`; Soulforge kit line → `SF …` (do **not** also set `metadataSuffix: "+ SF"` — insert dedupes redundant suffixes).

**`metadataSuffix`:** append only when canonical metadata is insufficient. Use `+ SF` when `sourceLabel` is `Talent` but the row is Soulforge-specific (`Talent Tentacle Damage Up + SF`). Soulforge Aptitude rows already resolve to `sourceLabel` `SF` → `SF Increase Gain.Poison` with no extra suffix.

### is_accumulating

`true` when kit text is every-turn (“at turn start” / “at turn end”); otherwise `false`.

## Enjoy → unique_scaling

When kit text uses **enjoy / enjoys / enjoying**, scale the **subject** ATM via a **local** (`mode: unique_scaling`), not a separate Support ATM for the modifier tag. Default op is `multiply_one_plus`, `targetType: self`. Modifier tag is the **root**, not `.Fixed`.

**Tentacle DMG:** when enjoy is followed in the same clause by Tentacle DMG / Tentacle Damage, attach **two** locals with identical fields except `modifierTagName`. Unique TDU is a sibling of TDU, not a prefix child.

Example (Caecus): *"Deal DMG, enjoying a 50% Tentacle DMG bonus"* → parent `Attacker.Active Damage` + both locals:

| Field | Local 1 | Local 2 |
| --- | --- | --- |
| `mode` | `unique_scaling` | `unique_scaling` |
| `modifierTagName` | `Support.Tentacle Damage Up` | `Support.Unique Tentacle Damage Up` |
| `valueScalar` | `0.5` | `0.5` |
| `mathOperation` | `add_scaled` | `add_scaled` |
| `targetType` | `self` | `self` |
| `layer` | `add` | `add` |

`"24"` Aequor *"enjoys a 75% Tentacle DMG bonus"* → same pair at `0.75`. Counter / STR enjoy stay a single unique_scaling.

- Pack layers with `hasEnjoyClause` / `hasEnjoyTentacleDmgClause` flag text to inspect.
- Flat grants (“gain Shield”, “+STR”) → ATM on that tag, not enjoy local.
- Aftereffect → emit pattern only, not enjoy wording.
- Ambiguous enjoy → `needs_review`.

Helpers: [`src/lib/kit-reader/proposal-heuristics.ts`](../../src/lib/kit-reader/proposal-heuristics.ts) (`detectEnjoyClause`, `detectEnjoyTentacleDmgClause`, `parseEnjoyPercentFactor`).

## Direct modifier → direct_modifier

When kit text grants **card-specific or record-specific self-contained buffs** (e.g. *Temporary Enhance on specific cards in hand*, *this card gains +N% Crit DMG*, or other intrinsic card multipliers that must not broadcast to all cards of that awakener):

- Attach a **local** on the **subject** ATM with `mode: direct_modifier`.
- Do **not** create a global Support ATM (which would enter the global tag pool and affect all skills).
- `modifierTagName` = semantic tag (e.g. `Support.Enhance`, `Support.Crit Damage`), `targetTagName: null`.
- `valueScalar` = direct factor/multiplier (e.g. `0.5` for 50% Enhance).
- `mathOperation: multiply_one_plus` (or `add_scaled`), `targetType: self`.
- Layer is resolved from the semantic tag (e.g. `Support.Enhance` → `add`) or explicit `layer`.

## Steal → STR Down + STR Up

When kit text uses **`{Steal}`** or **Steal** in a clause that transfers **STR**, propose **two** `status: ok` ATMs with **identical** scalars and source context:

| Half | `tagName` | `targetType` |
| --- | --- | --- |
| Enemy loses STR | `Defender.STR Down` | `aoe` |
| Self gains STR | `Support.STR Up.Fixed` | `aoe` |

Both rows share the same `sourceKitId`, `sourceQuote`, `sourceLayer`, `requiredEnlightenment`, `isPermanent`, `sourceType`, and `metadataSuffix`.

**Scalar rules** (Steal only — not `[Power:Arg]`):

- Flat `Steal N STR` → `valueScalar = N / 100` (Steal 10 → `0.1`; Steal 25 → `0.25`)
- `Steal STR equal to N% of ATK` → `valueScalar = N / 100`, `dependencyStat: atk`

**`[Power:Arg]` / `[Block:Arg]` / `[{Poison}:Arg]`** use pack `resolvedArgMeta` (see [SKeyDB arg scaling](#skeydb-arg-scaling-resolvedargmeta)) — not flat Steal rules.

**Client-key convention:** `*-str-down` + `*-str-up` (e.g. Faint `rouse-per-card-str-down` / `rouse-per-card-str-up`).

**Not Steal** (STR Down only — do not pair):

- Plain reduction without Steal: `reduce … STR`, `[Exhaustion:Arg]` (e.g. Nutrient Absorption)
- Amplifiers: `STR Reduction effect +N%` → `Support.Increase Gain.STR Down`
- OE “reduces STR by N% of DEF” with no Steal keyword

Ambiguous Steal+STR (amount not parseable) → `needs_review`.

- Pack layers with `hasStealClause: true` flag text to inspect.
- Use `lexicon.stealStrTagNames` for the pair tag names.

Helpers: [`proposal-heuristics.ts`](../../src/lib/kit-reader/proposal-heuristics.ts) (`detectStealClause`, `parseStealStrScalar`, `warnStealMissingStrUpPair`).

Insert CLI emits non-blocking **warnings** when a Steal STR Down row has no matching STR Up pair in the same proposal batch.

## Devour → 2x Devour copy provider group

When kit text uses **`[{Devour}: …]`** or **`{Devour}`** (pack layer `hasDevourClause: true`, or `detectDevourClause`):

- Set **`copyProviderGroupName: "2x Devour"`** → `copy_provider_group_id: 7` at insert.
- Set **`triggerConditionTagName: null`** — do **not** use `Special.When.Devour` or `Special.Cause.Devour`.
- Insert CLI metadata includes **`Devour`**: `{sourceLabel} Devour {effectLabel}[ E1|E2|E3]` (e.g. `Exalt Devour Draw.Command Card.Strike`).

Pack export exposes `lexicon.devourCopyProviderGroupName` (`"2x Devour"`).

Helpers: [`proposal-heuristics.ts`](../../src/lib/kit-reader/proposal-heuristics.ts) (`detectDevourClause`, `DEVOUR_COPY_PROVIDER_GROUP_NAME`, `warnDevourUsingWhenTrigger`).

Insert CLI emits non-blocking **warnings** when a Devour `sourceQuote` uses a When/Cause trigger or omits the copy provider group.

## SKeyDB arg scaling (`resolvedArgMeta`)

Each pack layer exports `resolvedArgs` (lv6 numbers) and **`resolvedArgMeta`** (per-arg `stat`, `suffix`, `hasSubstatBonus`, `substatBonusSubstat`) from SKeyDB `descriptionArgs`.

When `resolvedArgMeta.ArgN` has **`stat`** (`atk` / `def` / `con`) and **`suffix`** includes **`%`**:

- `valueScalar = resolvedArgs.ArgN / 100` (`valueScalarFromKitPercent`)
- `dependencyStat = meta.stat` (`inferDependencyStatFromArgMeta`)

Applies across channel tokens — not only `[Damage:Arg]`:

| Channel / token | Typical tag | Example |
| --- | --- | --- |
| `[Damage:Arg]` | `Attacker.Active Damage` | Deal 20% ATK DMG → `0.2`, `atk` |
| `[Block:Arg]` | `Defender.Shield.Fixed` | Gain 20% DEF Shield → `0.2`, `def` |
| `[Power:Arg]` | `Support.STR Up.Fixed` | Obtain 4% ATK STR → `0.04`, `atk` (not flat STR) |
| `[{Poison}:Arg]` | `Attacker.Poison` | Inflict 150% ATK Poison → `1.5`, `atk` |
| `[Exhaustion:Arg]` | `Defender.STR Down` | Reduce by N% DEF → `N/100`, `def` |

**`hasSubstatBonus: true`** (e.g. Agrippa Pale Blessing Poison × Sigil Yield) → **`status: needs_review`** — multi-stat formula; one ATM cannot express it (`argMetaRequiresReview`).

**“equal {Poison}” / “equal {Bleed}”** — no separate poison arg; use **aftereffect** on the damage ATM with the same scalar/dep as damage.

**“Trigger [ArgN]% {Poison}”** — ArgN is usually a flat trigger fraction (no `stat` in meta) → not `Attacker.Poison` stack application.

Helpers: [`description-args.ts`](../../src/lib/kit-reader/description-args.ts), [`proposal-heuristics.ts`](../../src/lib/kit-reader/proposal-heuristics.ts).

## Percent vs linear `dependency_stat`

Kit packs export `lexicon.percentDependencyStats` (`damage_amp`, `crit_rate`, `crit_dmg`, `sigil_yield`, `death_resist`). Path Carver scales these with `(value_scalar×100) × (stat×100)` where awakener stat is a **fraction** (33.6% → `0.336`). Linear stats (`realm_mastery`, `con`, `atk`, …) use `value_scalar × stat` only.

| Kit wording | `dependency_stat` | `value_scalar` formula | Example |
| --- | --- | --- | --- |
| +0.2% effect **per 1** Realm Mastery | `realm_mastery` (linear) | `R / 100` | 0.2 → **0.002** (Casiah Master of Magic) |
| +0.2% effect **per 1%** Death Resistance | `death_resist` (percent) | `R / 10000` | 0.2 → **0.00002** (Corposant Cinders Base DMG) |
| +0.05% Shield **per 1%** DR | `death_resist` (percent) | `R / 10000` | 0.05 → **0.000005** |

**Never** reuse the linear RM `0.002` pattern on percent deps — it overshoots by **100×**.

Sanity check (Cinders Shield at **33.6% DR**): `0.000005 × 100 × (0.336 × 100) = 0.0168` → **+1.68%** Shield increase.

Helpers in [`proposal-heuristics.ts`](../../src/lib/kit-reader/proposal-heuristics.ts):

- `valueScalarPerUnitLinearDep(ratePercentPerUnit)` — linear deps
- `valueScalarPerPercentPointOfPercentDep(ratePercentPerDepPoint)` — percent deps
- `previewAtmEffectiveScalar(valueScalar, dependencyStat, depFraction)` — sanity preview
- `parseEveryOnePercentRate(kitText)` — parse “Every 1% … by R%” lines

Insert CLI emits non-blocking **warnings** when a percent-dep row’s `value_scalar` looks like a linear RM rate (`rate/100` instead of `rate/10000`).

## Lemurian synergy

When kit text matches Lemurian team synergy (e.g. *“When there are 1/2/3 other Lemurian Awakeners in the team, DMG Amplification +20%/50%/100%”*), propose **four** `status: ok` ATMs on that awakener — not a single flat AMP row, not a local interaction.

| # | `tagName` | `valueScalar` | `triggerConditionTagName` | Other fields |
| --- | --- | --- | --- | --- |
| 1 | `Special.Cause.Lemurian` | `1` | null | `isPermanent: true`, `metadataOverride: "Lemurian"` |
| 2 | `Support.Damage AMP` | `0.2` | `Special.When.Lemurian Synergy 1` | `targetType: "aoe"` |
| 3 | `Support.Damage AMP` | `0.5` | `Special.When.Lemurian Synergy 2` | `targetType: "aoe"` |
| 4 | `Support.Damage AMP` | `1.0` | `Special.When.Lemurian Synergy 3` | `targetType: "aoe"` |

- **Client keys:** `lemurian-marker`, `lemurian-synergy-1`, `lemurian-synergy-2`, `lemurian-synergy-3`
- **`sourceType`:** usually `talent` (Soulforge / permanent trait)
- Parse tier percents from kit text when non-standard (`parseLemurianSynergyTiers`); default 20 / 50 / 100
- Only **one** tier row applies per awakener at a time (engine sets one When gate); multiple Lemurians on a team each contribute their active tier to team AMP
- Ambiguous Lemurian wording → `needs_review`

Helpers: [`proposal-heuristics.ts`](../../src/lib/kit-reader/proposal-heuristics.ts) (`detectLemurianSynergyClause`, `parseLemurianSynergyTiers`). Engine: [`lemurian-synergy.ts`](../../src/lib/path-carver/lemurian-synergy.ts).

## Always-aoe tags (ATM only)

When **ATM** `tagName` matches any prefix in pack `lexicon.aoeTagPrefixes` (including subtags), set ATM `targetType: "aoe"`. Insert CLI normalizes if Agent omits it. unique_scaling locals always use `targetType: "self"`.

Prefixes: `Support.Keyflare`, `Support.STR Up`, `Attacker.Counter`, `Defender.Heal`, `Defender.Shield`, `Defender.Base Death Resist`, `Support.Double Posse`, `Support.Create.Posse`, `Support.Generate Temporary Tentacle`, `Support.Generate Permanent Tentacle`, `Support.Embryo Fusion`, `Support.Crimson Furnace`, `Support.Realm Mastery`, `Support.Tentacle Damage Up`, `Support.Discard`.

## Ignore list

Never ATM: Gnostic Potential, Madness Omen, Dimensional Image; Soulforge Astral Reign / CON·ATK·DEF% / first-Rouse Keyflare. Kit-specific Soulforge lines are eligible.

## Verified column

- On `awakener_tag_manifestation` only; locals follow parent.
- Insert CLI → always `false`.
- Manual admin creates / backfill → default `true`.
- Edits to verified rows stay verified.
- Live Path Carver / simulator / public Search: `verified = true` (and anon RLS).

## Out of scope (v1)

JSON import button, in-app “call AI”, batch multi-awakener, `--force`, golden packs.

## Attribution

Kit text and assets come from [dansa/SKeyDB](https://github.com/dansa/SKeyDB) (see repo notices / CC BY-NC-SA where applicable). Game assets remain owned by Qookka Games and/or their licensors.
