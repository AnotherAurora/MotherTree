# Admin input manual — ATM & local interactions

Quick lookup: how fields on **`awakener_tag_manifestation`** (ATM) and **`awakener_local_manifestation_interaction`** feed Path Carver Review Tags math.

**Scope:** ATM, local interactions, and **`copy_provider_group`** / members (not `tag_default_interaction`, realm rows, covenant/wheel/posse, or desire demands).

**Engine status (as of Phase 3c):**

| Feature | Status |
| --- | --- |
| ATM base scalar + apply gates | Live |
| ATM **`hitCount`** (`instance_count` × effective copies); Layer B on single-hit then × hitCount | Live (**3a.3**) |
| Local row as **patch** of a matching `tag_default_interaction` | Live (`unique_scaling`) |
| Local **`unique_scaling` invent** (tag-mod or base-stat null-mod) | Live (**3b**); invent Modifier Tag is **prefix** (**3b.1**) |
| Local **`aftereffect`** emit / merge (× `hitCount` = instances × effective copies) | Live (**3c**) |

Formulas below for aftereffect are **live in Review Tags** (Phase 3c). Invent/patch/`unique_scaling` layer rules are live.

---

## 1. Awakener Tag Manifestation (ATM)

One row = this awakener contributes (or tries to contribute) one **tag** with a **value**.

### 1.1 Formula fields

#### `value_scalar` + `dependency_stat`

These set the row’s **effective base** before interactions.

| `dependency_stat` | Effective base (ATM) |
| --- | --- |
| **null** | `value_scalar` as entered (no ceil) |
| awakener stat (e.g. `atk`, `hp`) | `ceil(value_scalar × awakener.<stat>)` (or 2-dp ceil if the **tag** is percent) |
| percent-like dep (`damage_amp`, `crit_rate`, `crit_dmg`, `sigil_yield`, `death_resist`) | `ceil((value_scalar×100) × (stat×100))` with tag percent ceil rules |
| `team_max_hp` | if team Max HP is known: `ceil(value_scalar × teamMaxHp)`; else raw `value_scalar` |
| `enemy_max_hp` | always raw `value_scalar` (ignored for scaling on ATM) |

Owner for scaling = this ATM’s **awakener**.

**Mental model:** blank dependency → flat number; set dependency → “rate × that awakener’s stat.”

#### `instance_count` + `base_copies` + `copy_provider_group_id`

```text
hitCount        = instance_count × effectiveCopies
effectiveCopies = base_copies + Σ max(0, floor(pool[tagId])) for tagId in providerTagIds
providerTagIds  = members of copy_provider_group_id  (empty if FK null)

# Layer A–only paths (identity f): contribution = effectiveScalar × hitCount
# Layer B (Review Tags): finishedOnce = LayerB(single-hit base); contribution = finishedOnce × hitCount
```

Provider pool uses **effectiveScalar × instance_count** only (no copy multiply) so bonuses do not recurse. Layer B runs on the **single-hit** base so ops like `add_scaled` apply per hit (`N·(base+k)`), not once on a pre-scaled base (`N·base+k`). **Do not** invent N synthetic `(created base)` rows for copies — one ATM row stays one debug row.

| Field | Default | Role |
| --- | --- | --- |
| `instance_count` | **NOT NULL DEFAULT 1** | How many times **one copy** of this effect fires. |
| `base_copies` | **NOT NULL DEFAULT 1** | Starting copies before provider bonuses. |
| `copy_provider_group_id` | **NULL** | FK → `copy_provider_group`. Null = no provider bonus (effective copies = `base_copies`). |

Admin soft-warns (amber) when `instance_count ≤ 0` or `base_copies ≤ 0`; save still allowed.

**Copy provider groups** (`copy_provider_group` + `copy_provider_group_member`): curated tag sets (e.g. Command Card Creates). One group per ATM. Manage under Awakeners → Copy Provider Groups (nested members).

**Aftereffect (Phase 3c):** emit uses **`finishedOnce`** (single-hit); merge scales by **`hitCount = instance_count × effectiveCopies`**. Do not `op` the folded `finishedOnce × hitCount` total.

#### `tag_id`

Which tag this base belongs to. Same-tag rows later combine with **`tag.is_additive`** (not an ATM field). Interactions target this tag by name/id rules on `tag_default_interaction`.

---

### 1.2 Apply gates (in or out of totals — not the scalar formula)

If a gate fails, the row is **not applied** (Review Tags shows Applied = no). It never enters Layer A/B math.

| Field | Effect |
| --- | --- |
| `required_realm` | Team must satisfy that realm (Chaos = exclusive chaos-lineage). |
| `required_enlightenment` | Stored / shown; Path Carver apply path does not currently gate on it the same way as realm (treat as data for game rules / future). |
| `trigger_condition` | FK to a **When.\*** tag. Null = always eligible on the null-trigger pass. Set = applied only after Cause→When counts, scaled ×N times. |
| `target_type` | **`self`:** this Support/Defender-style contribution is scoped to the owner (and Attacker.\* still needs damage-dealer). Used for interaction self-scoping when this row is a **modifier**. |
| `source_type` | Leaf type (`command` / `exalt` / …). Used as **subject context** when this ATM is the interaction subject so `tag_default_interaction.buff_target_type_restriction` can match. |
| Tag name `Attacker.*` | Applied only if this awakener is marked **damage dealer** on the desire build (any `target_type`). |

Posse rows skip some of these gates; **ATM does not**.

---

### 1.3 Identity / structure (little or no scalar formula)

| Field | Role |
| --- | --- |
| `awakener_id` | Owner. |
| `metadata` | Display / notes. |
| `replaces_manifestation_id` | This row replaces another ATM on the same awakener when resolving the loadout. |
| `is_accumulating` | Loaded / debug; not a scalar multiplier in the interaction engine. |
| `is_permanent` | Data flag; not a Path Carver scalar formula input. |
| `buff_target_type_restriction` (on ATM) | **Not** the interaction gate — that lives on **`tag_default_interaction`**. ATM column is unused for Layer B gating today. |

---

### 1.4 ATM quick examples

| Intent | Typical inputs |
| --- | --- |
| Flat +20% STR Up | `tag` = Support.STR Up, `value_scalar` = 0.2, `dependency_stat` = null (if tag is percent) |
| ATK × 1.5 as damage base | `value_scalar` = 1.5, `dependency_stat` = `atk` |
| Only when Death Resist When fires | set `trigger_condition` to that When tag |
| Self-only Shield | `tag` = Defender.Shield…, `target_type` = `self` |

---

## 2. Local interaction (`awakener_local_manifestation_interaction`)

Child of an ATM (or standalone admin table). **Parent ATM** = attachment point.

Two **modes** (no separate “override” mode):

| Mode | Attachment meaning | Tag columns |
| --- | --- | --- |
| **`unique_scaling`** | Row on the **target** ATM (e.g. Active Damage / Shield). Scales **that** manifestation. | `modifier_tag_id` = tag modifier **or null** (null ⇒ `dependency_stat` required — base-stat); `target_tag_id` **null** |
| **`aftereffect`** | Row on the **source** ATM (e.g. Active Damage). After that subject finishes, emit into another tag. | `target_tag_id` required; `modifier_tag_id` **null** |

Admin shows **one** tag dropdown; label swaps (“Modifier Tag” vs “Target Tag”). Mode switch moves the selected id into the active column and nulls the other. For unique_scaling you may clear Modifier Tag and set **Dependency Stat** instead (base-stat invent).

**Do not** set `creates_base` / `amplifies_subject` here — those exist only on `tag_default_interaction`. Mode is enough.

---

### 2.1 Shared local fields

#### `value_scalar` → **factor**

Always becomes a **factor** (not the finished subject value).

| Path | How factor is built |
| --- | --- |
| Tag-mod unique_scaling / aftereffect | Scaled by local `dependency_stat` against the **parent ATM’s awakener** when set (`effectiveOverrideFactor` / same family as ATM) |
| **Base-stat unique_scaling** (null `modifier_tag_id`) | **Raw** `value_scalar` — do **not** dep-scale the factor again. Admin shows **Value Scalar (%)** (e.g. enter `0.5` for 0.5%; store `0.005`) |

| Mode | Default `value_scalar` |
| --- | --- |
| `unique_scaling` | **1** |
| `aftereffect` | **1** |

#### `dependency_stat`

Dual meaning for unique_scaling:

| Case | Role of `dependency_stat` |
| --- | --- |
| Tag modifier (`modifier_tag_id` set) | Optional — scales **`value_scalar` → factor** only |
| Base-stat (`modifier_tag_id` null) | **Required** — **is** the modifier (awakener stat → `modifierValue`). Percent-like deps (`damage_amp`, `crit_rate`, `crit_dmg`, `sigil_yield`, `death_resist`) use **percentage points** (`stat × 100`) |
| Aftereffect | Optional — scales factor only. Does **not** multiply finished(S) again |

Do not leave unique_scaling with both Modifier Tag and Dependency Stat empty.

#### `target_type`

Required; default **`aoe`**. Write / self-scoping for the local row (not null).

| Value | Intent |
| --- | --- |
| `aoe` | Broad / team-style write scope (default) |
| `self` | Same-owner scoping where local write/modifier rules use self |
| `single` | Same enum as manifestations; prefer documenting kit intent in metadata if unused by a given mode path |

#### `layer`

`pre_add` | `add` | `post_add`.

| Mode | Meaning |
| --- | --- |
| `unique_scaling` | **When** on the **target** subject path this link fires. **Local wins** over the modifier tag’s `tag.layer`. Null + tag mod → modifier tag layer; null + base-stat → **`add`**. Does **not** grow the modifier; it only reads Mod’s current total when that band runs. |
| `aftereffect` | Order among **this subject’s** aftereffect siblings after source `post_add` (`pre_add` → `add` → `post_add`). |

#### `is_disabled`

| Situation | Effect |
| --- | --- |
| Matching `tag_default_interaction` exists + disabled | Cut that link for **this** manifestation only |
| No matching default + disabled | No-op |

Admin (ATM nested + standalone Local Interactions): while Disabled is checked, **Layer**, **Math Operation**, **Value Scalar**, and **Target Type** are hidden. Stored values are left alone and ignored by the engine; they reappear unchanged when Disabled is unchecked.

#### `math_operation`

See per-mode sections. Defaults differ by mode.

---

### 2.2 Mode: `unique_scaling`

**What it does**

- **Tag modifier** (`modifier_tag_id` set): if a `tag_default_interaction` exists for **exact** `modifier_tag_id` → parent ATM’s tag (prefix/exclusion rules as usual): **PATCH** that link for this manifestation only (local wins: op, factor, disable, target_type, layer, …). Else: **INVENT** Mod → this manifestation only (Phase 3b).
- **Base-stat** (`modifier_tag_id` null + `dependency_stat` set): always **INVENT** (no default match). Engine in Phase 3b.

**Modifier pool (tag-mod invent — Phase 3b.1):** Modifier Tag is a **prefix root** (same as `tag_default_interaction` target matching): `Defender.Shield` includes `Defender.Shield` and all `Defender.Shield.*`. Self/non-self + `tag.is_additive` still apply across that pool. Local attachment only narrows **which target row** receives the op — not “only this awakener’s Shield” unless Shield rows themselves are `self`.

**Modifier pool (tag-mod patch):** unchanged — matching `tag_default_interaction` still uses **exact** modifier id; local only overrides op / factor / layer / disable / `target_type`.

**Modifier value (base-stat):** parent ATM awakener’s `dependency_stat`. If percent-like dep → percentage points (`×100`). Factor = raw `value_scalar`.

**Apply (interaction-style — uses target `before`):**

Let:

- `before` = this ATM tag’s current value in the pass band  
- `modifierValue` = combined modifier tag total **or** awakener dep (base-stat)  
- `factor` = effective local `value_scalar` (tag-mod may dep-scale; base-stat raw)

| `math_operation` | Result on target |
| --- | --- |
| `multiply_one_plus` (**default**) | Non-%: `before × (1 + modifierValue × factor)` · %-tag: `(1+before)×(1+modifierValue×factor)−1` |
| `add_scaled` | `before + modifierValue × factor` |
| `multiply` | Non-%: `before × (modifierValue × factor)` · %-tag: `(1+before)×(modifierValue×factor)−1` |
| `presence_multiply` | If modifier present: `before × factor` (once per modifier/target) |

**Example (tag-mod, locked intent):** Shield 10 → increase to 20; Damage ATM unique_scaling Shield, `layer = add`, `add_scaled` / factor 1 → in Damage’s **add** band, read Shield **20** and add 20. Unique_scaling does not re-run Shield increase.

**Example (base-stat, ATM 27):** Shield.Fixed base `ceil(0.8×136)=109`; local `modifier_tag_id` empty, `dependency_stat = sigil_yield`, `value_scalar = 0.005` (UI shows `0.5%`), `multiply_one_plus` → `3.6 × 0.005 = 0.018` → `109 × 1.018 → 111`.

---

### 2.3 Mode: `aftereffect`

**What it does (Phase 3c — live)**

1. Source ATM finishes through `post_add` on the **single-hit** base → **`finishedOnce`**.
2. Build **factor** from `value_scalar` (+ `dependency_stat` via `effectiveOverrideFactor` on the source ATM’s awakener).
3. **`contribution = op(finishedOnce, factor)`** — **`before` is not in the op**. Do not `op(finishedOnce × hitCount, factor)`.
4. Merge **`contribution × hitCount`** into **`target_tag_id`** under **`ownerKeyFor(source)`** (ATM → `awakener:{id}`) with **`tag.is_additive`**. Never Phase 1 `*team*` for this emit.
5. Then merge the source’s own tag as **`finishedOnce × hitCount`**.

`target_type` stamps the synthetic’s `targetType` only; it does not change write owner. If that owner already has the tag (Layer A Bleed), merge only — no parallel synthetic.

Disabled aftereffect rows are skipped (and do not enter the look-ahead closure).

**Ops (finishedOnce ↔ factor only):**

| `math_operation` | `contribution` | In aftereffect dropdown? |
| --- | --- | --- |
| `multiply` (**default**) | `finishedOnce × factor` | yes |
| `add_scaled` | `finishedOnce + factor` | yes |
| `multiply_one_plus` | — | **no** |
| `presence_multiply` | — | **no** |

Then:

```text
newTotal = combineSameTagScalar(before, contribution × hitCount, tag.is_additive, tag.is_percent)
```

**Example:** finishedOnce Damage = 10, `add_scaled`, factor = 5, hitCount = 3 → contribution **15**, Bleed merge **45** (not `op(30, 5) = 35`).

**Scheduling (look-ahead Option A):** `closure0` = this team’s aftereffect `target_tag_id`s; expand via `creates_base` whose **modifier exact-matches** a tag in the closure. Those create edges and `amplifies_subject` rows whose target intersects the closure are **pulled** out of the per-subject loop. After all subjects: one thin `creates_base` from the **combined** stack (`is_additive` across owners; `hitCount = 1`; Phase 1–style `*team*` OK on this hop only) then one thin amplify (`leafContext` = synthetic `sourceType`, which is `null`). Empty aftereffect set: pull nothing; Layer A + Phase 1 create + Trigger stay as 3b.

Bleed kits: aftereffect → **Bleed** (source owner) → combined stack → Bleed Damage create → Trigger amplifies Bleed Damage once (Trigger does not multiply the Bleed stack).

---

## 3. Side-by-side cheat sheet

| | ATM | Local `unique_scaling` | Local `aftereffect` |
| --- | --- | --- | --- |
| Main number | Base for this tag | **Factor** on Mod→this ATM | **Factor** with finished(S) |
| Other operand | awakener stat (if dep set) | Modifier tag total **or** awakener dep (null mod) | Finished source value |
| Op uses target `before`? | n/a (is the base) | **Yes** | **No** (merge via `is_additive`) |
| Default op | n/a | `multiply_one_plus` | `multiply` |
| `layer` | n/a (tag has its own) | When on **target** path | Order among aftereffects |
| Typical kits | Damage / Shield ATM bases | Shield→Damage invent/patch; sigil→Shield base-stat | Damage→**Bleed** emit |

---

## 4. Related (out of scope here)

- Global Mod→target rules, `creates_base` / `amplifies_subject`, buff restriction: **`tag_default_interaction`**
  - **`creates_base` invent:** exact **`target_tag_id` only** (no prefix fan-out to descendants loaded in `tagsById`).
  - **`amplifies_subject`:** prefix target + exclusion (tag + descendants), unchanged.
  - Local **`aftereffect`:** already exact `target_tag_id` only.
- Tag percent / additive combine: **`tag.is_percent`**, **`tag.is_additive`**, **`tag.layer`**
- Full scheduling (closure look-ahead, deferred Trigger): live in Review Tags (Phase 3c); design locks in `.cursor/plans/simulator_phased_plan_7b0fcf95.plan.md`
