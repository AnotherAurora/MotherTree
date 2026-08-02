---
name: Simulator Phased Plan
overview: Path Carver–first roadmap. Phase 1–2c.1 done. Next is Phase 3 (manifestation-local override/unique_scaling/aftereffect + subject scheduling). Phase 4 ports math to desire_demand/radar/simulator, Calculation List layer breakdown, Corrosion/Embers Non-Active parent+descendants + name→id. Phase 5 smart recommend.
todos:
  - id: seed-data
    content: Create scripts/seed-simulator-data.ts with 2-3 desires, demand rows, anchored awakeners; add npm script
    status: completed
  - id: fulfillment-engine
    content: Implement src/lib/simulator/ tag matching, aggregation, fulfillment curves, entity ban filter
    status: completed
  - id: extend-team-load
    content: Extend loadTeamData for posse, wheels, covenant with unified Manifestation type
    status: completed
  - id: start-flow-ui
    content: Build Start modal (awakener → all desires), wire generateTeamForDesire + path state
    status: completed
  - id: path-carver-shell
    content: Path Carver page — Build / Review Tags / Review Demands, load/save desire bundle
    status: completed
  - id: review-tags-realm-apply
    content: Realm-based manifestation apply filter + Review Tags debug table
    status: completed
  - id: review-tags-target-type-self
    content: Phase 2a — Attacker.* damage-dealer gate + target_type=self + interactions (exact modifier, target prefix, exclusion, multi-pass chain); filtered rows Applied=no in debug; no buff-restriction branching
    status: completed
  - id: buff-target-type-restriction
    content: Phase 2b — dependency_stat → value_scalar (ATM/override/covenant/wheel; ignore posse + team/enemy max HP); then buff_target_type_restriction gated by leaf manifestation source_type (one calculation path; Scalar Sum math shows extra line only when restriction met)
    status: completed
  - id: keyflare-to-posse
    content: Phase 2b.4 — Support.Keyflare → Support.Create.Posse (cost 1000 + Special.Increase Posse Keyflare Cost; max 2; non-consuming; before Cause→When)
    status: completed
  - id: keyflare-harmony
    content: Phase 2b.5 — Keyflare Harmony always-on Support.Keyflare (team-avg post–Increase keyflare_regen × 8; aoe; accumulating)
    status: completed
  - id: base-tentacle-damage
    content: Phase 2b.6 — Base Tentacle Damage synthetic (aequor ATK×Ocean + HP×chaos; benthos 5% HP + chaos; AMP last; suppress RTM 5/30)
    status: completed
  - id: damage-layers-formula
    content: Phase 2c — Pass order by modifier tag.layer; datapatch layer f→z; rename DB layer enum; replace temp add-then-multiply; rename manifestation_interaction_override → awakener_local_manifestation_interaction; smoke + math-debug layer
    status: completed
  - id: remove-layer-final-enum
    content: Phase 2c.1 — Remove leftover layer enum value final (datapatch any final→post_add; recreate enum type with pre_add/add/post_add only; swap columns; regenerate types) without losing tag.layer data
    status: completed
  - id: manifestation-local-interactions
    content: Phase 3 — Manifestation-local modes override/unique_scaling/aftereffect (creates_base, target_tag_id, layer); attached-manifestation scope; local wins; aftereffect after post_add by mode (no final layer); deferred global amplify; deterministic subject order
    status: pending
  - id: layer-breakdown-ui
    content: Phase 4 — Wire Summary / Calculation List to show layer-by-layer breakdown
    status: pending
  - id: desire-demand-radar-port
    content: Phase 4 — Wire Path Carver math into desire_demand fulfillment / simulator radar / Summary
    status: pending
  - id: radar-simulated-output
    content: Phase 4 — Radar fulfillment % from simulated demand outputs (not raw scalars)
    status: pending
  - id: generate-recommend
    content: Phase 4/5 — Greedy generate/recommend polish on simulator using shared engine
    status: pending
  - id: debug-panels-fulfillment
    content: Phase 4 — Wire simulator Summary to desire_demand fulfillment
    status: pending
  - id: fix-corrosion-embers-nonactive
    content: Phase 4 — Special Corrosion/Embers Non-Active capacity = parent + descendants; rewire conversion/debuff/capacity/sinks from tag names to tag ids
    status: pending
isProject: false
---

# Recommendation System — Path Carver–First Roadmap

## Strategic shift (locked)

Path Carver’s **Review Tags** page is the primary surface for testing recommendation math. Simulator Start / Recommend / radar / `desire_demand` fulfillment come **after** Path Carver math stabilizes (Phase 4); the simulator will copy Path Carver logic.

| Focus now (2c.1 → 3)                                                                               | Later (Phase 4+)                                   |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Path Carver Review Tags apply + aggregation + interactions                                         | Simulator radar / fulfillment UI                   |
| Pass-order layers + `awakener_local_manifestation_interaction` rename (2c)                                        | Full `desire_demand` scoring / curves              |
| Manifestation-local unique_scaling / aftereffect + subject scheduling (3)                          | Port math into Simulator page                      |
| `dependency_stat` scalar scaling + leaf-gated `buff_target_type_restriction` (2b, done)           | Smart search / recommend optimization              |
| Layer pass order (2c) + drop leftover `final` enum via recreate (2c.1)                             | Calculation List layer breakdown                   |
| Special Corrosion/Embers (exact Non-Active; keyed by name)                                         | Non-Active parent+descendants + wire by tag id     |

---

## Current baseline (as of this rewrite)

### Done

| Area                         | Status                                                                                                                                                                                                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Simulator Phase 1 core       | Seed script, `loadTeamData` (+ gear), Start flow, generate/recommend engines, entity bans, fulfillment module exist                                                                                                                                                                         |
| Path Carver shell            | `/path-carver` under TOOLS; Build → Review 1 → Review 2; load/save `desire` + template + anchors + demands                                                                                                                                                                                  |
| Anchors + `is_damage_dealer` | Build-step toggles; persisted on `desire_anchored_awakener`                                                                                                                                                                                                                                 |
| Review Tags                  | `loadTeamData` → realm apply filter → scalar sum by `tag.id`; debug table shows Applied / `target_type` / etc.                                                                                                                                                                              |
| Realm apply                  | [`manifestation-apply.ts`](src/lib/path-carver/manifestation-apply.ts) — `required_realm` / `required_realm2`                                                                                                                                                                               |
| Interaction column rename    | `tag_default_interaction.source_type` → `buff_target_type_restriction` ([migration](supabase/migrations/20260718120000_rename_tag_default_interaction_source_type.sql); reflected in [`schema-config.ts`](src/lib/schema-config.ts) and [`DefaultInteraction`](src/lib/team-data/types.ts)) |

### Not done (next work)

| Area                                       | Status                                                                                                                      |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `target_type` apply rules                  | Loaded and shown in debug; **not applied** in aggregation                                                                   |
| Interaction application                    | `tag_default_interaction` + overrides loaded in `TeamData` but **not applied**                                              |
| `dependency_stat` → `value_scalar`         | **Phase 2b done** — ATM/covenant/wheel/override scaled; posse + team/enemy max HP ignored                                   |
| `buff_target_type_restriction` leaf-gating | **Phase 2b done** — materialize-then-amplify + `creates_base` / `amplifies_subject`; Option B subject `source_type` context |
| Pass-order damage layers                   | **Phase 2c done**                                                                                                           |
| Remove leftover `layer.final` enum value       | **Phase 2c.1 done**                                                                                                     |
| Manifestation-local unique_scaling / aftereffect | Deferred to Phase 3                                                                                                   |
| Calculation List layer breakdown           | Deferred to Phase 4                                                                                                         |
| Simulator using Path Carver math           | Port in Phase 4                                                                                                             |
| Corrosion/Embers Non-Active + wiring       | Deferred to Phase 4 — parent+descendants capacity; rewire name→id                                             |

---

## `tag_default_interaction` domain model (locked)

Global rulebook: when the **modifier** tag is present on the team, change **target** tag values via `math_operation` + `default_factor` (subject to overrides, self-scoping, buff restriction, etc.).

### Matching rules

| Side                        | Rule                                                                                                                                                                                                                             |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Modifier**                | **Exact-only** on modifier tag (`modifier_tag_id` / tag name). Having `Support.Crit Damage.Something` does **not** satisfy a row whose modifier is `Support.Crit Damage`.                                                        |
| **More specific modifiers** | A deeper modifier tag is a separate, more restricted rule. Example: `Support.Final Damage.Strike` only applies via its own rows (e.g. → `Attacker.Active Damage.Strike`), not by inheriting a parent `Support.Final Damage` row. |
| **Target**                  | **Prefix inheritance** — a rule targeting `A.B` applies to `A.B` and descendants `A.B.*`.                                                                                                                                        |
| **`exclusion_suffix`**      | Exclude that tag **and its descendants** from the target match set. Example: target `Attacker.Active Damage`, exclusion `Attacker.Active Damage.Fixed Damage` → Strike/Blast/etc. match; Fixed Damage and its children do not.   |

### Chaining

Interactions **can chain** across **multiple passes** (e.g. Increase Gain → Support buff → Attacker damage). A later pass may use values updated by an earlier pass.

### Existence gate + `creates_base` / `amplifies_subject`

| Flag / target                                                | Rule                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`creates_base = true`** (with `amplifies_subject = false`) | Modifier **materializes** target as a synthetic base (Phase 1). May invent Support **and** Attacker/Defender sinks. Writes into a synthetic channel (`*team*`), never into existing subject owner buckets. Example: Fiamma → Final Damage; Generate → Tentacle. |
| **`amplifies_subject = true`** (with `creates_base = false`) | Apply once per matching **existing** subject (Phase 2). Target must be Layer A or created-base present. Example: STR Up → each Active Damage; Increase Gain must not invent STR Up.                                                                             |

Intended pairs only (XOR). Same polarity is soft-warned in admin. Defaults: `creates_base=false`, `amplifies_subject=true`.

Prefix / exclusion still apply per matched tag (Strike base-present does not create parent Active Damage). Special Corrosion / Embers conversions are outside this rule.

**Examples:**

- `Support.STR Up` → `Attacker.Active Damage` with no Active Damage base → **skip** (no phantom).
- `Support.Fiamma` → `Support.Final Damage` (`creates_base`) → synthetic Final base → `Attacker.Active Damage` (`amplifies_subject`) → **allowed**.
- `Support.Increase Gain.STR Up` → `Support.STR Up` (`amplifies_subject`, no STR Up base) → **skip**.
- `Support.Create.Insight` → `Support.Draw` (`creates_base`) → Draw merged into Review Tags.
- `Support.Generate Permanent Tentacle` → `Attacker.Tentacle` (`creates_base`) → Tentacle subject invented.

### Pipeline (materialize then amplify)

1. **Phase 1 — unrestricted `creates_base`**: run create rows with null restriction; emit synthetic manifestations; Support created bases merge into totals (immune subjects); Attacker/Defender created bases become Phase 2 subjects.
2. **Phase 2 — per subject**: restricted `creates_base` as scoped seed (path-local, not globally merged), then `amplifies_subject` only. `leafContext = subject.sourceType`. Merge only the subject’s `tagId`.
3. **Special conversions** once on merged totals.

Subjects = Layer A applied + created Attacker/Defender synthetics. Cohort excludes same-`tagId` siblings and includes created-base synthetics as modifiers.

### `buff_target_type_restriction` (on the interaction row)

Renamed from the old `source_type` column on `tag_default_interaction` (oversight fix). Distinct from manifestation `source_type`.

**Locked model (Option B — subject context, one path only):**

- Do **not** compute both “restriction met” and “restriction unmet” totals in parallel.
- When calculating for a **subject** manifestation, carry that manifestation’s `source_type` as **leaf context** for the whole interaction chain.
- Restricted `creates_base` rows apply only when `leafContext` matches (scoped seed on that subject path).
- If restriction is **null**, unrestricted creates run in Phase 1; amplify rows apply regardless of leaf `source_type` (subject to other rules).
- Restriction does **not** live on `awakener_local_manifestation_interaction` (renamed from `manifestation_interaction_override` in Phase 2c) for now (may be added later). Gate using `tag_default_interaction.buff_target_type_restriction` only.
- Example: subject is an `Attacker.Active Damage` contribution with `source_type == command card`. Restricted `Support.Enhance → Support.Final Damage` **applies** as a scoped Final seed on this path; same seed with a tentacle subject **skips**. Downstream `Support.Final Damage → Attacker.Active Damage` (`amplifies_subject`) still applies when its other rules pass.
- Review Tags tag list: still one scalar per tag for the current team calculation (no per-branch columns).
- **Debug — Scalar Sum math:** if a restricted interaction **applied** (restriction met for this subject), show **one extra** calculation line; if skipped due to restriction, **no** extra line for that interaction.

**Phase ownership:** `dependency_stat` → effective `value_scalar`, materialize-then-amplify, `creates_base` / `amplifies_subject`, and leaf-gated buff restriction are **Phase 2b** (redesigned). Phase 2a applied interactions without dependency scaling and without buff-restriction gating (2a ignored non-null restrictions — already implemented).

### Temporary operation order (2a / 2b only)

Assume **`add_scaled` first, then `presence_multiply` / `multiply_one_plus`**. Special conversions run as their own step (see below).

This order is **incorrect long-term**. Phase **2c** replaces it with pass order driven by the **modifier** tag’s `layer` (`pre_add` / `add` / `post_add` only). Aftereffects are Phase 3 **mode** timing, not a fourth layer.

### `math_operation` formulas (locked)

Enum values (only these three): `presence_multiply`, `add_scaled`, `multiply_one_plus`.

Dropped: `add_to_base_value`, `add_to_multiplier`, `compound_multiplier`, `add_hits`, `subtract`.

| Op                  | Formula                                               | Notes                                                                                                                      |
| ------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `presence_multiply` | if modifier present (≥1 / exists): `target *= factor` | **Only** `Support.Debuff.Vulnerability → Attacker.Active Damage`. Unique / Tentacle Vulnerability use `multiply_one_plus`. |
| `add_scaled`        | `target += modifier_value * factor`                   | Flat additive scale (e.g. STR Up → Active Damage).                                                                         |
| `multiply_one_plus` | see `tag.is_percent` below                            | Replaces old compound / add_to_multiplier.                                                                                 |

**`multiply_one_plus` with `tag.is_percent`:**

```text
contribution = modifier_value * factor
if target.is_percent:
  target = (1 + target) * (1 + contribution) - 1
else:
  target = target * (1 + contribution)
```

`is_percent` lives on `tag` (fractional bonus where `0` means no bonus). Percent-seeded prefixes include `Support.Final Damage`, `Support.Enhance`, `Support.Increase Gain`, `Support.Crit Damage`, `Support.Crit Rate`, `Support.Damage AMP`, `Support.Base Damage`, plus exact tags `Support.Aliemu`, `Support.Embryo Fusion`, `Support.Fiamma`, `Support.Propagation Fiesta`, `Support.Take Effect Again`.

### Special conversions (locked; not `tag_default_interaction`)

Corrosion / Ancient Embers consume+transfer is **not** driven by interaction rows (those rows are soft-deleted). Engine applies hardcoded conversion rates (table uses names as labels; **Phase 2a** keys tags by **name** via `findTagIdByName` / `m.tagName ===`):

| Special tag                         | Debuff                          | Consume sources                                                  | Transfer                                   |
| ----------------------------------- | ------------------------------- | ---------------------------------------------------------------- | ------------------------------------------ |
| `Special.Corrosion Conversion`      | `Support.Debuff.Corrosion`      | Active Damage ×1, Tentacle ×1, Non-Active Damage ×0.5; clamp ≥ 0 | lost ×3 → `Attacker.Corrosion Damage`      |
| `Special.Ancient Embers Conversion` | `Support.Debuff.Ancient Embers` | same consume rates                                               | lost ×3 → `Attacker.Ancient Embers Damage` |

```text
lost = min(debuff, sum(source_i * rate_i))
debuff -= lost
damage_tag += lost * 3
```

Phase 2a implements these Special conversions alongside interaction ops (interaction rows for this behavior are gone). Non-Active capacity currently uses the **exact** parent tag only — provisional. **Phase 4** (1) rewires conversion gate, debuff, Active, Tentacle, Non-Active **parent**, and Corrosion/Embers damage sinks to **numeric tag id** constants (same pattern as Death Resist / Keyflare — ids are the contract); (2) widens Non-Active capacity to **parent id + descendants** (look up parent `tag_name` from `tagsById`, then prefix-sum children — do not hardcode Poison Damage ids). Do **not** roll child sinks into the parent via `tag_default_interaction` (keeps Poison Trigger scoped to its own sink). Active Damage and Tentacle capacity stay exact (by id). Prefix gates (`Attacker.*` / `Defender.*`) and interaction target prefix matching stay name-based.

### Manifestation-local interactions (current vs planned)

**Today (through 2b):** table `manifestation_interaction_override` can change `value_scalar` / op / `target_type` / `dependency_stat` or disable (`is_disabled`) a synergy link for a specific manifestation. It only patches a matching `tag_default_interaction`; it cannot invent rules or create bases. Effective `value_scalar` (after `dependency_stat` scaling in Phase 2b) is resolved before interaction ops consume it.

**Phase 2c:** rename table → `awakener_local_manifestation_interaction` (behavior unchanged aside from pass-order layers).

**Phase 3:** expand into manifestation-local `unique_scaling` / `aftereffect` (see Phase 3).

---

## Phase 2a — Review Tags math: Attacker damage-dealer gate + `target_type = self` + interactions (DONE)

### Goal

Extend Path Carver Review Tags so team tag totals and interaction effects respect **`is_damage_dealer` for all Attacker.\* tags**, **`target_type = self` for non-Attacker scoping**, and a first-pass **interaction resolver** (exact modifier, target prefix, exclusion, multi-pass chain, self-scope), with full debug visibility of filtered rows.

Primary files: [`manifestation-apply.ts`](src/lib/path-carver/manifestation-apply.ts), [`aggregate-tag-scalars.ts`](src/lib/path-carver/aggregate-tag-scalars.ts), new `apply-interactions.ts`, [`review-tags-step.tsx`](src/components/path-carver/review-tags-step.tsx), [`review-tags-debug.tsx`](src/components/path-carver/review-tags-debug.tsx).

### Locked decisions

| #   | Decision                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Work only on Path Carver Review Tags math; simulator copies later (Phase 4)                                                         |
| 2   | For **non-Attacker** tags: implement **`self` scoping** this phase; `single` / `aoe` keep applying if realm rules pass              |
| 3   | Two layers: (A) filter which manifestations enter **team tag totals**; (B) apply **interactions** with self-scoping                 |
| 4   | Attacker gate: tag name **starts with `Attacker.`**                                                                                 |
| 5   | **Attacker.\* never applies unless owner is `is_damage_dealer`** — for **all** `target_type` values (`self`, `single`, `aoe`, null) |
| 6   | No damage dealers marked → **no** Attacker.\* contributions (any target_type)                                                       |
| 7   | **Posse:** skip both `target_type` and damage-dealer gates (realm only); column kept for future behavior                            |
| 8   | All filtered-out manifestations **remain visible** in Review Tags debug with **Applied = no** (+ reason). Never hide filtered rows  |
| 9   | **`dependency_stat` scaling + leaf-gated `buff_target_type_restriction` → Phase 2b** (not in 2a)                                    |
| 10  | Interaction matching: **exact modifier**, **prefix target**, **exclusion = tag + descendants**, **multi-pass chain**                |
| 11  | Temporary op order: `add_scaled` then `presence_multiply` / `multiply_one_plus` (replaced in 2c)                                    |
| 12  | Implement locked `math_operation` formulas + `tag.is_percent` branch; Special Corrosion/Embers conversions by tag name              |

### Apply context extensions

Extend `ManifestationApplyContext` (or sibling types) with:

```ts
damageDealerAwakenerIds: Set<number>; // from Build-step anchors where isDamageDealer === true
// Plus per-manifestation ownership: awakenerId / slotIndex already on Manifestation
```

Pass `anchoredAwakeners` from Path Carver Build state into Review Tags (create and edit) so apply math uses live toggles before Save.

### Layer A — Manifestation filter for team totals

After existing realm rules, for each manifestation:

```
owner = awakener who owns this manifestation
        (awakener row, or wheel/covenant on that slot; null for posse)

if sourceKind === "posse":
  // Posse skips target_type and damage-dealer gates (future TBD)
  include if realm OK

else if tagName starts with "Attacker.":
  // Applies for ANY target_type (self / single / aoe / null)
  include ONLY if owner.id ∈ damageDealerAwakenerIds
  (if damageDealerAwakenerIds is empty → never include Attacker.*)
  reason when excluded: attacker.not_damage_dealer

else if targetType === "self":
  // Support.*, Defender.*, etc. with self — base scalar still counts
  // as that owner's contribution; interaction scoping is Layer B
  include if realm OK

else: // single | aoe | null (non-Attacker)
  include if realm OK
```

**Clarification for Support/Defender self scalars:** Base `value_scalar` on a self-targeted Support/Defender manifestation still counts toward that tag’s team total (it is that awakener’s contribution). What must **not** leak team-wide is **interaction modification** of other awakeners’ tags (Layer B).

**Attacker.\* + non-dealer (any target_type):** exclude from totals entirely; debug row stays listed with Applied = no.

### Layer B — Interaction application (2a MVP)

When resolving `tag_default_interaction` (+ overrides) for Review Tags math:

**Matching (locked):**

1. Load interactions already present on `TeamData`
2. **Modifier match: exact-only** (modifier tag name / id must match exactly)
3. **Target match: prefix inheritance** — reuse / share [`tag-matching.ts`](src/lib/simulator/tag-matching.ts) for targets; apply `exclusion_suffix` as exclude tag **and descendants**
4. Respect overrides + `is_disabled`
5. **Multi-pass chaining** until stable or a fixed pass limit (document limit in code)
6. **Self-scoping:** if the **modifier** manifestation (or effective `target_type` after override) is `self`, the interaction only modifies tags belonging to the **same owner awakener** (their awakener / wheel / covenant manifestations)
7. **Buff restriction:** do **not** implement branching in 2a — ignore non-null `buff_target_type_restriction` or skip those rows until 2b (pick one approach and document in code comments)
8. **Temporary op order:** `add_scaled` first, then `presence_multiply` / `multiply_one_plus` (placeholder until 2c)
9. **Ops:** implement `presence_multiply`, `add_scaled`, `multiply_one_plus` with `tag.is_percent` offset form; only Vulnerability uses `presence_multiply`
10. **Special conversions:** apply Corrosion / Ancient Embers conversion when the corresponding `Special.* Conversion` tag is in play (hardcoded rates above)
11. Output adjusted per-tag totals used by Review Tags list + debug

**Examples:**

- `Support.Increase Gain.Shield` with `self` only increases that awakener’s `Defender.Shield` / `Defender.Shield.*` — not other teammates’.
- `Support.Crit Damage` on self does not raise another awakener’s damage; any resulting Attacker.\* contribution still must pass the Layer A damage-dealer gate.

Defer: dependency_stat scaling + leaf-gated buff restriction (2b), pass-order layers (2c), manifestation-local unique_scaling/aftereffect (3), Summary layer breakdown (4).

### Debug UX

**Requirement:** every manifestation loaded for the team appears in the Review Tags debug section. Filtering only changes Applied / totals — it must **not** remove rows from the debug tables.

Each row shows:

- Applied yes/no
- Reason when no: e.g. `realm`, `attacker.not_damage_dealer`

Optional: show which interactions applied to which target tags (lightweight; full Calculation List in Phase 4).

### Files to touch (Phase 2a)

| File                                                                                                   | Change                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`src/lib/path-carver/manifestation-apply.ts`](src/lib/path-carver/manifestation-apply.ts)             | Damage-dealer set; Attacker.\* gate for all target_types; `target_type=self` for non-Attacker scoping; posse exception; apply reasons                  |
| [`src/lib/path-carver/aggregate-tag-scalars.ts`](src/lib/path-carver/aggregate-tag-scalars.ts)         | Use new apply rules; hook interaction-adjusted totals (exclude Applied=no from sums)                                                                   |
| New `src/lib/path-carver/apply-interactions.ts`                                                        | Exact modifier / prefix target / exclusion / multi-pass / self-scope; locked ops + `is_percent`; Special conversions; temp op order; no buff branching |
| [`src/components/path-carver/review-tags-step.tsx`](src/components/path-carver/review-tags-step.tsx)   | Pass anchors / damage dealers into apply context                                                                                                       |
| [`src/components/path-carver/review-tags-debug.tsx`](src/components/path-carver/review-tags-debug.tsx) | Show **all** manifestations (including filtered); Applied + reason columns                                                                             |
| [`src/components/path-carver/path-carver.tsx`](src/components/path-carver/path-carver.tsx)             | Wire `anchoredAwakeners` into Review Tags                                                                                                              |

### Phase 2a acceptance criteria

- [x] Attacker.\* (any `target_type`) only counts when owner awakener is `is_damage_dealer` (including that slot’s wheels/covenant)
- [x] Zero damage dealers → zero Attacker.\* contribution to team totals
- [x] Non–damage-dealer Attacker.\* dropped from totals; **still listed** in debug with Applied = no + reason `attacker.not_damage_dealer`
- [x] All realm-filtered (and other filtered) manifestations remain visible in debug with Applied = no + reason
- [x] Posse manifestations ignore `target_type` and damage-dealer gates (realm rules still apply)
- [x] Non-Attacker `single` / `aoe` unchanged beyond realm filter; non-Attacker `self` base scalars still count for owner
- [x] Interactions: exact modifier match; target prefix + exclusion descendants; multi-pass chaining
- [x] Self-targeted Support (etc.) interactions only modify the owning awakener’s matching target tags
- [x] Ops: `presence_multiply` (Vulnerability only), `add_scaled`, `multiply_one_plus` with `is_percent` offset on percent targets
- [x] Special Corrosion / Ancient Embers conversions applied by Special tag name (hardcoded rates)
- [x] Review Tags scalar list uses only Applied = yes totals (after interactions)
- [x] `dependency_stat` scaling and `buff_target_type_restriction` gating **not** implemented yet (Phase 2b)

---

## Phase 2b — `dependency_stat` scaling + materialize-then-amplify + buff restriction (DONE)

**Depends on:** Phase 2a interaction resolver (done).

### Goal

1. Resolve effective `value_scalar` via `dependency_stat` (manifestations + overrides) before interaction math consumes scalars.
2. **Subject-centric evaluation:** every Layer A base (plus created Attacker/Defender synthetics) is an isolated subject; cohort excludes same-tag siblings; merge only subject tag.
3. **`creates_base` / `amplifies_subject`**: Phase 1 materializes create rows into synthetic bases (may invent Attacker/Defender); Phase 2 amplifies existing subjects only. Restricted creates are path-scoped seeds. Soft-warn when flags are equal.
4. Gate `buff_target_type_restriction` using the **subject manifestation’s `source_type`** as chain context — **one calculation path only** (no dual-branch totals).

---

### Part A — `dependency_stat` → effective `value_scalar` (locked)

#### Purpose

When `dependency_stat` is non-null, the row’s `value_scalar` is **stat-dependent**. For realm manifestations, `dependency_stat` is the **base stat/source quantity**. When `dependency_rate` and `dependency_rate_stat` are both non-null, `dependency_rate_stat` is the stat that scales the conversion rate rather than replacing the base-stat role of `dependency_stat`.

**Scope:** `dependency_rate` / `dependency_rate_stat` / `pure_bonus_target` and the rate-scaled / two-row Fiesta rules apply to **`realm_tag_manifestation` only**. Other tables use `dependency_stat` multiply only (posse ignores it).

| Table                                                                                   | Scalar column  | Notes                                                 |
| --------------------------------------------------------------------------------------- | -------------- | ----------------------------------------------------- |
| `awakener_tag_manifestation` / `covenant_tag_manifestation` / `wheel_tag_manifestation` | `value_scalar` | scale when `dependency_stat` set                      |
| `awakener_local_manifestation_interaction` (was `manifestation_interaction_override` until 2c)          | `value_scalar` | same formula (renamed from `override_default_factor`) |
| `posse_tag_manifestation`                                                               | `value_scalar` | **ignore** `dependency_stat`                          |

```text
rate_mult   = 2 when pure_bonus_target = dependency_rate and team is pure, else 1
scalar_mult = 2 when pure_bonus_target = value_scalar and team is pure, else 1

# flat (dependency_stat null, no rate pair)
effective = value_scalar * scalar_mult

# multiply-only (dependency_stat set; dependency_rate null OR dependency_rate_stat null)
# non-percent tag → ROUND UP to whole number
effective = ceil(value_scalar * scalar_mult * awakener.<stat>)

# multiply-only
# percent tag → ROUND UP to 2 decimal places
effective = ceil(value_scalar * scalar_mult * awakener.<stat> * 100) / 100

# percent dependency_stat special form (ATM/override; see list below)
effective = ceil(((value_scalar * 100) * (awakener.<stat> * 100)) * 100) / 100
# (apply scalar_mult to value_scalar first when pure_bonus_target = value_scalar)

# realm base-stat conversion with rate scaling
# (dependency_stat + dependency_rate + dependency_rate_stat all set)
# base_stat may be team_max_hp / enemy_max_hp (resolved for realm rows — not ignored)
base_rate = value_scalar * scalar_mult
raw = base_stat * (base_rate + dependency_rate * rate_stat * rate_mult)
# ROUND UP: non-percent tag → whole number; percent tag → 2 dp
effective = ceil(raw) or ceil(raw * 100) / 100
```

**Round up (ceil) is required** after dependency / pure scaling:

- Non-percent tags: ceil to a **whole number** (e.g. Enhance `15 + 0.0075 × 434 × 2 = 21.51 → 22`)
- Percent tags: ceil to **2 decimal places**
- Unscaled flat rows with no pure double stay raw (no ceil)
- ATM/override: `team_max_hp` / `enemy_max_hp` still **ignore** scaling (keep raw `value_scalar`). Realm rows that use those as `dependency_stat` **do** resolve them as `base_stat`.

If `dependency_stat` is null and there is no rate pair → flat branch above.

Do **not** encode Fiesta/Enhance as a single multiplicative row (`base × (1 + rate × RM)`). Use **two additive rows** instead (see row semantics). With `dependency_rate` set but `dependency_rate_stat` null, fall back to multiply-only (rate fields unused).

`tag_default_interaction.default_factor` is **not** a `value_scalar` and is not scaled by `dependency_stat`.

#### Row semantics

- **Flat pure double:** `value_scalar` set, `dependency_stat` null, `pure_bonus_target=value_scalar` → `value_scalar × 2` when pure
- **Current multiply:** `dependency_stat` set, `dependency_rate` null, `dependency_rate_stat` null → `ceil(value_scalar × scalar_mult × stat)`
- **Two-row Fiesta / Enhance** (preferred for `base × (1 + 0.0005 × RM × pureMult)`):
  - Base: flat `value_scalar` (e.g. 15 / 20 / 25 / 40), `pure_bonus_target=none`
  - RM: `value_scalar = base × 0.0005` (e.g. 0.0075 / 0.01 / 0.0125 / 0.02), `dependency_stat=realm_mastery`, `pure_bonus_target=value_scalar`
  - Sum then **round up**: pure RM 434 → `15 + 6.51 = 21.51 → 22`, `25 + 10.85 = 35.85 → 36`
- **Base conversion + scaling stat:** `dependency_stat=team_max_hp`, `value_scalar` base rate (or `0` for RM-only companion), `dependency_rate` + `dependency_rate_stat=realm_mastery`, `pure_bonus_target=dependency_rate` → `ceil(HP × (base_rate + rate × RM × rate_mult))`

#### Percent dependency stats

Treat these `all_stats` values as percent (both operands ×100 before multiply):

- `damage_amp`
- `crit_rate`
- `crit_dmg` (user label “crit_damage”; DB enum / awakener column is `crit_dmg`)
- `sigil_yield`
- `death_resist`

All other mapped awakener stats use the non-percent form.

#### Enum → awakener column map

| `dependency_stat`              | Awakener field on [`Awakener`](src/lib/team-data/types.ts)                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------ |
| `con` / `atk` / `def`          | `con` / `atk` / `def`                                                                            |
| `damage_amp`                   | `damageAmp`                                                                                      |
| `crit_rate`                    | `critRate`                                                                                       |
| `crit_dmg`                     | `critDmg` (never `crit_damage`)                                                                  |
| `realm_mastery`                | `realmMastery`                                                                                   |
| `keyflare_regen`               | **`keyflareRegen`** (never `skey`)                                                               |
| `aliemus_regen`                | `aliemusRegen`                                                                                   |
| `sigil_yield`                  | `sigilYield`                                                                                     |
| `death_resist`                 | `deathResist`                                                                                    |
| `team_max_hp` / `enemy_max_hp` | ATM/override: **ignore** (raw scalar). Realm rate-scaled / HP conversion: resolve as `base_stat` |

Null awakener stat → treat as `0` (effective becomes 0).

#### Owner resolution (which awakener)

```mermaid
flowchart TD
  row[Row with dependency_stat]
  row --> atm[awakener_tag_manifestation]
  row --> ov[awakener_local_manifestation_interaction]
  row --> cov[covenant_tag_manifestation]
  row --> wheel[wheel_tag_manifestation]
  row --> posse[posse_tag_manifestation]
  atm --> aid[awakener_id on ATM]
  ov --> parent[Parent ATM via manifestation_id]
  parent --> aid
  cov --> slot[Equipped slot awakener after Path Carver Build]
  wheel --> slot
  posse --> skip[Ignore dependency_stat entirely]
```

- **ATM:** `awakener_id`
- **Override:** parent ATM’s `awakener_id` (already loaded on `Manifestation.interactionOverrides` in [`load-team-data.ts`](src/lib/team-data/load-team-data.ts))
- **Covenant / wheel:** slot owner after Build (manifestation already carries `awakenerId` / `slotIndex` once equipped)
- **Posse:** ignore `dependency_stat` (always use raw `value_scalar`)

ATM and override each scale their own `value_scalar` independently.

#### Pipeline order inside Phase 2b

1. Resolve effective `value_scalar` via `dependency_stat` (tables above)
2. Run interactions with **leaf-gated** buff restriction (Part B)

Debug: Review Tags debug already shows `dependency_stat`; show **raw vs effective** `value_scalar` (or at least effective) once implemented.

---

### Part B — Leaf-gated `buff_target_type_restriction` (locked — Option B)

#### Semantics

- Interaction row field: `buff_target_type_restriction` (enum `source_type`: command card / exalt / tentacle / rouse / talent), nullable.
- **Leaf context:** when resolving values for a demand / leaf manifestation, set `leafSourceType = that manifestation.source_type` (nullable).
- Carry `leafSourceType` as context for the **entire** multi-pass interaction chain for that calculation.
- If interaction restriction is **null** → apply (subject to other 2a rules).
- If interaction restriction is **set** → apply **only if** `leafSourceType === restriction`; otherwise **skip** this interaction for this leaf (do not compute a parallel unmet branch).
- **Overrides / local rows:** do **not** read buff restriction from `awakener_local_manifestation_interaction` in 2b (column may be added later).

```
Example leaf: Attacker.Active Damage manifestation with source_type == command card

Support.Enhance → Support.Final Damage   (restriction: command card)
  → APPLIES (leaf context matches)

Support.Final Damage → Attacker.Active Damage   (no restriction)
  → APPLIES when other rules pass

Same chain for a tentacle leaf → Enhance SKIPPED; no dual totals stored
```

#### UI / debug

- Review Tags tag list: **one** scalar per tag (no per-`source_type` columns, no dual-branch aggregates).
- **Debug — Scalar Sum math** ([`review-tags-math-debug.tsx`](src/components/path-carver/review-tags-math-debug.tsx)): when a restricted interaction **applies** (restriction met for this leaf), emit **one extra** calculation line; when skipped due to restriction, **no** extra line. Existing debug layout otherwise unchanged.
- Full Calculation List remains Phase 4.

#### Implementation notes

- Replace Phase 2a stub in [`apply-interactions.ts`](src/lib/path-carver/apply-interactions.ts) that ignores non-null restrictions.
- Thread leaf `source_type` into the interaction engine when computing per-manifestation or per-leaf contributions that feed totals / math debug.
- How to aggregate multiple leaves with different `source_type` into the single Review Tags tag total: use the same overall team aggregation as 2a, but each leaf’s contribution is computed with **its own** leaf context (so command-card leaves get restricted buffs; tentacle leaves do not). Sum those contributions into the tag total — still one number in the UI.
- Part B consumes **already dependency-scaled** effective scalars from Part A.

### Acceptance criteria

**Part A — dependency_stat:**

- [x] ATM / covenant / wheel with non-null `dependency_stat` contribute scaled `value_scalar` (percent form when applicable)
- [x] Override with non-null `dependency_stat` scales its `value_scalar` the same way (owner = parent ATM awakener)
- [x] `team_max_hp` / `enemy_max_hp` leave scalar unchanged
- [x] Posse never applies dependency scaling
- [x] `keyflare_regen` → `awakener.keyflareRegen` (never `skey`); `crit_dmg` not `crit_damage`
- [x] Effective scalars feed leaf-gated interactions and downstream totals
- [x] Debug shows raw vs effective scalar (or effective clearly)

**Part B — buff restriction (Option B):**

- [x] Restricted interactions apply only when leaf manifestation `source_type` matches restriction
- [x] Unrestricted interactions still apply under other 2a rules
- [x] Leaf context is used for the whole chain (Enhance can affect Active Damage via Final Damage when leaf is command card)
- [x] No dual-branch / parallel unmet totals computed or shown in the tag list
- [x] Scalar Sum math: extra line only when restricted interaction applied; silent skip when unmet
- [x] Overrides do not supply buff restriction in 2b

---

## Phase 2b.1 — Awakener total base stats + transfer tags (Path Carver)

**Depends on:** Phase 2b.

### Goal

Replace raw `awakener` table stats for `dependency_stat` with **total base stats**, inject synthetic Support/Defender tags from selected stats, and apply Special.Increase Base Keyflare after keyflare DR.

### Locked calculation order

1. Sum per awakener: table stats + wheel1 + wheel2 + covenant (`stat` / `stat_amount` when set)
2. **keyflare_regen DR:** `Math.ceil(15 + 144 * (x - 15) / (x + 129))`
3. **aliemus_regen DR:** `Math.ceil(x * (1 - (x / 0.2) / (x / 0.2 + 360)))`
4. **Special.Increase Base Keyflare** (tag id **131**):  
   `finalKeyflare = Math.ceil(originalDr * (1 + Σ effective value_scalar))`  
   Multiple sources use the same original (additive scalars). Scale those rows with **pre-boost** totals if they have `dependency_stat`.
5. **dependency_stat** scaling uses these totals — including **post–Special.Increase** `keyflare_regen`
6. Inject synthetic manifestations (absolute `value_scalar`, `dependency_stat` null); they act as modifiers but are **immune as interaction subjects**

### Transfer tag ids

| Base stat       | Tag id | `target_type` |
| --------------- | ------ | ------------- |
| `damage_amp`    | 16     | `aoe`         |
| `crit_rate`     | 18     | `self`        |
| `crit_dmg`      | 17     | `self`        |
| `realm_mastery` | 63     | `aoe`         |
| `aliemus_regen` | 28     | `self`        |
| `death_resist`  | 12     | `aoe`         |

Keyflare is **not** transferred to a tag; it only feeds `dependency_stat` (after DR + Special.Increase).

### Primary files

- [`src/lib/path-carver/awakener-base-stats.ts`](src/lib/path-carver/awakener-base-stats.ts)
- [`src/lib/team-data/load-team-data.ts`](src/lib/team-data/load-team-data.ts) — gear `stat` / `stat_amount`
- [`src/lib/path-carver/aggregate-tag-scalars.ts`](src/lib/path-carver/aggregate-tag-scalars.ts)
- [`src/lib/path-carver/apply-interactions.ts`](src/lib/path-carver/apply-interactions.ts) — skip inbound ops for `isBaseStatTransfer`
- Smoke: `npx tsx scripts/smoke-phase-2b1.ts`

---

## Phase 2b.2 — Team Max HP (`all_stats.team_max_hp`)

**Depends on:** Phase 2b.1.

### Goal

Compute Path Carver **team Max HP** from total base CON × `AcountLevelConfig` HpMultiplier, emit synthetic **Defender.Max HP Up** (tag 130) from Death Resist reduction, and resolve `dependency_stat=team_max_hp` to `finalMaxHp`.

### Locked formula

- Defaults: account level 60, awakener levels 60; average always ÷ 4 slots
- `baselineMaxHp = ceil(sumCON * HpMultiplier[effectiveHpLevel])`
- Full 1–100 multiplier table: [`account-level-hp-multipliers.ts`](src/lib/path-carver/account-level-hp-multipliers.ts)
- DR reduction → tag 130; `bonusMaxHp = ceil(baseline * maxHpUpTotal)` (0.1 = +10%; Max HP Up is not Death Resist)
- `enemy_max_hp` remains ignored

### Primary files

- [`src/lib/path-carver/team-max-hp.ts`](src/lib/path-carver/team-max-hp.ts)
- [`src/lib/path-carver/death-resist-trigger.ts`](src/lib/path-carver/death-resist-trigger.ts)
- [`src/lib/path-carver/aggregate-tag-scalars.ts`](src/lib/path-carver/aggregate-tag-scalars.ts)
- [`src/lib/path-carver/effective-value-scalar.ts`](src/lib/path-carver/effective-value-scalar.ts)
- Smoke: `npx tsx scripts/smoke-team-max-hp.ts`

---

## Phase 2b.3 — Realm tag manifestations (`realm_tag_manifestation`)

**Depends on:** Phase 2b.1 + 2b.2.

### Goal

Load `realm_tag_manifestation` into Path Carver Review Tags as **team-once** Layer A bases (not per awakener), gated by `realm.replace` + `required_realm_mode`, scaled with realm-only dependency/pure/combo rules, and **interaction-immune** as subjects (like transfers)—except scalars still use **team Max HP** / **team Realm Mastery** as dependency inputs.

### Locked decisions

| Topic           | Lock                                                             |
| --------------- | ---------------------------------------------------------------- |
| Apply count     | One contribution per matching RTM row                            |
| Combo           | × `chaosComboStacks` on effective scalar                         |
| Replaced realms | Apply only if `realm_id ∈ effectiveRealmIds`                     |
| Chaos replaced  | Chaos RTM off; `chaosComboStacks === 0` ⇒ all `combo` off        |
| Attacker.\* RTM | Always apply when realm mode gates pass (no damage-dealer check) |
| `realm_mastery` | Σ total-base `awakener.realmMastery`                             |
| Immunity        | `sourceKind === "realm"` skips inbound interaction ops           |

### Primary files

- [`src/lib/team-data/types.ts`](src/lib/team-data/types.ts) / [`load-team-data.ts`](src/lib/team-data/load-team-data.ts)
- [`src/lib/path-carver/manifestation-apply.ts`](src/lib/path-carver/manifestation-apply.ts)
- [`src/lib/path-carver/effective-value-scalar.ts`](src/lib/path-carver/effective-value-scalar.ts)
- [`src/lib/path-carver/aggregate-tag-scalars.ts`](src/lib/path-carver/aggregate-tag-scalars.ts)
- [`src/lib/path-carver/apply-interactions.ts`](src/lib/path-carver/apply-interactions.ts)
- Smoke: `npx tsx scripts/smoke-realm-tags.ts`

---

## Phase 2b.4 — Keyflare → Create.Posse

**Depends on:** Phase 2b.1 + 2b.3.

### Goal

Derive **Support.Create.Posse** from **Support.Keyflare** in Path Carver Review Tags without reducing Keyflare totals. Base cost **1000** Keyflare per Posse; **Special.Increase Posse Keyflare Cost** (155) raises cost. Cap **2** Posse from Keyflare conversion only.

### Tag map

| Id  | Name                                   | Role                                    |
| --- | -------------------------------------- | --------------------------------------- |
| 37  | `Support.Keyflare`                     | Conversion input (unchanged in totals)  |
| 155 | `Special.Increase Posse Keyflare Cost` | Absolute add to cost                    |
| 52  | `Support.Create.Posse`                 | Conversion output; Cause for When.Posse |
| 129 | `Special.When.Posse`                   | Existing Cause→When                     |
| 131 | `Special.Increase Base Keyflare`       | `keyflare_regen` only — not posse cost  |
| 146 | `Support.Keyflare Cap Up`              | Deferred; unused                        |

### Formula

```text
costPerPosse = max(1, 1000 + Σ Special.Increase Posse Keyflare Cost)
posseCreated = min(2, floor(Σ Support.Keyflare / costPerPosse))
# Support.Keyflare not reduced
```

Runs after Death Resist derived synthetics and **before** Cause→When so When.Posse sees created count.

### Primary files

- [`src/lib/path-carver/keyflare-to-posse.ts`](src/lib/path-carver/keyflare-to-posse.ts)
- [`src/lib/path-carver/aggregate-tag-scalars.ts`](src/lib/path-carver/aggregate-tag-scalars.ts)
- Smoke: `npx tsx scripts/smoke-keyflare-to-posse.ts`

---

## Phase 2b.5 — Keyflare Harmony

**Depends on:** Phase 2b.1 + 2b.4.

### Goal

Always-on synthetic **Support.Keyflare** from team-average post–Special.Increase `keyflare_regen` × **8**. Applied to every team (no presence gate). Feeds Keyflare→Posse.

### Formula

```text
sumKeyflare = Σ (awakener.keyflareRegen ?? 0)  // after DR + tag 131
teamAverage = sumKeyflare / 4                  // empty slots = 0
valueScalar = teamAverage * 8
```

Synthetic: `target_type=aoe`, `is_accumulating=true`, `isBaseStatTransfer=true`, `sourceName="Keyflare Harmony"`.

### Primary files

- [`src/lib/path-carver/keyflare-harmony.ts`](src/lib/path-carver/keyflare-harmony.ts)
- [`src/lib/path-carver/aggregate-tag-scalars.ts`](src/lib/path-carver/aggregate-tag-scalars.ts)
- Smoke: `npx tsx scripts/smoke-keyflare-harmony.ts`

---

## Phase 2b.6 — Base Tentacle Damage (Aequor + Benthos)

**Depends on:** Phase 2b.2 + 2b.3.

### Goal

Emit synthetic **Support.Tentacle Damage Up** (tag 29) for normal Aequor and Benthos after team Max HP. Damage AMP (tag 16) applies `multiply_one_plus` / factor 1 on the **final** pre-AMP base. Suppress RTM ids **5** and **30** while the synthetic is active.

### Formulas

```text
amp   = Σ Support.Damage AMP   # Layer A pre-interaction (incl. RTM pure double)
value = ceil(baseAmount × (1 + amp))
```

**Normal Aequor** (effective has aequor id 4):

```text
avgAtk     = (Σ ceil(atk × (1 + atk_per/100))) / 4
rawAtk     = ceil(avgAtk × OceanDamageMultiplier[accountLevel] × 0.2)
hpTerm     = ceil(teamMaxHp × 0.01) × chaosComboStacks
baseAmount = rawAtk + hpTerm
```

Verified (Lv80, HP 1724, chaos 3, amp 0): **116**.

**Benthos Aequor** (effective has benthos id 5; ATK/Ocean unused):

```text
baseAmount = ceil(teamMaxHp × (0.05 + 0.01 × chaosComboStacks))
```

Verified (HP 1560, chaos 3, amp 1.0 from RTM 31 pure): **250**.

### Locked defaults

- `atk_per = 0`; `accountLevel = DEFAULT_ACCOUNT_LEVEL` (60)
- Ocean step table: 1–25→1.00 … 60–69→1.80 … 70+→1.90
- Hardcoded AMP (no TDI); realm synthetic is interaction-immune as subject

### Primary files

- [`src/lib/path-carver/base-tentacle-damage.ts`](src/lib/path-carver/base-tentacle-damage.ts)
- [`src/lib/path-carver/ocean-damage-multipliers.ts`](src/lib/path-carver/ocean-damage-multipliers.ts)
- [`src/lib/team-data/realm.ts`](src/lib/team-data/realm.ts) — `AEQUOR_REALM_ID`, `BENTHOS_AEQUOR_REALM_ID`
- [`src/lib/path-carver/aggregate-tag-scalars.ts`](src/lib/path-carver/aggregate-tag-scalars.ts)
- Smoke: `npx tsx scripts/smoke-base-tentacle-damage.ts`

---

## Phase 2c — Pass-order layers + rename (easy) — DONE

**Depends on:** Phase 2a + 2b (stable Review Tags interaction math with leaf-gated buff restriction).

### Goal

Replace the temporary “all `add_scaled` then all multipliers” order with **pass order driven by the modifier tag’s `layer`**, rename the DB `layer` enum to meaningful values (`pre_add` / `add` / `post_add` only), and rename the manifestation-local table so Phase 3 can expand it without carrying “override-only” naming.

No `unique_scaling` / `aftereffect` / subject-scheduling behavior in this phase — existing override semantics stay (patch matching `tag_default_interaction` only).

**Layers (locked end state):** only three values — `pre_add`, `add`, `post_add`. There is **no `final` layer**. Phase 3 `aftereffect` is scheduled by **mode** after `post_add`, not by a fourth layer. (2c left a leftover `final` enum label; **Phase 2c.1** removes it via recreate-type migration.)

### Renames (locked)

| Current | New | Notes |
| --- | --- | --- |
| Table `manifestation_interaction_override` | `awakener_local_manifestation_interaction` | Drop “override”; rows will mean more than patches in Phase 3. Update schema-config, types, CRUD, loaders, admin sidebar label. FK already targets `awakener_tag_manifestation` only. |
| Type / helpers `InteractionOverride` | `AwakenerLocalManifestationInteraction` (or keep alias briefly) | Align TS names with table. |
| DB enum `layer` values `x` / `y` / `z` (/ `f`) | `pre_add` / `add` / `post_add` | Three pass bands only. See migration order below. |

| Enum value | Old | Pass meaning |
| --- | --- | --- |
| `pre_add` | `x` | Multiplies / presence **before** the additive band |
| `add` | `y` | `add_scaled` band |
| `post_add` | `z` | Multiplies **after** flats |

### Migration order (locked)

1. **Datapatch:** `UPDATE tag SET layer = 'z' WHERE layer = 'f'` (include soft-deleted rows so none remain on `f`). Moves former `f` tags (e.g. `Support.Crit Damage`) onto `z` / soon-`post_add`.
2. **Enum rename:** `ALTER TYPE layer RENAME VALUE 'x' TO 'pre_add'` (and `y`→`add`, `z`→`post_add`; earlier draft also renamed `f`→`final`). Removing the leftover `final` label is **Phase 2c.1** (Postgres has no `DROP VALUE`).
3. **Table rename:** `manifestation_interaction_override` → `awakener_local_manifestation_interaction` (constraints/grants follow the table).
4. Regenerate TypeScript DB types; update hardcoded old layer / table-name string references in app code, export script, sample-data dumps/README.

Do **not** rename `tag_default_interaction` in this phase.

### Locked engine decisions

| # | Decision |
| --- | --- |
| 1 | **Pass sort key = modifier tag `layer` only.** Target tag layer does not affect when a rule fires. |
| 2 | **Null / layer ranks:** `pre_add=0`, `add=1`, `null=1` (same band as `add`), `post_add=2`. Within the same rank: `add_scaled` before other ops, then interaction `id`. |
| 3 | **No `final` layer.** Aftereffects are Phase 3 mode timing after `post_add`. |
| 4 | **Keep materialize-then-amplify outer pipeline.** Layer order replaces `opPriority` **inside** each interaction list (unrestricted creates; per-subject restricted creates + amplify). Do **not** flatten creates and amplifies into one layer-sorted bag. |
| 5 | **Multi-pass until stable unchanged:** each pass still reapplies the full ordered list from base (`INTERACTION_MAX_PASSES` model). Layers only change sort order within that list. |
| 6 | **Override changing `math_operation` does not move the pass.** Timing still follows the matched default interaction’s **modifier tag layer**. |
| 7 | **Special conversions (Corrosion / Ancient Embers) run once after all layer interaction passes** (same as today — after the interaction loop, not interleaved by layer). |
| 8 | **Review Tags math debug** shows the resolved **layer** on interaction steps in 2c (not deferred to Phase 4 Calculation List). |

### Scope

- Replace temporary global “`add_scaled` first, then multipliers” with modifier-layer sort (`pre_add` → `add`/null → `post_add`)
- Within a layer rank, keep locked `math_operation` / `is_percent` semantics
- Datapatch former `f` → `z`/`post_add`, enum rename to three values, table rename
- Regenerate types; update app / export / sample-data references
- Review Tags Scalar Sum math debug: show layer on steps
- Smoke: `scripts/smoke-phase-2c.ts` (or extend 2b smokes) with a **concrete fixture** — fixed inputs and expected step order and/or totals proving `pre_add` before `add` before `post_add` (include a former-`f` tag now on `post_add`, e.g. Crit Damage)
- Path Carver Review Tags remains the validation surface
- Out of scope: `unique_scaling` / `aftereffect` modes, `creates_base` on local rows, `target_tag_id`, inter-subject scheduling, full Calculation List UI

### Primary files / blast radius

- Migration (datapatch + enum `RENAME VALUE` + table rename)
- [`apply-interactions.ts`](src/lib/path-carver/apply-interactions.ts) — replace `opPriority` with layer rank sort; Special still after loop
- [`review-tags-math-debug.tsx`](src/components/path-carver/review-tags-math-debug.tsx) — show layer on steps
- `schema-config`, CRUD / actions, [`load-team-data.ts`](src/lib/team-data/load-team-data.ts), admin manifestation form, simulator action
- `scripts/export-sample-data.ts`, `sample-data/` dumps + README
- Generated `database.types*.ts`
- New/extended smoke script

### Acceptance criteria (outline)

- [x] Temporary op order removed; **modifier** `tag.layer` drives pass order inside each create/amplify list
- [x] Datapatch: former `f` tags (e.g. Crit Damage) are on `post_add`
- [x] Pass order uses `pre_add`/`add`/`post_add`; generated types updated (leftover `final` enum label → Phase 2c.1)
- [x] Null-layer rank matches locked key (`null` with `add`; within rank add_scaled then multiply, then id)
- [x] Materialize-then-amplify outer structure unchanged; Special conversions still after all layer passes
- [x] Override op change does not change pass layer
- [x] Review Tags math debug shows layer on interaction steps
- [x] Smoke fixture passes with expected order/totals
- [x] Table renamed to `awakener_local_manifestation_interaction`; loaders / admin / types compile and load data
- [x] Override patch behavior unchanged (still requires matching `tag_default_interaction`)

---

## Phase 2c.1 — Remove leftover `layer.final` enum value

**Depends on:** Phase 2c done (pass-order layers live; enum currently includes unused `final`).

### Goal

Postgres cannot `DROP VALUE` from an enum. Remove the leftover `final` label so `layer` is only `pre_add` / `add` / `post_add`, **without losing existing `tag.layer` (or other `layer`-typed) data**.

`aftereffect` remains Phase 3 **mode** timing — this phase is schema cleanup only.

### Why a separate phase

2c correctly datapatch-moved former `f` tags onto `post_add` and renamed labels, but left `final` on the type. Dropping it needs a recreate-type migration that must be careful and reviewable on its own.

### Migration method (locked)

There is **no** `ALTER TYPE ... DROP VALUE`. Use recreate + column swap:

1. **Inventory:** list every column (and default/cast) typed as `layer` in `public` before changing anything. At minimum expect `tag.layer`; re-query at implement time.
2. **Counts before:** record counts per `layer` value (including nulls and soft-deleted rows) for each affected table.
3. **Datapatch:** `UPDATE … SET layer = 'post_add' WHERE layer = 'final'` on **every** affected table (include soft-deleted). Zero rows may remain on `final` or the later cast fails / would drop meaning.
4. **Create new type:** `CREATE TYPE layer_new AS ENUM ('pre_add', 'add', 'post_add');`
5. **Swap columns:** for each inventoried column,  
   `ALTER TABLE … ALTER COLUMN layer TYPE layer_new USING layer::text::layer_new;`  
   (nulls pass through; do not use a USING that maps unknowns to null.)
6. **Replace type name:** `DROP TYPE layer;` then `ALTER TYPE layer_new RENAME TO layer;`
7. **Counts after:** same breakdown as step 2 — totals and per-label counts must match (with former `final` counted under `post_add` if any existed).
8. Regenerate TypeScript DB types; purge `"final"` from app/hardcoded layer unions; confirm admin enum select only shows three values.

Run the migration in **one transaction**. Do **not** truncate or recreate `tag` rows. Prefer `USING layer::text::layer_new` so labels match by name.

### Out of scope

- Phase 3 modes / engine / aftereffect scheduling
- Changing pass-order math (already 2c)

### Acceptance criteria (outline)

- [x] No column still typed with a four-value `layer` that includes `final`
- [x] DB enum labels are exactly `pre_add`, `add`, `post_add`
- [x] Zero rows have `layer = 'final'` (datapatch applied where needed)
- [x] Before/after counts prove no accidental nulling or row loss on `tag.layer` (and any other swapped columns)
- [x] Generated types are `"pre_add" | "add" | "post_add"` only; app compiles

---

## Phase 3 — Manifestation-local unique_scaling / aftereffect (hard)

**Depends on:** Phase 2c + **2c.1** (`layer` enum is three-valued only; `awakener_local_manifestation_interaction` renamed).

### Goal

Expand `awakener_local_manifestation_interaction` so it is not only a patch on the global rulebook: it can define **`unique_scaling`** (local modifier→target without a default row) and **`aftereffect`** (emit a new base tag from a finished subject value), with clear attachment scope, precedence, and scheduling.

### Why this is a separate phase

Pass letters alone do not solve invent-without-default, create-from-final-value, or “all bleed applies before bleed trigger.” Those need modes, extra columns, and a subject pipeline with deferred global amplify. `aftereffect` is **mode-timed** (after subject `post_add`), not a fourth layer — a `final` layer would be redundant with the mode.

### Schema expansions (locked direction)

Add (names may refine in migration):

| Column / concept | Purpose |
| --- | --- |
| `mode` (or equivalent) | `override` \| `unique_scaling` \| `aftereffect` |
| `creates_base` / `amplifies_subject` | Mirror rulebook XOR intent for local modes (or encode via `mode`) |
| `target_tag_id` | Required for `unique_scaling` / `aftereffect` (what to scale or materialize) |
| `layer` | Pass timing for `override` / `unique_scaling` only (`pre_add`/`add`/`post_add`). **Null / unused for `aftereffect`** (timing comes from mode). |
| Existing factor / op / `is_disabled` / `modifier_tag_id` | Keep; semantics depend on mode |

**Modes:**

1. **`override`** — current behavior: patch matching `tag_default_interaction` when modifier hits this manifestation as target.
2. **`unique_scaling`** — define modifier→target op **without** requiring a default row (e.g. Shield → Active Damage `add_scaled`). Scoped to the attached manifestation only. Uses `layer` for pass order among `pre_add`/`add`/`post_add`.
3. **`aftereffect`** — after the attached subject finishes through `post_add`, materialize `target_tag_id` from **this subject’s** finished value. Scheduled by **mode**, not by layer. Example: Active Damage → Non-Active Damage.Bleed.

### Locked decisions

| # | Decision |
| --- | --- |
| 1 | **Local always wins** over global `tag_default_interaction` for the same link (op, factor, disable, unique_scaling vs default). No merge; local replaces. |
| 2 | **`unique_scaling` scope = attached manifestation only** — smaller than `target_type = self`. Self affects all same-owner tags matching the target; unique_scaling applies only to the **single attached manifestation row** (as modifier and/or as the sole target subject, per mode). |
| 3 | **`aftereffect`** merges into the **team pool** for the emitted tag (e.g. team Bleed total), not a private path-only sink that never joins the pool. |
| 4 | **Deferred global trigger:** after all subjects’ `aftereffect` rows for the relevant family have run, run global amplifies that target the emitted tag (e.g. Bleed Trigger). Do not run that global amplify inside a single subject’s local path in a way that “saves” trigger until foreign aftereffects finish. |
| 5 | **Local binding:** an `aftereffect` on manifestation A uses **A’s** finished value at emit time. It must not defer A’s value to wait for other subjects’ aftereffects. |
| 6 | **Subject order:** deterministic (e.g. stable by tag id / manifestation id). Out of scope for this phase: combinatorial “order that maximizes total” across interdependent damage subjects. |
| 7 | Special Corrosion / Embers stay hardcoded post-pass (Phase 4 cleanup); do not fold them into `awakener_local_manifestation_interaction` here. |
| 8 | `buff_target_type_restriction` on local rows remains optional/later; gate `unique_scaling` / `aftereffect` with existing fields first unless a concrete row needs it. |
| 9 | **No `final` layer** — pass bands are only `pre_add`/`add`/`post_add`; `aftereffect` runs after subject `post_add` by mode. |

### Evaluation sketch (Bleed family)

```text
For each damage subject S (deterministic order):
  run S through pre_add → add → post_add
    using cohort available now + local unique_scaling rows scoped to S / attached modifiers
  run S’s aftereffect rows immediately (mode-timed, not a layer)
    → emit into team pool (e.g. Bleed)
  do not run global Bleed-trigger amplify here

After all subjects’ aftereffects for this family:
  run global amplifies targeting the emitted tag (Bleed Trigger, etc.)
```

### Worked examples (acceptance narrative)

1. **`unique_scaling` (Shield):** `awakener_local_manifestation_interaction` on a specific Defender.Shield manifestation defines Shield → Active Damage `add_scaled`. Only that Shield row participates as modifier; not every Shield tag on the owner (`self` would be wider). Local unique_scaling wins if a global Shield→Damage row also exists.
2. **`aftereffect` Bleed:** Active Damage manifestation has aftereffect → Non-Active Damage.Bleed, factor from finished damage after `post_add`. Value merges into **team Bleed** total.
3. **Two damage subjects + trigger:** Each emits Bleed into the team pool via aftereffect; Bleed Trigger (global amplify) runs **once after both** aftereffects. Neither subject’s local row parks a trigger until the other finishes.

### Scope

- Schema + admin for modes / `target_tag_id` / `layer` (for override/unique_scaling) / `creates_base` (as needed)
- Engine: `unique_scaling` + mode-timed `aftereffect`; resolve without requiring a default row when mode is `unique_scaling` or `aftereffect`
- Subject pipeline + team-pool aftereffect + deferred global amplify
- Precedence: local always wins
- Scope: attached manifestation only for `unique_scaling`
- Debug: which local rows fired, at which pass/mode step, from which manifestation
- Out of scope: desire_demand / radar port, Calculation List UI polish, Corrosion/Embers capacity/id rewire, true max-damage search over subject permutations

### Acceptance criteria (outline)

- [ ] `unique_scaling` works with no matching `tag_default_interaction`
- [ ] `unique_scaling` affects only the attached manifestation (not full `self` owner set)
- [ ] When local and global disagree, local result is used
- [ ] `aftereffect` runs after subject `post_add` (by mode), uses finished value, merges into team pool
- [ ] Global amplify of emitted tag runs after all relevant aftereffects (Bleed apply then Bleed trigger)
- [ ] Subject order is deterministic and documented
- [ ] Review Tags debug shows local `unique_scaling` / `aftereffect` steps

---

## Phase 4 — desire_demand, radar, simulator port

**Depends on:** Stable Path Carver math (through Phase 3 preferably; through 2c minimum).

### Goal

Port Path Carver–validated totals into simulator / desire scoring surfaces, wire **Summary / Calculation List** to a layer-by-layer breakdown, and fix Special Corrosion / Ancient Embers (Non-Active descendant capacity + name→id wiring).

### Scope

- Wire Path Carver–validated totals into `desire_demand` fulfillment / curves
- Simulator radar fulfillment % (copy math from Path Carver; not raw unfiltered sums)
- Radar fulfillment % uses **simulated output** for demand tags (not raw scalar sums) once layer engine exists
- Wire **Summary / Calculation List** to show **layer-by-layer** breakdown (`pre_add` / `add` / `post_add`; aftereffects shown as a post-`post_add` mode step, not a layer)
- Simulator Summary panel against real fulfillment
- Generate / Recommend continue to use shared engine once ported
- Fix Corrosion / Ancient Embers (see below)

### Fix Corrosion / Ancient Embers

**Problem (capacity):** Special conversion Non-Active capacity uses the exact parent tag only (`sumTeamTag` on that id in [`apply-interactions.ts`](src/lib/path-carver/apply-interactions.ts)). Child sinks such as `Attacker.Non-Active Damage.Poison Damage` (and later Bleed Damage, etc.) do not feed `×0.5` capacity.

**Problem (wiring):** Phase 2a keys conversion gate, debuff, capacity sources, and damage sinks by **tag name** (`findTagIdByName` / `m.tagName ===`). Elsewhere (Death Resist, Keyflare, Tentacle base) the contract is **numeric tag id**.

**Fix (capacity):** Resolve Non-Active **parent by id**; Non-Active capacity term = that id’s total **plus** all descendants (look up parent `tag_name` from `tagsById`, prefix-sum children). Do **not** hardcode Poison Damage ids/names. Do **not** add `tag_default_interaction` rollups from child sinks into the parent (keeps Poison Trigger scoped). Active Damage and Tentacle capacity stay exact (by id).

**Fix (wiring):** Replace name-string constants with numeric tag id constants for conversion gate, debuff, Active, Tentacle, Non-Active parent, and Corrosion/Embers damage sinks (same style as [`death-resist-trigger.ts`](src/lib/path-carver/death-resist-trigger.ts) / [`trigger-condition.ts`](src/lib/path-carver/trigger-condition.ts)). **Ids are the contract** — renaming a tag does not break conversion if the id is unchanged; changing an id without updating constants no-ops until constants are updated. Out of scope: `Attacker.*` / `Defender.*` prefix gates and DB-driven interaction target prefix matching.

### Acceptance criteria (outline)

- [ ] Calculation List shows per-layer contributions for a built team
- [ ] Team with only `…Poison Damage` (no parent Non-Active scalar) still contributes Non-Active `×0.5` capacity to Corrosion / Embers
- [ ] Poison Trigger still only amplifies Poison Damage, not other Non-Active children
- [ ] Special conversion keys tags by id (not name); rename with same id still converts; id change without constant update does not

---

## Phase 5 — Smart recommendation (outline, later)

**Goal:** Optimization-driven teams using the simulation engine.

**Depends on:** Phase 4.

**Scope:**

- Search / swap suggestions (beyond greedy)
- Entity ban-aware optimization
- Optional: derive desire suitability (may supersede `path`)
- `desire_demand` tuning if discrimination is poor
- Optional later: subject-order search for max damage (explicitly not a Phase 3 gate)

---

## Architecture notes retained from Phase 1

### `path` table

Phase 1 shows **all desires**; `path` unused for filtering. Revisit when suitability scoring exists.

### Ban list (simulator)

Entity IDs only (`awakener` / `posse` / `covenant` / `wheel`). Unchanged; not part of Path Carver Review Tags work.

### One template per desire

Path Carver upserts a single `desire_template` per `desire_id`.

---

## Suggested implementation order (from now)

1. **Phase 2c** — modifier-layer pass order + rename to `awakener_local_manifestation_interaction` (DONE)
2. **Phase 2c.1** — remove leftover `layer.final` via recreate-type migration (DONE)
3. **Phase 3** — manifestation-local `unique_scaling` / mode-timed `aftereffect` + deferred global amplify
4. **Phase 4** — desire_demand / radar / simulator port + Calculation List layer breakdown + Corrosion/Embers Non-Active parent+descendants capacity + name→id wiring
5. **Phase 5** — Smart recommend / search
