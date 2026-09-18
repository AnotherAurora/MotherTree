# Kit Reader field rules: `dependency_stat` & `value_scalar`

Canonical reference for resolving a row's `dependency_stat` / `value_scalar` from kit text. Applies to **both** workflows:

- Initial kit read / insert: [`.github/skills/kit-reader/SKILL.md`](../../.github/skills/kit-reader/SKILL.md)
- Surgical review edits: [`.github/skills/kit-reader-review/SKILL.md`](../../.github/skills/kit-reader-review/SKILL.md)

DB columns are `value_scalar` / `dependency_stat`. Proposal JSON uses camelCase `valueScalar` / `dependencyStat`. Always keep both in sync.

## Percent vs linear `dependency_stat`

Percent-style dependency stats (source of truth: `PERCENT_DEPENDENCY_STATS` in [`proposal-heuristics.ts`](../../src/lib/kit-reader/proposal-heuristics.ts), mirrored in [`effective-value-scalar.ts`](../../src/lib/path-carver/effective-value-scalar.ts)):

`damage_amp`, `crit_rate`, `crit_dmg`, `sigil_yield`, `death_resist`

- Percent deps are stored on the awakener as a **fraction** (33.6% → `0.336`). Path Carver scales them with `(value_scalar × 100) × (stat × 100)`.
- Linear deps (`realm_mastery`, `con`, `atk`, `def`, …) scale with `value_scalar × stat` only.

| Kit wording                              | `dependency_stat`        | `value_scalar` formula | Example                                        |
| ---------------------------------------- | ------------------------ | ---------------------- | ---------------------------------------------- |
| +0.2% effect **per 1** Realm Mastery     | `realm_mastery` (linear) | `R / 100`              | 0.2 → **0.002** (Casiah Master of Magic)       |
| +0.2% effect **per 1%** Death Resistance | `death_resist` (percent) | `R / 10000`            | 0.2 → **0.00002** (Corposant Cinders Base DMG) |
| +0.05% Shield **per 1%** DR              | `death_resist` (percent) | `R / 10000`            | 0.05 → **0.000005**                            |

**Never** reuse the linear RM `0.002` pattern on a percent dep — it overshoots by **100×**.

Sanity check with `previewAtmEffectiveScalar` (Cinders Shield at **33.6% DR**): `0.000005 × 100 × (0.336 × 100) = 0.0168` → **+1.68%** Shield increase.

## SKeyDB arg scaling (`resolvedArgMeta`)

Each kit layer exports `resolvedArgs` (lv6 values) and `resolvedArgMeta` (`stat`, `suffix`, `hasSubstatBonus`, `substatBonusSubstat`).

When `resolvedArgMeta.ArgN.stat` is set **and** `suffix` includes **`%`**:

- `value_scalar = ArgN / 100` (`valueScalarFromKitPercent`, [`description-args.ts`](../../src/lib/kit-reader/description-args.ts))
- `dependency_stat = meta.stat` (`inferDependencyStatFromArgMeta`) → usually `atk`, `def`, or `con`

Applies across channel tokens — not only `[Damage:Arg]`:

| Channel / token    | Typical tag              | Example                                          |
| ------------------ | ------------------------ | ------------------------------------------------ |
| `[Damage:Arg]`     | `Attacker.Active Damage` | Deal 20% ATK DMG → `0.2`, `atk`                  |
| `[Block:Arg]`      | `Defender.Shield.Fixed`  | Gain 20% DEF Shield → `0.2`, `def`               |
| `[Power:Arg]`      | `Support.STR Up.Fixed`   | Obtain 4% ATK STR → `0.04`, `atk` (not flat STR) |
| `[{Poison}:Arg]`   | `Attacker.Poison`        | Inflict 150% ATK Poison → `1.5`, `atk`           |
| `[Exhaustion:Arg]` | `Defender.STR Down`      | Reduce by N% DEF → `N/100`, `def`                |

- **`hasSubstatBonus: true`** → `status: needs_review` (`argMetaRequiresReview`) — multi-stat formula; one ATM cannot express it.
- **“equal {Poison}” / “equal {Bleed}”** — no separate poison arg; use an **aftereffect** local on the damage ATM with the same scalar/dep as damage.
- **“Trigger [ArgN]% {Poison}”** — ArgN is usually a flat trigger fraction (no `stat` in meta) → not `Attacker.Poison` stack application.

## Locals

- `unique_scaling` needs a `modifierTagName` **or** a `dependencyStat` (target null) — see [`proposal-schema.ts`](../../src/lib/kit-reader/proposal-schema.ts).
- `aftereffect` needs a target tag, modifier null, op `multiply` | `add_scaled`.

## Helpers index

From [`src/lib/kit-reader/proposal-heuristics.ts`](../../src/lib/kit-reader/proposal-heuristics.ts) unless noted:

- `valueScalarPerUnitLinearDep(ratePercentPerUnit)` — linear deps → `R / 100`
- `valueScalarPerPercentPointOfPercentDep(ratePercentPerDepPoint)` — percent deps → `R / 10000`
- `previewAtmEffectiveScalar(valueScalar, dependencyStat, depFraction)` — pre-ceil sanity preview
- `parseEveryOnePercentRate(kitText)` — parse “Every 1% … by R%” lines
- `kitTextScalesPerOnePercentDep(sourceQuote, rationale)` — detect per-1% wording
- `warnPercentDepValueScalarLooksLinear(...)` — non-blocking insert-CLI warning
- `isPercentDependencyStat(stat)` — re-exported from [`effective-value-scalar.ts`](../../src/lib/path-carver/effective-value-scalar.ts)
- `valueScalarFromKitPercent(resolvedValue)` — percent arg → `ArgN / 100` ([`description-args.ts`](../../src/lib/kit-reader/description-args.ts))
- `inferDependencyStatFromArgMeta(meta)` — `resolvedArgMeta` → `dependency_stat`
- `argMetaRequiresReview(meta)` — `hasSubstatBonus` → `needs_review`

## Review-edit caveat

The insert CLI emits the non-blocking `warnPercentDepValueScalarLooksLinear` warning, but **it does not run during direct-SQL review edits**. When a review edit touches `value_scalar` / `dependency_stat`, apply these rules manually and sanity-check with `previewAtmEffectiveScalar` before writing. Mirror the change in both the database row and the `{slug}.proposal.json` definition.
