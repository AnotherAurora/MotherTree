---
name: Relic Picker Page
overview: "Context + maintenance guide for the public /relic-picker page. Explains the anon data path, the relic source-kind engine semantics, the SKeyDB computed-arg formula (including HSR), candidate ranking, and performance strategy so future agents can extend the page safely."
todos:
  - id: stable
    content: Page, public data path, relic engine integration, ranking, smoke are implemented
    status: completed
isProject: false
---

# Relic Picker Page — Maintenance Context

Read this before changing `/relic-picker`. It records decisions and the exact
math so you do not have to reverse-engineer them.

## What the page does

Public (`(public)` route group, anon-readable) tool at `src/app/(public)/relic-picker/page.tsx`.

1. Build a team exactly like Path Carver's Build step (4 slots, wheels,
   covenants, covenant sub-stat sets, posse, damage-dealer anchors) **without**
   Load / Next / Save. In-game team **Import** is kept.
2. Run the full Path Carver calculation (not a shortcut) and show **Total Damage**.
3. Rank every eligible damage relic by **percent increase** to Total Damage.
   Add a relic → total updates, relic leaves the list, repeat with no limit.

Inputs:
- `Account Level` (1–100, default 50) and `Owned Posse` (1–50, default 50),
  both clamped.
- `HSR` checkbox: doubles the resolved value of every
  `relic_tag_manifestation` row whose `kind` is `computed` (applied after the
  ceil). `fixed` rows are unaffected.

Eligibility: `relic.is_damage = true` AND (`relic.required_realm` is null OR the
realm is present in the team's resolved realms after replacement). Selecting is
unlimited and non-repeating.

## Key files

| Concern | File |
| --- | --- |
| Page (server, loads options) | `src/app/(public)/relic-picker/page.tsx` |
| Client tool | `src/components/relic-picker/relic-picker.tsx` |
| Public server actions | `src/lib/actions/public-relic-picker.ts` |
| Allowlisted → `TeamData` builder + option builders + relic catalog | `src/lib/public/relic-picker-data.ts` |
| Relic computed-arg formula + account curve | `src/lib/path-carver/relic-research-curve.ts` |
| Relic `Manifestation` injector | `src/lib/path-carver/relic-manifestations.ts` |
| Baseline + per-relic ranking (+ cache) | `src/lib/path-carver/relic-candidates.ts` |
| Ranking Web Worker + client hook | `src/components/relic-picker/relic-ranking.worker.ts`, `src/components/relic-picker/use-relic-ranking.ts` |
| Damage-relevance closure (gated) | `src/lib/path-carver/damage-relevance.ts` |
| `tag.is_damage_relevant` generator | `scripts/sync-tag-damage-relevance.ts` (`npm run sync:damage-relevance`) |
| Smoke checks | `scripts/smoke-relic-formula.ts`, `scripts/smoke-damage-relevance.ts`, `scripts/smoke-damage-relevance-real.ts` |

## Public data path (anon, no admin runtime)

A truly public page cannot use `loadTeamData` / `getSimulatorGearOptions`
(admin-gated, `createAdminClient`). Instead:

- `loadPublicCatalog()` in `src/lib/actions/public-relic-picker.ts` fetches the
  allowlisted tables with `fetchAllPublicTable` (anon + RLS, in-process 5-min
  cache) and assembles a `PublicTeamCatalog`.
- `buildPublicTeamData(selection, catalog)` maps those rows to the engine's
  `TeamData` (mirrors `src/lib/team-data/load-team-data.ts`, and
  `src/lib/public/solo-awakener-totals.ts` for the mapping style). Base team
  data never contains relics.
- `buildPublicAwakenerOptions` / `buildPublicGearOptions` produce the exact
  shapes `BuildStep`/`AwakenerSlotRow` expect.
- The action returns `{ teamData, relicCatalog }`; the client injects relics and
  runs the math locally (no per-pick server calls, no rate-limit pressure).

Security: only tables/columns in `src/lib/public-read/allowlist.ts` are read.
`covenant_stat_set` was added there (and granted to anon via a migration) because
covenant sub-stat sets contribute base stats. Do not read arbitrary columns;
expand the allowlist + RLS deliberately.

## Relic engine semantics (important)

Relic rows are a dedicated `sourceKind: "relic"` and behave like realm rows:

- **Affect others**: they stay in the Layer A provider pool and emit
  aftereffects, so they can amplify/convert other tags via
  `tag_default_interaction`.
- **Never affected**: `isInteractionImmuneSubject` returns true for relic rows,
  so no inbound `tag_default_interaction` ever scales a relic's own value. This
  is what keeps a relic's contribution from being inflated by awakener tags.

Where this is wired:
- `src/lib/team-data/types.ts` — `ManifestationSourceKind` includes `"relic"`.
- `src/lib/path-carver/effective-value-scalar.ts` — `isInteractionImmuneSubject`.
- `src/lib/path-carver/manifestation-apply.ts` — skips the `Attacker.*`
  damage-dealer gate for relic (relics have no owning awakener).
- `src/lib/path-carver/apply-interactions.ts` — owner key `"relic"`, source
  label, and owner→synthetic/id helpers (aftereffect stacks, tentacle pools,
  Active-Damage-to-Bleed).
- `src/lib/path-carver/all-tentacle-attack.ts` /
  `hit-tentacle-attack.ts` — owner-key parity for tentacle synthetics.
- `src/lib/path-carver/awakener-base-stats.ts` — `Special.Increase Base *`
  recipients treat relic like realm (team-wide).

Relic rows are injected by `buildRelicManifestations`, which sets
`requiredRealmId` from `relic.required_realm` so the whole relic gates as a unit.
`dependency_stat` is passed through: `team_max_hp` scales off team Max HP; other
stats would scale off an owner awakener (none for relics). No current relic rows
use a non-`team_max_hp` dependency (the only one, Rusty Lancet, is soft-deleted).

`npm run smoke:relic-formula` asserts both "affects others" and "not affected"
with a posse control.

## Computed-arg formula (SKeyDB)

Source: `dansa/SKeyDB` commit `b7a70c00a33a031811fa88d9fd8dd7564ca286c1`,
`src/data/public-v3/metadata/gameplay-math.json` (curve) and
`src/domain/public-description-args.ts` (semantics). Vendored in
`relic-research-curve.ts`.

Let `L = clamp(accountLevel, 1, 100)`, `P = min(ownedPosseCount, 50)`,
`posseMult = 1 + P * 0.01`, `vs = relic_tag_manifestation.value_scalar` (the
effect multiplier).

- `fixed` → `vs` (never doubled by HSR)
- `accountStageGrowth` → `ceil(stageGrow[L] * posseMult * vs)` (no posse bonus)
- `esotericResearchDepth` → `ceil(stageGrow[L] * posseMult * vs)`
- `occultResearchDepth` → `ceil(stageGrow[L] * accountDamagePower[L]/100 * posseMult * vs)`
- HSR → the resolved `computed` value **doubled after the ceil** (e.g. Crimson
  Brooch at L=81, P=50: `ceil(1074 × 1.5 × 0.1) = 162` → `324` with HSR).

Reference values at L=50, P=50, no HSR: Arcana Archive 182, Arcana Relic 364,
Blessed Blood 74, Deceased's Chrono 530, Neurotoxin 1212, Nettle Vest 606,
Uncanny Salve 909, Voyager's Parasol 147. The research plan
`.cursor/plans/relic_astral_reign_research_9f2c4b71.plan.md` lists all origins.

If you change the formula, update `relic-research-curve.ts` and the expected
table in the smoke script together.

## Ranking + performance

`computeRelicRanking` (in `relic-candidates.ts`):

- Baseline = engine total for `teamData` + currently selected relics.
- Each remaining eligible relic is evaluated as `baseline + that relic`.
- `percentIncrease = (withRelic - baseline) / baseline * 100` (`null` when
  baseline is 0).
- Sorted by percent desc.

### Why the sweep was expensive

The engine is **not** cheap per relic: `computeReviewTagTotals` walks the full
interaction fixpoint, and the sweep re-runs it for the baseline plus every
candidate — roughly `Σk ≈ 780` full engine runs for a 39-relic catalog, once per
add/remove. Running that synchronously on the main thread inside `setTimeout(0)`
(the old behavior) froze the page.

### Performance strategy (current)

- Page ships only option lists; team `TeamData` is one cached anon action call
  per team/posse change, debounced 400 ms.
- **Web Worker**: `computeRelicRanking` runs in `relic-ranking.worker.ts` via
  `useRelicRanking`. The worker owns the `RelicTotalCache` and receives `init`
  (team) then `rank` (selection/inputs) messages; only the newest `requestId` is
  applied. `next.config.ts` adds `worker-src 'self' blob:` to the CSP.
- **Overlay**: while a ranking is in flight the Relic Impact panel is covered by
  a spinner and its add buttons are `disabled`, so a stale ranking cannot be
  picked.
- `totalsOnly` (`computeReviewTagTotals` option) skips building the debug
  `steps` array for the ranking path.
- The per-team `ManifestationApplyContext` (team realms, suppressed combo ids)
  is built once per `computeRelicRanking` call instead of per candidate.
- `totalCache` is keyed by `inputs|selectedIds`; the just-picked relic becomes
  the next baseline for free.
- Fallback: if the browser lacks `Worker` (or construction throws), the hook runs
  the same function on the main thread so behavior is unchanged.

### Damage-relevance prefilter (gated OFF)

`damage-relevance.ts` computes the reverse closure from the six
`DAMAGE_CHANNEL_TAGS` over `tag_default_interaction`, plus explicit
`DAMAGE_SEED_TAG_IDS` for the code-driven synthetic hops (base-stat transfers,
death resist, keyflare→posse, base tentacle, hit tentacle/TDU/crit, birth ritual,
AD→bleed, trigger causes, copy providers). A generated mirror lives on
`public.tag.is_damage_relevant` / `damage_relevance_reason`
(`npm run sync:damage-relevance`; migration
`20260917000000_add_is_damage_relevant_to_tag.sql`). The mirror is **not** read at
runtime.

`DAMAGE_RELEVANCE_FILTER_ENABLED` in `relic-candidates.ts` is **false**. The
closure is not yet a safe superset: `npm run smoke:damage-relevance-real` showed a
manifest's *presence* couples tags outside the modifier→target graph (removing an
irrelevant `Defender.Shield.Fixed` base changed
`Attacker.Active Damage.Strike` through the owner/pool machinery). Enable it only
after the closure models those couplings and the real-data parity smoke passes
with the flag on. `smoke:damage-relevance` documents the intended closure rules
and synthetic parity.

`smoke:damage-relevance-real` guards the enabled ranking path: it loads a real
team and asserts `computeRelicRanking` baseline and every eligible relic total
equal an unfiltered engine run.

## Extending

- Add a relic: no code change needed; `is_damage` + `required_realm` drive
  eligibility. Ensure its `relic_tag_manifestation` rows resolve via the formula.
- New `base_formula`: extend `RelicBaseFormula` and `resolveRelicValueScalar`,
  then add a smoke case.
- Show a per-channel breakdown: `computeTotalDamage` already returns
  `byChannel`; the page currently shows only the total.
- Persisting selections / sharing: keep it client-side unless a plan is amended.

## Pitfalls

- Do not reuse `loadTeamData` (admin) for this public page.
- Do not use `sourceKind: "posse"` for relics — posse is not interaction-immune
  and the value would be amplified.
- `teamData.tagsById` is shared; `ensureRelicTags` only fills missing stubs.
- Do not enable `DAMAGE_RELEVANCE_FILTER_ENABLED` while
  `npm run smoke:damage-relevance-real` fails with it on — see above.
- Keep `tag.is_damage_relevant` in sync with the interaction graph by re-running
  `npm run sync:damage-relevance` after editing `tag_default_interaction`.
- `typecheck` is only run on explicit request (see `AGENTS.md`); verify with
  `npm run smoke:relic-formula`, `npm run smoke:damage-relevance`,
  `npm run smoke:damage-relevance-real`, and `npm run lint`.
