# MotherTree Calculation Pipeline — AI Reference

**Status:** authoritative summary of the **live code** (not of the phased plan).
**Scope:** the Path Carver / Review Tags calculation engine only.
**Out of scope (abandoned):** Phase 4 (`desire_demand` / radar / simulator port / Calculation List breakdown) and Phase 5 (smart recommend). The simulator has its own unrelated `src/lib/simulator/aggregate-tags.ts` + `fulfillment.ts` which are **not** wired to this engine.

> Read this before editing any math. It is derived from the actual implementation at the time of writing. Where the phased plan and the code disagree, **the code wins**; disagreements are listed in §11.

---

## 1. Entry points and call graph

```
computeReviewTagTotals(teamData, applyContext, options?)      aggregate-tag-scalars.ts:197
  ├─ computeAwakenerTotalBaseStats                              awakener-base-stats.ts:261
  ├─ buildBaseStatTransferManifestations                        awakener-base-stats.ts:324
  ├─ computeKeyflareHarmonyScalar / buildKeyflareHarmony...     keyflare-harmony.ts
  ├─ buildDeathResistDerivedManifestations                      death-resist-trigger.ts:120
  ├─ computeKeyflareToPosse / buildKeyflareToPosse...           keyflare-to-posse.ts
  ├─ sumCauseTotals / buildTriggerCounts / Lemurian             aggregate-tag-scalars.ts:92, trigger-condition.ts
  ├─ computeTeamMaxHp                                           team-max-hp.ts:81
  ├─ computeBaseTentacleDamage / buildBaseTentacleDamage...     base-tentacle-damage.ts
  ├─ buildLayerAProviderPool + buildHitCountByManifestationKey  copy-instances.ts
  └─ applyInteractionsForTeamData ─► applyInteractions          apply-interactions.ts:3770 / :2547
        ├─ buildAftereffectClosure                              apply-interactions.ts:541
        ├─ applyAllTentacleAttackHop (4f)                       all-tentacle-attack.ts:255
        ├─ buildHitTentacleSynthetics + TDU pool (4d)           hit-tentacle-attack.ts
        ├─ applyActiveDamageToBleedConversion (4g)              active-damage-to-bleed.ts:103
        └─ applyBirthRitualSacrificeConversion (4e)              birth-ritual-sacrifice.ts:169
```

`computeReviewTagTotals` returns `ReviewTagTotals` (`aggregate-tag-scalars.ts:69`):

| Field | Meaning |
| --- | --- |
| `totalsByTagId` | Final post-interaction team total per `tag.id`. This is the number the UI shows. |
| `steps` | Debug trace (`ScalarMathStep[]`). Skipped when `options.totalsOnly`. |
| `reviewTeamData` | Team data with total-base awakeners + synthetic transfer/realm rows, for Review Tags display. |
| `triggerCounts` | `When.*` tag id → apply count (from `Cause.*` totals). |
| `teamMaxHp` | `TeamMaxHpResult` (baseline, Max HP Up, final). |

Consumers of the engine:
- `src/components/path-carver/review-tags-step.tsx:120` — Path Carver Review Tags (primary validation surface).
- `src/lib/public/solo-awakener-totals.ts:457` — public solo-awakener totals.
- `src/lib/path-carver/relic-candidates.ts:130` — relic picker ranking sweep.
- Smoke scripts under `scripts/smoke-*.ts`.

`aggregateTagScalarsById` (`aggregate-tag-scalars.ts:140`) is a **base-only** (no interaction) aggregation helper; don't confuse it with the full pipeline.

---

## 2. Input data model

### 2.1 `TeamData` (`src/lib/team-data/types.ts:241`)
- `awakeners: Awakener[]`
- `manifestations: Manifestation[]`
- `defaultInteractions: DefaultInteraction[]`
- `tagsById: Record<number, Tag>`
- `realms: RealmLookupRow[]` (id / name / replace)
- `gearStatContributions: GearStatContribution[]` (per-slot wheel/covenant flat `stat`/`stat_amount`)
- `summary`

### 2.2 `Manifestation` (types.ts:105) — fields that drive math
- Identity/owner: `id`, `sourceKind` (`awakener|wheel|covenant|posse|realm|relic`), `awakenerId`, `slotIndex`, `sourceName`.
- Value: `tagId`, `tagName`, `valueScalar`, `dependencyStat`.
- Multiplicity: `instanceCount`, `baseCopies`, `copyProviderGroupId`, `copyProviderTagIds`.
- Gating: `triggerCondition` (When.* id), `requiredEnlightenment`, `requiredAwakenerId`, `requiredRealmId`/`2`, `isAccumulating`.
- Realm: `realmId`, `requiredRealmMode` (`present|exclusive|combo`), `dependencyRate`, `dependencyRateStat`, `pureBonusTarget`.
- Interaction context: `sourceType`, `targetType`, `buffTargetTypeRestriction`, `interactionOverrides`.
- Synthetic flags: `isBaseStatTransfer`, `isCreatedBase`.

`targetType` on `Manifestation` is **nullable** in the type (types.ts:128) even though the DB `target_type` enum has no null and local rows default to `aoe`. Treat only `"self"` as special; everything else behaves as non-self.

### 2.3 `Tag` (types.ts:48)
- `id`, `tagName`, `layer: "pre_add" | "add" | "post_add" | null`.
- `isPercent`: fractional bonus where `0` = no bonus; changes `multiply_one_plus` / `multiply` math.
- `isAdditive`: default `true`. When `false`, same-tag post-pass merge multiplies (percent: product of `(1+v)` − 1).

### 2.4 `DefaultInteraction` (types.ts:205) — the global rulebook
- `modifierTagId` / `modifierTagName`, `targetTagId` / `targetTagName`, `exclusionTagId` / `exclusionTagName`.
- `mathOperation`, `defaultFactor`, `buffTargetTypeRestriction: SourceType | null`.
- `createsBase`, `amplifiesSubject`. Intended XOR. Effective classification in `applyInteractions` (`apply-interactions.ts:2582`):
  - create = `createsBase && !amplifiesSubject`
  - amplify = `amplifiesSubject && !createsBase`
  - both true → treated as **amplify** (createsBase forced off)
  - both false → neither.

### 2.5 `AwakenerLocalManifestationInteraction` (types.ts:87) — per-ATM local rows
Table `awakener_local_manifestation_interaction`. Loaded onto `Manifestation.interactionOverrides`.
- `mode: "unique_scaling" | "aftereffect" | "direct_modifier"` (`wakener_local_interaction_mode`).
- `modifierTagId`, `targetTagId`, `layer`, `mathOperation`, `valueScalar`, `targetType` (NOT NULL, default `aoe`), `dependencyStat`, `isDisabled`.

### 2.6 `Awakener` (types.ts:61) — fields used by dependency scaling
`con`, `atk`, `def`, `keyflareRegen`, `damageAmp`, `critRate`, `critDmg`, `realmMastery`, `baseAliemus`, `aliemusRegen`, `sigilYield`, `deathResist`.

### 2.7 Enums (generated DB types)
| Enum | Values |
| --- | --- |
| `layer` | `pre_add`, `add`, `post_add` |
| `operation_type` | `presence_multiply`, `add_scaled`, `multiply_one_plus`, `multiply` |
| `source_type` | `command card`, `exalt`, `rouse`, `talent`, `buff` |
| `target_type` | `self`, `single`, `aoe` |
| `awakener_local_interaction_mode` | `unique_scaling`, `aftereffect`, `direct_modifier` |
| `all_stats` | `con`, `atk`, `def`, `keyflare_regen`, `damage_amp`, `crit_rate`, `crit_dmg`, `realm_mastery`, `aliemus_regen`, `sigil_yield`, `death_resist`, `team_max_hp`, `enemy_max_hp`, `base_aliemus` |
| `pure_bonus_target` | `none`, `value_scalar`, `dependency_rate` |
| `realm_match_mode` | `present`, `exclusive`, `combo` |

### 2.8 Tag matching helper
`matchesDemandTag(manifestationTag, demandTag)` (`src/lib/simulator/tag-matching.ts:2`) = exact OR `manifestationTag.startsWith(demandTag + ".")`. This single prefix rule is reused for targets and for `unique_scaling` invent modifier pools.

---

## 3. Core primitives

### 3.1 Effective scalar — `effectiveManifestationScalar` (effective-value-scalar.ts:307)
Entry per manifestation. `tagIsPercent = tagsById[tagId].isPercent === true`.
- `sourceKind === "realm"` → `scaleRealmValueScalar` (§3.1b).
- else → `scaleValueScalar(valueScalar, dependencyStat, ownerAwakener, sourceKind, tagIsPercent, teamMaxHp)`.

`scaleValueScalar` (effective-value-scalar.ts:262):
| Case | Result |
| --- | --- |
| `raw == null` | `0` |
| `dependencyStat == null` | raw (no ceil) |
| `sourceKind === "posse"` and stat ≠ `team_max_hp` | raw |
| `dependencyStat === "enemy_max_hp"` | `ceil(raw * 100) / 100` (2 dp; no stat scaling) |
| `dependencyStat === "team_max_hp"` | no context → raw; else `ceilAfterDependencyScale(raw * teamMaxHp, tagIsPercent)` |
| percent dep stat | `ceilAfterDependencyScale(raw * 100 * (stat * 100), tagIsPercent)` |
| else | `ceilAfterDependencyScale(raw * stat, tagIsPercent)` |

`ceilAfterDependencyScale` (effective-value-scalar.ts:104): percent tag → `ceil(x*100)/100`; else → `ceil(x)`.
- Percent dependency stats: `damage_amp`, `crit_rate`, `crit_dmg`, `sigil_yield`, `death_resist`.
- Null awakener stat → `0`.
- `realm_mastery` is ceiled per awakener before use (`ceilRealmMastery`), and `sumTeamRealmMastery` sums those ceiled values.

`scaleRealmValueScalar` (effective-value-scalar.ts:146) — realm rows only:
```
isPure      = teamRealms.isPure(realmId)
scalarMult  = pure && pure_bonus_target === "value_scalar"     ? 2 : 1
rateMult    = pure && pure_bonus_target === "dependency_rate"  ? 2 : 1
hasRatePair = dependencyRate != null && dependencyRateStat != null

flat      (dep == null && !hasRatePair): effective = raw * scalarMult
rate-scaled (dep + rate + rateStat):    effective = ceil((baseStat * (raw*scalarMult + rate * rateStat * rateMult)) )
multiply-only (dep != null):
    enemy_max_hp in REALM_IGNORED_DEPENDENCY_STATS → raw * scalarMult
    team_max_hp with no teamMaxHp context          → raw * scalarMult
    percent dep                                     → ceil((raw*scalarMult*100) * (baseStat*100))
    else                                            → ceil(raw*scalarMult*baseStat)
no dep but rate pair incomplete                     → raw * scalarMult

then: if requiredRealmMode === "combo": effective *= teamRealms.chaosComboStacks
```
`resolveRealmBaseStat`: `enemy_max_hp`→0, `team_max_hp`→`options.teamMaxHp`, `realm_mastery`→team sum, else team stat sum. Ceil precision follows `tagIsPercent`.

### 3.2 Same-tag combination — `combineSameTagScalar` (combine-same-tag-scalar.ts:6)
```
current === undefined → incoming
isAdditive            → current + incoming
!isAdditive && isPercent → ceil(((1+current)*(1+incoming) - 1) * 100)/100
!isAdditive             → ceil(current * incoming)
```
Used for: Layer A seed merges, in-pass modifier collapse, post-pass subject merge, and `sumOwnerTotalsToTagMap`.

### 3.3 Math operations — `applyMathOp` (apply-interactions.ts:1010)
`after` for multiply-family is `roundUpAfterMultiply` (percent → 2 dp; else whole number). `add_scaled` is never rounded here.

| Op | Formula (`raw`) |
| --- | --- |
| `add_scaled` | `target + modifierValue * factor` |
| `presence_multiply` | `target * factor` (boolean presence; `modifierValue` ignored) |
| `multiply_one_plus` | percent target: `(1+target)*(1+modifierValue*factor) - 1`; else `target*(1+modifierValue*factor)` |
| `multiply` | percent target: `(1+target)*(modifierValue*factor) - 1`; else `target*(modifierValue*factor)` |

`add_scaled` vs others ordering is enforced by pass layer (see §3.4), not by op.

### 3.4 Layers, bands, passes
- `layerRank` (apply-interactions.ts:401): `pre_add`→0, `post_add`→2, everything else (`add`/null)→1.
- `LAYER_BANDS = ["pre_add","add","post_add"]` (apply-interactions.ts:2004).
- Within a band, interactions run sorted by `opTiebreak` (`add_scaled`=0 first, then other ops=1), then `id` (apply-interactions.ts:2288).
- `INTERACTION_MAX_PASSES = 8` (apply-interactions.ts:60). Each pass clobbers `next = clone(base)`, runs all bands, reads modifier values from `current`, and stops when `ownerTotalsEqual(next, current)`. The **last pass's** op steps are the ones recorded for debug.
- The pass sort key is the **modifier tag's** `layer`. A local `unique_scaling` row may override the band on the target path (`effectiveUniqueScalingLayer`, apply-interactions.ts:1173): local `layer` wins; null local → modifier tag layer; null-mod base-stat → `add`.

### 3.5 Owner buckets — `ownerKeyFor` (apply-interactions.ts:293)
```
posse → "posse"; relic → "relic"; realm → "realm"
awakenerId != null → `awakener:{id}`
else → `orphan:{sourceKind}:{id}`
```
Plus the synthetic channel `TEAM_POOL_OWNER = "*team*"` (apply-interactions.ts:89). Create rows write to `*team*`; aftereffects write to `ownerKeyFor(source subject)`, never `*team*`.

### 3.6 hitCount / copies — copy-instances.ts
```
poolContrib    = effectiveScalar(m) * instanceCount          // no copy multiply (prevents recursion)
effectiveCopies= baseCopies + Σ max(0, floor(providerPool[tagId]))   // copyProviderTagIds
hitCount       = instanceCount * effectiveCopies
Layer A–only   = poolContrib * effectiveCopies                 // layerAContribution
```
`buildLayerAProviderPool` returns `tagId → Σ poolContrib` across the input manifestations. `manifestationHitCountKey(m) = "{sourceKind}:{id}"` (copy-instances.ts:86) — the composite key avoids id collisions across source tables.

---

## 4. Layer A gate — `evaluateManifestationApply` (manifestation-apply.ts:224)

Decides which manifestations enter team totals and which become interaction subjects.

1. `isBaseStatTransfer` → always applied.
2. `sourceKind === "realm"` → `realmTagManifestationPass` then trigger gate.
   - `realmId == null` → fail (`realm`).
   - `mode === "combo"`: realm must satisfy `present`; `chaosComboStacks > 0`; not in `suppressedRealmComboIds` (prefer-effective `(familyId, tagId)` dedupe). Reason `realm` / `realm.mode`.
   - else: `realmId ∈ effectiveRealmIds`; `present` passes; `exclusive` also requires `isPure(realmId)`.
   - Attacker.* on realm rows has **no** damage-dealer check.
3. non-realm → `realmAndRequiredAwakenerPass`:
   - `requiredAwakenerId` not on team → `required_awakener`.
   - all non-null `requiredRealmId`/`2` must pass (AND); chaos uses `exclusive`, others `present` → else `realm`.
4. **Posse and relic skip the damage-dealer gate** (manifestation-apply.ts:247).
5. Attacker.* with an owner that is not in `damageDealerAwakenerIds` → `attacker.not_damage_dealer` (any `target_type`).
6. `triggerCondition != null` and count ≤ 0 → `trigger_condition`.

`ManifestationApplyContext` (manifestation-apply.ts:23) carries `teamRealms`, `teamRealmIds`, `teamIsChaosOnly`, `teamAwakenerIds`, `damageDealerAwakenerIds`, `triggerCounts`, `suppressedRealmComboIds`.

---

## 5. Pre–Layer B pipeline — `computeReviewTagTotals` order

Exact sequence (aggregate-tag-scalars.ts:197-499):

1. **Null-trigger Layer A set** — `teamData.manifestations` filtered to `!isBaseStatTransfer && triggerCondition == null && applied` (`appliedNullTrigger`).
2. **Total base stats** — `computeAwakenerTotalBaseStats(teamData, appliedNullTrigger)` (awakener-base-stats.ts:261): clone table stats → sum gear `stat`/`stat_amount` → DR (`keyflare` `ceil(15 + 144*(x-15)/(x+129))`; `aliemus` `ceil(x*(1 - (x/0.2)/(x/0.2+360)))`; `realmMastery` ceil) → apply `Special.Increase Base Keyflare/ATK/DEF` (tags 131/153/154) against a **frozen pre-boost snapshot** (additive scalars, `ceil(pre * (1+Σ) - 1e-10)`). Realm/relic increase rows hit every awakener; non-realm hit only the owner.
3. **Base-stat transfers** — `buildBaseStatTransferManifestations` (tags 16 amp/aoe, 18 crit rate/self, 17 crit dmg/self, 63 realm mastery/aoe, 28 aliemus/self, 12 death resist/aoe), absolute scalars, `isBaseStatTransfer: true`.
4. **Keyflare Harmony** — `computeKeyflareHarmonyScalar`: `perNonExalted = ceil(avg(keyflareRegen) * 2)`, `valueScalar = perNonExalted * 4`; synthetic `Support.Keyflare` (tag 37), always on.
5. `transfers = baseTransfers + harmonySynth`. `earlyScalarOpts` has no `teamMaxHp`.
6. **Death Resist derived** (death-resist-trigger.ts:120): sum tag 12 and tag 147 over `appliedNullTrigger + transfers`.
   - `reduction = min(base*0.75, 3)`; `maxHpUp = reduction/30` (tag 130).
   - `inMissionFromBase = ceil((base - reduction)*100)/100` (tag 147).
   - `cause = inMissionToCauseTrigger(inMissionFromBase + directInMission)` (tag 88): while remaining ≥ 1, +1 cause then `ceil((remaining/2)*100)/100`.
7. **Keyflare → Create.Posse** (keyflare-to-posse.ts:57): sum tag 37 and tag 155 over `appliedNullTrigger + transfers + derived`; `costPerPosse = max(1, 1000 + Σ155)`; `posseCreated = min(2, floor(Σ37 / costPerPosse))`; synthetic tag 52.
8. `allTransfers = transfers + derived + keyflarePosseSynth`.
9. **Cause → When counts** — `sumCauseTotals` over `appliedNullTrigger + allTransfers` (uses provider pool + `layerAContribution`), then `buildTriggerCounts` maps `Cause`→`When` (`88→89`, `126→128`, `142→143`, `52→129`) with `floor(sum)`. Then Lemurian synergy merge.
10. **Triggered Layer A** (`appliedTriggered`) — rows with non-null `triggerCondition` that pass the gate at `count > 0`, scaled by `triggerApplyMultiplier`.
11. `appliedBeforeTentacle = appliedNullTrigger + allTransfers + appliedTriggered`.
12. **Team Max HP** (team-max-hp.ts:81): `maxHpUpTotal` = sum tag 130 over `appliedBeforeTentacle`; `averageLevel = ceil(Σlevels/4)`; `effectiveHpLevel = accountLevel if account > avg else ceil((account+avg)/2)`; `baseline = ceil(Σcon * HpMultiplier[effectiveHpLevel])`; `bonus = ceil(baseline * maxHpUpTotal)`; `final = baseline + bonus`. Path Carver defaults: account 60, awakener level 60.
13. **Base Tentacle Damage** (base-tentacle-damage.ts:132): only when effective realm includes Aequor (id 4) or Benthos Aequor (id 5), Benthos preferred.
    - Normal Aequor: `avgAtk = Σ ceil(atk*(1+atkPer/100)) / 4`; `rawAtk = ceil(avgAtk * Ocean[level] * 0.2)`; `hpTerm = ceil(finalMaxHp*0.01) * chaosStacks`; `base = rawAtk + hpTerm`.
    - Benthos: `base = ceil(finalMaxHp*(0.05 + 0.01*chaosStacks))`.
    - `amp = ceilDamageAmpToWholePercent(Σ tag 16 over appliedNullTrigger + baseTransfers)`; `valueScalar = ceil(base*(1+amp))`.
    - Synthetic `Support.Tentacle Damage Up` (tag 29), `sourceKind: "realm"`, `targetType: null`. While active, RTM ids 5 and 30 are suppressed.
14. `fullScalarOpts` now includes `teamMaxHp`. `providerPool` over `applied`; `buildHitCountByManifestationKey`.
15. **`reviewTeamData`** = awakeners = `totalAwakeners`; manifestations = team rows excluding `isBaseStatTransfer` and suppressed RTM, plus `allTransfers + tentacleSynth`.
16. `applyInteractionsForTeamData(reviewTeamData, applied, finalMaxHp, teamRealms, hitCountMap, collectSteps)`.
17. Returned `steps` = harmony + keyflare + lemurian + tentacle special steps, then Layer B steps.

`applied` passed into Layer B = `appliedBeforeTentacle` (with suppressed RTM removed when the tentacle synthetic exists) + `tentacleSynth`.

---

## 6. Layer B pipeline — `applyInteractions` (apply-interactions.ts:2547)

### 6.0 Setup
- Record a `base` step per applied manifestation (raw vs effective scalar).
- Classify interactions (see §2.4).
- **Look-ahead closure** (`buildAftereffectClosure`, apply-interactions.ts:541):
  - `closure0` = set of `target_tag_id` from every non-disabled `aftereffect` row on applied manifestations.
  - If `closure0` empty → no deferred work (pure 3b behavior).
  - Expand `closure` via `creates_base` edges whose `modifierTagId` is already in the closure; collect those edges as `deferredCreates` and add their exact `targetTagId`.
  - `deferredStackAmplifies` = amplifies whose prefix target intersects `closure0` (e.g. `Increase Gain.Poison → Poison`).
  - `deferredCreateAmplifies` = amplifies whose prefix target intersects `closure \ closure0` (e.g. `Bleed Trigger → Bleed Damage`).
- Remove deferred create ids from the live create lists and both deferred amplify id sets from `amplifyRowsLive`.

### 6.1 Phase 1 — unrestricted creates
`unrestrictedCreatesLive` (restriction null) run via `runInteractionsForLeafContext` (leafContext null, no unique_scaling invents). They write into `*team*`. For each exact create target tag:
- build one `buildCreatedBaseManifestation` synthetic into `createdSynthetics`;
- Attacker/Defender created bases become Phase 2 subjects (not merged yet);
- Support (and other non-Attacker/Defender) created bases merge immediately into `mergedOwnerValues` (immune subjects).

### 6.2 Per-subject loop
`phase2Applied = applied + createdSynthetics`. Subject set = rows with non-zero effective scalar, sorted by `compareSubjects` (apply-interactions.ts:427): `slotIndex → awakenerId → tagId → sourceKind → id`, nulls last on `slotIndex`/`awakenerId`.

`isInteractionImmuneSubject` (effective-value-scalar.ts:364) → absolute scalar only, no inbound ops:
- Base Tentacle synthetic is **not** immune (it accepts inbound amplify).
- `isBaseStatTransfer`, `realm`, `relic` → immune.
- `isCreatedBase` and not `Attacker.`/`Defender.` → immune.

For each subject (`hitCount` from the map, default 1):
- **Immune path:** skip if `isCreatedBase` (already merged); else emit aftereffects from the raw effective scalar, then merge `scalar * hitCount`, record self BR/AD, push a `hitCount` debug step.
- **Normal path:**
  - `cohort` = `phase2Applied` minus same-`tagId` siblings, plus the subject.
  - `subjectInteractions` = `restrictedCreatesLive` + `amplifyRowsLive` (Tentacle subjects also filter out TDU-family skip modifiers, see §6.5).
  - Run `runInteractionsForLeafContext` with `leafContext = subject.sourceType`, `applyUniqueScalingInvents = true`, `uniqueScalingMatchInteractions = input.defaultInteractions`. This resolves `finishedOnce` for the subject's own tag on a **single-hit** base.
  - Emit aftereffects from `finishedOnce` (not the folded total).
  - Merge own tag as `finishedOnce * hitCount`.
  - Record `target_type=self` Birth Ritual (tag 54) and Active Damage to Bleed (tag 181) amounts per owner for the later hops.

**Aftereffect emit** (`emitAftereffects`, apply-interactions.ts:2736):
```
writeOwner = ownerKeyFor(subject)
for row in aftereffectRowsFor(subject) sorted by layer then id:
  factor       = effectiveOverrideFactor(row, 1, ownerAwakener, target.isPercent, teamMaxHp)
  op           = row.mathOperation ?? "multiply"
  contribution = op === "add_scaled" ? finishedOnce + factor : finishedOnce * factor
  merged       = contribution * hitCount
  merge into (writeOwner, targetTagId) via is_additive
```
Invent an `isCreatedBase` synthetic on the write owner only if that owner (and Layer A) lacks the tag.

### 6.3 4a — Deferred stack amplify
Per-owner snapshots of `closure0` tags from `mergedOwnerValues` (preserving `awakenerId` for `target_type=self`), then run `deferredStackAmplifies` once on `applied` (excluding closure0 tags) + snapshots. **Replace** the owner totals (not re-merge).

### 6.4 4b/4c — Deferred create + thin amplify
- **4b create:** for each `deferredCreates` modifier tag, snapshot the combined per-owner value (`combineTagAcrossOwners`) as a created base; run the create edges to write `*team*`; collect `deferredSynthetics` for exact targets.
- **4c amplify:** if `deferredCreateAmplifies` exists, run a thin amplify against `deferredSynthetics` only (leafContext null), then merge back per owner. If no deferred amplify, merge each synthetic's raw scalar.

### 6.5 4f — Special.All Tentacle Attack (all-tentacle-attack.ts:255)
Runs **before** the TDU pool hop. `generatePool` = team non-self effective scalars of tags 57 (`Generate Temporary Tentacle`) + 58 (`Generate Permanent Tentacle`). For each applied tag 180 (`Special.All Tentacle Attack`) row: `added = generatePool * effectiveScalar`, merged as `Attacker.Tentacle` on the holder's owner; synthetic inherits the ATM `target_type`/`sourceType`.

### 6.6 4d — Tentacle TDU pool, Hit, Poison, crit, Vulnerability (apply-interactions.ts:3160)
Runs when there are Tentacle units or Hit channels.
- `tentacleUnits` = per-owner `Attacker.Tentacle` (tag 5) from `mergedOwnerValues` (excluding `*team*`).
- `hitSynthetics` = `buildHitTentacleSynthetics` (hit-tentacle-attack.ts:597): one channel per (Active Damage owner × Hit channel). Realm Hit rows are summed per owner; each non-realm `Special.Hit = Tentacle Attack` (tag 151) row is its own channel; `hits` = Σ Layer A hitCounts of the owner's Active Damage family.
- `tentacleCritDamage` / `tentacleCritRate` computed from total-base awakeners + exact tags 17/18 (tentacle-crit.ts): `total = ceil%(Σbase/2) + Σaoe + ceil%(ΣnonAoe/4)`; skips `isBaseStatTransfer` and any row with `buffTargetTypeRestriction != null`. Rate is display-only.
- TDU family pool per owner (`combineTduFamilyPoolBreakdown`): exact tags 122 (Unique TDU) + 29 (TDU) + 75 (TDU.Fixed); self modifiers count only for their owner, non-self/realm/*team* count for everyone.
- Poison: `Attacker.Poison.Fixed` (tag 71) product = owner attacks × combined `Special.Tentacle Hit = Poison` (tag 165) factor.
- Emit products:
  - Unit owners: `product = ceil(units * 1 * pool)`, **set** owner value.
  - Hit channels: `product = ceil(hits * factor * pool)`, **merge**.
  - Each product: Tentacle Crit Damage `multiply_one_plus` (`ceil(product*(1+critDmg))`), then remaining Tentacle amplify rows (e.g. Vulnerability) via a thin subject run. TDI 3/75/77 (TDU-family skip ids) never run on Tentacle subjects.

### 6.7 4g — Special.Active Damage to Bleed (active-damage-to-bleed.ts:103)
Uses the finalized owner totals and the recorded `target_type=self` tag-181 amounts:
- Team scope = merged tag-181 total − recorded self total; pool = all owners' `Attacker.Active Damage` family (**no** Tentacle); `conversion = ceil(pool * rate)`.
- Self scope per owner = that owner's tag-181 self total × that owner's own Active Damage pool.
- Writes `Attacker.Non-Active Damage.Bleed Damage` (tag 158) synthetics (team → `posse` owner, self → `awakener:N`), then a thin amplify for `adToBleedAmplifies` (e.g. tag 156 `Bleed Trigger`) once. Additive merge.

### 6.8 4e — Special.Birth Ritual → Sacrifice (birth-ritual-sacrifice.ts:169)
Uses the recorded `target_type=self` tag-54 amounts:
- Team scope = merged tag-54 total − recorded self total; pool = all owners' Active Damage family **+ Tentacle** (no dedup); `sacrifice = ceil(pool * birthRitual * 0.01)` written to `*team*`.
- Self scope per owner = that owner's tag-54 self total × that owner's Active Damage only (no Tentacle).
- Additive merge into `Attacker.Non-Active Damage.Sacrifice` (tag 50).
- **Current code applies no 75 cap** — `computeSacrificeAmount` uses the raw Birth Ritual value. See §11.

### 6.9 Finalize
`sumOwnerTotalsToTagMap` (apply-interactions.ts:2361) collapses every owner bucket into one value per tag using `combineSameTagScalar` / `is_additive`, then emits a `total` debug step per tag. This is `totalsByTagId`.

---

## 7. Interaction rulebook

### 7.1 Matching
- **Modifier: exact id only** (`tagsById[modifierTagId]`; `collectModifierManifestations` filters `m.tagId === modifierTagId`). A deeper modifier tag does not inherit a parent rule.
- **Target: prefix inheritance** via `matchesDemandTag` (`matchingTargetTags`, apply-interactions.ts:1132). `creates_base` uses the **exact** `targetTagId` only (`targetsForInteraction`, apply-interactions.ts:456).
- **Exclusion:** `isExcluded` excludes the tag and all descendants (apply-interactions.ts:1116).
- Interactions **chain across passes** (e.g. Increase Gain → Support buff → damage); a later pass can read values written by an earlier one.

### 7.2 Existence gate
- `creates_base` (create) may invent Support and Attacker/Defender targets; writes to `*team*`.
- Amplify requires an existing base in the target owner's bucket (`collectBasePresentOwners`) or, for non-base-required tags, a current/next bucket or `*team*`.

### 7.3 Self-scoping (modifier `target_type`)
`computeScopedModifierValue` (apply-interactions.ts:1331): the target owner receives its own bucket in full plus other owners' **non-self** rows plus `*team*`. Other owners' `self` rows are excluded. `effectiveModifierTargetType` lets a local override change a modifier's target_type for this link.

### 7.4 `presence_multiply`
Only used for `Support.Debuff.Vulnerability → Attacker.Active Damage`. Once per `(modifierTagId, targetTagId, band)` per pass (`applyPresenceMultiplyOnce`, apply-interactions.ts:1501). Multiplies each base-present owner bucket by `factor`.

### 7.5 `unique_scaling` local rows (`applyUniqueScalingInvents`, apply-interactions.ts:2011)
One stored mode; patch-vs-invent is **inferred**:
- **null `modifierTagId` + `dependencyStat` set** → always **invent** base-stat. `modifierValue` = parent ATM awakener stat (percent deps → `stat*100`); `factor` = raw `value_scalar` (never dep-scaled again). Default op `multiply_one_plus`, default factor `1`. Layer null → `add`.
- **tag `modifierTagId`** → if a matching `tag_default_interaction` (exact modifier, prefix target, no exclusion) exists → **patch** (local op/factor/layer/disable/target_type win); else → **invent**. Invent modifier pool = **prefix** under the modifier tag (`Defender.Shield` includes `Defender.Shield.*`), scoped/combined like a normal modifier. Target = the attached manifestation only.
- Disable-only: matching default + `isDisabled` → cut the link; no default + disabled → no-op.
- Does **not** grow the modifier; it reads the current modifier total in the chosen band.

### 7.6 `direct_modifier` local rows
Self-contained per-ATM bonus on the attached ATM's single-hit base. `modifierTagId` optional (only for layer resolution/debug). `dependencyStat` optional → `modifierValue` from the owner's stat; otherwise `modifierValue = 1`. `target_tag_id` must be null; `target_type` is effectively self.

### 7.7 `aftereffect` local rows
- `modifierTagId` null; `targetTagId` required.
- `finishedOnce` = the source subject's single-hit value after `pre_add → add → post_add` (including in-band unique_scaling). **Not** the folded `finishedOnce * hitCount`.
- `contribution = op(finishedOnce, factor)`; `op` is `multiply` (default) or `add_scaled` (never `multiply_one_plus` / `presence_multiply`, which are absent from the mode's dropdown).
- Merge uses `contribution * hitCount` via `is_additive`. Write owner is always the source subject's owner.
- Rows ordered by `layer`, then `id`.

### 7.8 `buff_target_type_restriction` (leaf gating)
- On the interaction row. When set, apply only if the path's `leafContext === restriction`; otherwise skip silently (no parallel branch, no debug line).
- `leafContext` is the subject manifestation's `sourceType`, threaded through the whole chain for that subject.
- Overrides do not supply this restriction (the local table is not read for it).

---

## 8. Tag ids and constants (source of truth per module)

| Constant | Tag id | Module |
| --- | --- | --- |
| `Attacker.Tentacle` | 5 | hit-tentacle-attack.ts |
| `Attacker.Active Damage` | 42 | hit-tentacle-attack.ts |
| `Support.Tentacle Damage Up` | 29 | base-tentacle-damage.ts |
| `Support.Tentacle Damage Up.Fixed` | 75 | hit-tentacle-attack.ts |
| `Support.Unique Tentacle Damage Up` | 122 | hit-tentacle-attack.ts |
| `Support.Damage AMP` | 16 | base-tentacle-damage.ts |
| `Support.Crit Damage` / `Support.Crit Rate` | 17 / 18 | tentacle-crit.ts |
| `Special.Hit = Tentacle Attack` | 151 | hit-tentacle-attack.ts |
| `Attacker.Poison.Fixed` | 71 | hit-tentacle-attack.ts |
| `Special.Tentacle Hit = Poison` | 165 | hit-tentacle-attack.ts |
| `Special.All Tentacle Attack` | 180 | all-tentacle-attack.ts |
| `Support.Generate (Temporary/Permanent) Tentacle` | 57 / 58 | all-tentacle-attack.ts |
| `Special.Active Damage to Bleed` | 181 | active-damage-to-bleed.ts |
| `Attacker.Non-Active Damage.Bleed Damage` | 158 | active-damage-to-bleed.ts |
| `Attacker.Bleed Trigger` | 156 | (interaction data) |
| `Special.Birth Ritual` | 54 | birth-ritual-sacrifice.ts |
| `Attacker.Non-Active Damage.Sacrifice` | 50 | birth-ritual-sacrifice.ts |
| `Support.Keyflare` | 37 | keyflare-to-posse.ts |
| `Support.Create.Posse` | 52 | keyflare-to-posse.ts |
| `Special.When.Posse` | 129 | trigger-condition.ts |
| `Special.Increase Posse Keyflare Cost` | 155 | keyflare-to-posse.ts |
| `Special.Increase Base Keyflare` | 131 | awakener-base-stats.ts |
| `Special.Increase Base ATK` / `DEF` | 153 / 154 | awakener-base-stats.ts |
| `Defender.Base Death Resist` | 12 | death-resist-trigger.ts |
| `...In Mission Death Resist` | 147 | death-resist-trigger.ts |
| `Special.Cause.Death Resist Trigger` | 88 | death-resist-trigger.ts |
| `Defender.Max HP Up` | 130 | death-resist-trigger.ts |
| Base-stat transfer tags | 16,18,17,63,28,12 | awakener-base-stats.ts |
| RTM suppressed by tentacle synth | 5, 30 | base-tentacle-damage.ts |
| Aequor / Benthos realm ids | 4 / 5 | realm.ts |
| Chaos realm id | 1 | realm.ts |

Cause→When pairs (trigger-condition.ts:29): `88→89`, `126→128`, `142→143`, `52→129`. `Pursuit (109→108)` is intentionally omitted.

---

## 9. Review Tags debug (`steps`)

`ScalarMathStep` (`apply-interactions.ts:120`) kinds: `base`, `op`, `hitCount`, `aftereffect`, `special`, `total`. The Review Tags debug UI groups `op` steps by `subjectKey`/`subjectLabel`; synthetic subject keys include:
- `phase1-create` (Phase 1 creates), `deferred-create`, `deferred-stack-amplify`, `deferred-amplify`, `active-damage-to-bleed-amplify`.
- Tentacle hops push their own `special` labels: `Special.Hit = Tentacle Attack`, `Tentacle TDU pool`, `Special.Tentacle Hit = Poison`, `Tentacle Crit Rate`, `Tentacle Crit Damage`.

**Standing merge rule:** only the committed merge blocks count toward a tag's Tag total; intermediate hops that **replace** owner totals (deferred stack amplify, deferred create, Tentacle TDU pool / Hit) are shown as their own blocks and must reconcile to the `total` step. If you add a synthetic hop that replaces a total, mark the prior blocks intermediate so the debug merge still equals the Tag total.

---

## 10. Editor gotchas

- **Single-hit vs folded:** Layer B subjects always finish on a single-hit base; `hitCount` is applied only at merge. Never bake `hitCount` into `valueScalar` before Layer B.
- **Aftereffect timing:** use `op(finishedOnce, factor)`, then `× hitCount` at merge. Do not `op(finishedOnce * hitCount, factor)`.
- **Aftereffect owner:** always `ownerKeyFor(source subject)`. Never invent a second `*team*` bucket for aftereffects (the `*team*` exception is only the Phase 1 / deferred create hop).
- **Layer timing:** the **modifier tag's** `layer` drives pass order, except a local unique_scaling `layer`, which wins for its target path.
- **Rounding:** dependency scaling ceils (percent tag → 2 dp, else whole); multiply-family ops ceil (percent → 2 dp, else whole); `add_scaled` and flat/unscaled paths do not ceil. Tentacle products use `Math.ceil`.
- **`isAdditive` default is additive** (`tag.isAdditive !== false`). Non-additive percent merges fold `(1+v)`.
- **Immune subjects:** `isBaseStatTransfer`, `realm`, `relic`, and Support created bases contribute absolute scalars only; they still act as modifiers in other subjects' cohorts.
- **Relic** is exempt from the damage-dealer gate and is interaction-immune; **posse** is exempt from the gate but is a normal subject.
- **Combo realm scaling** multiplies realm effective scalars by `chaosComboStacks`; non-chaos `realm.replace` keeps combo gates (family presence) but Primordia/chaos replacers zero the stacks.
- **`enemy_max_hp`** never scales for ATM/covenant/wheel/override; it is percent-ceiled to 2 dp because it represents a % of enemy max HP.

---

## 11. Plan-vs-code discrepancies (verify before trusting the phased plan)

These are places where `simulator_phased_plan_7b0fcf95.plan.md` no longer matches the code:

1. **`source_type` has 5 values**, including `buff`, added by `supabase/migrations/20260830120000_add_source_type_buff.sql`. Phase 3g's "remaining labels are command card / exalt / rouse / talent" is stale. Kit Reader supports `buff`.
2. **`operation_type` has 4 values**, including `multiply` (aftereffect default). Phase 2a's "only these three" list is stale.
3. **Birth Ritual is uncapped in the code.** `computeSacrificeAmount` (birth-ritual-sacrifice.ts:121) uses the raw Birth Ritual value; there is no `min(raw, 75)`. The plan's Phase 3i "capped at 75 team-wide" is not implemented here. Confirm intent before "fixing".
4. **Relic exemption:** `evaluateManifestationApply` skips the damage-dealer gate for both posse and relic, and `isInteractionImmuneSubject` marks relic immune. The plan usually mentions only posse.
5. **`Manifestation.targetType` is nullable** in TS although the DB enum/default is `aoe`; code treats null as non-self.

---

## 12. File responsibility map

| Stage | Primary file(s) |
| --- | --- |
| Orchestration / order | `aggregate-tag-scalars.ts` (`computeReviewTagTotals`) |
| Layer A gate | `manifestation-apply.ts` |
| Effective scalar + `dependency_stat` | `effective-value-scalar.ts` |
| Same-tag combine | `combine-same-tag-scalar.ts` |
| Copies / hitCount | `copy-instances.ts` |
| Total base stats / transfers | `awakener-base-stats.ts` |
| Team Max HP | `team-max-hp.ts`, `account-level-hp-multipliers.ts` |
| Death Resist / Max HP Up / Cause | `death-resist-trigger.ts`, `trigger-condition.ts` |
| Keyflare harmony / posse | `keyflare-harmony.ts`, `keyflare-to-posse.ts` |
| Base tentacle | `base-tentacle-damage.ts`, `ocean-damage-multipliers.ts` |
| Layer B + all hops | `apply-interactions.ts` |
| Tentacle Hit / TDU / Poison | `hit-tentacle-attack.ts` |
| Tentacle crit | `tentacle-crit.ts` |
| All Tentacle Attack | `all-tentacle-attack.ts` |
| AD → Bleed | `active-damage-to-bleed.ts` |
| Birth Ritual → Sacrifice | `birth-ritual-sacrifice.ts` |
| Realm resolution | `team-data/resolve-team-realms.ts`, `team-data/realm.ts` |
| Tag prefix matching | `simulator/tag-matching.ts` |
| Debug rendering | `components/path-carver/review-tags-math-debug.tsx` |
| UI entry | `components/path-carver/review-tags-step.tsx` |

**Out of scope:** Phase 4 (`desire_demand`, radar, simulator port, Calculation List layer breakdown) and Phase 5 (smart recommend). Do not wire `src/lib/simulator/aggregate-tags.ts` / `fulfillment.ts` into this pipeline without an explicit new plan.
