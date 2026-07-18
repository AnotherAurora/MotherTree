---
name: Simulator Phased Plan
overview: Path Carver–first roadmap. Phase 1 (simulator MVP + Path Carver shell) is done. Next is Review Tags math — Attacker.* requires is_damage_dealer for all target_types, target_type=self scoping, self-scoped interactions, filtered rows stay visible in debug — then buff_target_type_restriction. Radar, desire_demand fulfillment, simulator port, and damage-layer UI are deferred.
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
    content: "Path Carver Review Tags — target_type=self filter + Attacker.* always requires damage dealer + self-scoped interactions; filtered rows stay visible in debug as Applied=no"
    status: pending
  - id: buff-target-type-restriction
    content: "Immediate next after self — apply buff_target_type_restriction in Review Tags math"
    status: pending
  - id: radar-fulfillment
    content: "LATER — Radar / desire_demand fulfillment on simulator (copy Path Carver math)"
    status: cancelled
  - id: generate-recommend
    content: "LATER — Greedy generate/recommend polish on simulator"
    status: cancelled
  - id: debug-panels-fulfillment
    content: "LATER — Wire simulator Summary to desire_demand fulfillment"
    status: cancelled
  - id: layer-breakdown-ui
    content: "LATER — Summary / Calculation List layer-by-layer breakdown"
    status: cancelled
  - id: radar-simulated-output
    content: "LATER — Radar fulfillment % from simulated demand outputs (not raw scalars)"
    status: cancelled
isProject: false
---

# Recommendation System — Path Carver–First Roadmap

## Strategic shift (locked)

Path Carver’s **Review Tags** page is the primary surface for testing recommendation math. Simulator Start / Recommend / radar / `desire_demand` fulfillment are **deferred**; the simulator will copy Path Carver logic later.

| Focus now | Deferred |
| --------- | -------- |
| Path Carver Review Tags apply + aggregation math | Simulator radar / fulfillment UI |
| Attacker.\* requires `is_damage_dealer` (any target_type); `target_type=self` for non-Attacker | Full `desire_demand` scoring / curves |
| Self-scoped interaction application; filtered rows stay in debug as Applied=no | Summary / Calculation List layer-by-layer breakdown |
| Then: `buff_target_type_restriction` | Radar fulfillment % from simulated (not raw) outputs |
| | Port math into Simulator page |
| | Full damage formula (layers x/y/z/f) for scoring |
| | Smart search / recommend optimization |

---

## Current baseline (as of this rewrite)

### Done

| Area | Status |
| ---- | ------ |
| Simulator Phase 1 core | Seed script, `loadTeamData` (+ gear), Start flow, generate/recommend engines, entity bans, fulfillment module exist |
| Path Carver shell | `/path-carver` under TOOLS; Build → Review 1 → Review 2; load/save `desire` + template + anchors + demands |
| Anchors + `is_damage_dealer` | Build-step toggles; persisted on `desire_anchored_awakener` |
| Review Tags | `loadTeamData` → realm apply filter → scalar sum by `tag.id`; debug table shows Applied / `target_type` / etc. |
| Realm apply | [`manifestation-apply.ts`](src/lib/path-carver/manifestation-apply.ts) — `required_realm` / `required_realm2` |

### Not done (next work)

| Area | Status |
| ---- | ------ |
| `target_type` apply rules | Loaded and shown in debug; **not applied** in aggregation |
| Self-scoped interactions | `tag_default_interaction` + overrides loaded in `TeamData` but **not applied** to suggest/totals |
| `buff_target_type_restriction` | Loaded/shown; untouched until after self rules |
| Simulator using Path Carver math | Still uses older fulfillment path; port later |

---

## Phase 2a — Review Tags math: Attacker damage-dealer gate + `target_type = self` (NEXT)

### Goal

Extend Path Carver Review Tags so team tag totals and interaction effects respect **`is_damage_dealer` for all Attacker.\* tags** and **`target_type = self` for non-Attacker scoping**, with full debug visibility of filtered rows. Primary files: [`manifestation-apply.ts`](src/lib/path-carver/manifestation-apply.ts), [`aggregate-tag-scalars.ts`](src/lib/path-carver/aggregate-tag-scalars.ts), [`review-tags-step.tsx`](src/components/path-carver/review-tags-step.tsx), [`review-tags-debug.tsx`](src/components/path-carver/review-tags-debug.tsx).

### Locked decisions

| # | Decision |
| - | -------- |
| 1 | Work only on Path Carver Review Tags math; simulator copies later |
| 2 | For **non-Attacker** tags: implement **`self` scoping** this phase; `single` / `aoe` keep applying if realm rules pass |
| 3 | Two layers: (A) filter which manifestations enter **team tag totals**; (B) apply **self-scoped interactions** (modifier only affects same awakener’s tags) |
| 4 | Attacker gate: tag name **starts with `Attacker.`** |
| 5 | **Attacker.\* never applies unless owner is `is_damage_dealer`** — for **all** `target_type` values (`self`, `single`, `aoe`, null). Not limited to `self`. |
| 6 | No damage dealers marked → **no** Attacker.\* contributions (any target_type) |
| 7 | **Posse:** skip both `target_type` and damage-dealer gates (realm only); column kept for future behavior |
| 8 | All filtered-out manifestations **remain visible** in the Review Tags debug section with **Applied = no** (and a reason). Never hide filtered rows. |
| 9 | `buff_target_type_restriction` → **immediate next goal after this phase** (not in 2a) |

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

### Layer B — Self-scoped interaction application

When resolving `tag_default_interaction` (+ overrides) for Review Tags math:

- If the **modifier** manifestation (or its effective target_type after override) is `self`, the interaction only modifies tags belonging to the **same owner awakener** (their awakener/wheel/covenant manifestations).
- Example: `Support.Increase Gain.Shield` with `self` only increases that awakener’s `Defender.Shield` / `Defender.Shield.*` values — not other teammates’.
- Example: `Support.Crit Damage` on self does not raise another awakener’s damage; any resulting Attacker.\* contribution still must pass the Layer A damage-dealer gate.

**MVP for 2a interactions (keep scoped):**

1. Load interactions already present on `TeamData`
2. Apply prefix matching for modifier/target tags (reuse / share [`tag-matching.ts`](src/lib/simulator/tag-matching.ts) where useful)
3. Respect overrides + `is_disabled`
4. Scope by `self` as above
5. Output adjusted per-tag totals used by Review Tags list + debug

Defer full layer x/y/z/f damage formula and Summary layer breakdown.

### Debug UX

**Requirement:** every manifestation loaded for the team appears in the Review Tags debug section. Filtering only changes Applied / totals — it must **not** remove rows from the debug tables.

Each row shows:

- Applied yes/no
- Reason when no: e.g. `realm`, `attacker.not_damage_dealer`

Optional: show which interactions applied to which target tags (lightweight; full Calculation List later).

### Files to touch (Phase 2a)

| File | Change |
| ---- | ------ |
| [`src/lib/path-carver/manifestation-apply.ts`](src/lib/path-carver/manifestation-apply.ts) | Damage-dealer set; Attacker.\* gate for all target_types; `target_type=self` for non-Attacker scoping; posse exception; apply reasons |
| [`src/lib/path-carver/aggregate-tag-scalars.ts`](src/lib/path-carver/aggregate-tag-scalars.ts) | Use new apply rules; hook interaction-adjusted totals (exclude Applied=no from sums) |
| New `src/lib/path-carver/apply-interactions.ts` (suggested) | Self-scoped interaction resolution |
| [`src/components/path-carver/review-tags-step.tsx`](src/components/path-carver/review-tags-step.tsx) | Pass anchors / damage dealers into apply context |
| [`src/components/path-carver/review-tags-debug.tsx`](src/components/path-carver/review-tags-debug.tsx) | Show **all** manifestations (including filtered); Applied + reason columns |
| [`src/components/path-carver/path-carver.tsx`](src/components/path-carver/path-carver.tsx) | Wire `anchoredAwakeners` into Review Tags |

### Phase 2a acceptance criteria

- [ ] Attacker.\* (any `target_type`: self / single / aoe / null) only counts when owner awakener is `is_damage_dealer` (including that slot’s wheels/covenant)
- [ ] Zero damage dealers → zero Attacker.\* contribution to team totals
- [ ] Non–damage-dealer Attacker.\* dropped from totals; **still listed** in debug with Applied = no + reason `attacker.not_damage_dealer`
- [ ] All realm-filtered (and other filtered) manifestations remain visible in debug with Applied = no + reason
- [ ] Posse manifestations ignore `target_type` and damage-dealer gates for apply/non-apply (realm rules still apply)
- [ ] Non-Attacker `single` / `aoe` unchanged beyond realm filter; non-Attacker `self` base scalars still count for owner
- [ ] Self-targeted Support (etc.) interactions only modify the owning awakener’s matching target tags
- [ ] Review Tags scalar list uses only Applied = yes totals
- [ ] `buff_target_type_restriction` still unused (next phase)

---

## Phase 2b — Immediate next: `buff_target_type_restriction`

**Depends on:** Phase 2a.

**Goal:** Apply `buff_target_type_restriction` when deciding whether a buff/interaction applies to a given target manifestation’s `source_type` (or equivalent). Leave design details to implementation planning once 2a is stable; this phase is the **next priority after self**, before radar / simulator port.

---

## Phase 2c — Later: desire_demand, radar, simulator port

**Depends on:** Stable Review Tags math (2a + preferably 2b).

**Scope (outline only):**

- Wire Path Carver–validated totals into `desire_demand` fulfillment / curves
- Simulator radar fulfillment % (copy math from Path Carver; not raw unfiltered sums)
- Simulator Summary panel against real fulfillment
- Generate / Recommend continue to use shared engine once ported

**Explicitly later (not in 2a/2b):**

- Wire **Summary / Calculation List** to show **layer-by-layer** breakdown
- Radar fulfillment % uses **simulated output** for demand tags (not raw scalar sums)

---

## Phase 3 — Simulation engine (outline, later)

**Goal:** Full damage simulation for accurate path fit.

**Depends on:** Path Carver math + desire_demand wiring.

**Scope:**

- Full tag prefix inheritance resolver for interactions (if not completed in 2a)
- Map manifestations → layer terms (x, y, z, f)
- 4-layer damage formula
- Summary / Calculation List layer-by-layer breakdown
- Radar / demand scoring from simulated outputs

---

## Phase 4 — Smart recommendation (outline, later)

**Goal:** Optimization-driven teams using the simulation engine.

**Depends on:** Phase 3.

**Scope:**

- Search / swap suggestions (beyond greedy)
- Entity ban-aware optimization
- Optional: derive desire suitability (may supersede `path`)
- `desire_demand` tuning if discrimination is poor

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

1. **Phase 2a** — `target_type=self` + damage-dealer gate + self-scoped interactions on Review Tags
2. **Phase 2b** — `buff_target_type_restriction`
3. **Phase 2c** — Port math to simulator; desire_demand / radar / summary fulfillment
4. **Phase 3** — Full damage layers + Calculation List breakdown + simulated radar inputs
5. **Phase 4** — Smart recommend / search
