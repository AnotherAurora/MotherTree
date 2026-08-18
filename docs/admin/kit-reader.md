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
5. Agent proposes + runs insert CLI (`verified=false` only).
6. Back in Kit Reader: **Edit** pending rows as needed → **Verify** (or soft-delete). The Awakener Manifestations table remains available for broader CRUD.

```text
Export → Copy prompt → Cursor Agent → insert-kit-pending.ts → pending Edit / Verify
```

## Insert CLI

```bash
npx tsx --env-file=.env.local scripts/insert-kit-pending.ts sample-data/kit-reader/{slug}.proposal.json
```

- Requires `ADMIN_ENABLED=true` (local).
- Aborts if any alive pending ATM exists for that awakener. **No `--force`.**
- Inserts only `status: "ok"` rows; always `verified = false`.
- Two-pass for `replacesClientKey` → `replaces_manifestation_id`, then nested locals.

Proposal schema: [`src/lib/kit-reader/proposal-schema.ts`](../../src/lib/kit-reader/proposal-schema.ts).

## Pack assumptions

| Field | Value |
| --- | --- |
| Awakener level | 60 |
| Soulforge | 10 (clamped to talent max; 0 if absent) |
| Gnostic | 0, except SKeyDB `defaultMaxed` → lv5 |
| Skill level | lv6 (last scaling index) |

Pinned SKeyDB commit: [`SKEYDB_COMMIT`](../../src/lib/assets/skeydb-base.ts).

## Flavor → tag

Resolve kit wording via the pack’s `lexicon.flavorTagSynonyms` (built from [`src/lib/kit-reader/flavor-tag-synonyms.ts`](../../src/lib/kit-reader/flavor-tag-synonyms.ts)). Prefer `.Fixed` except the `Attacker.Active Damage` tree. Never invent tags — only names in `lexicon.tags`.

## ATM metadata + is_accumulating

Helpers: [`src/lib/kit-reader/atm-metadata.ts`](../../src/lib/kit-reader/atm-metadata.ts). Pack export fills `cost`, `sourceLabel`, and per-layer `sourceLabelHint`.

### Metadata formula

```text
{sourceLabel} {effectLabel}[ E1|E2|E3]
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

- `effectLabel`: strip leading `Attacker.` / `Support.` / `Defender.` / `Special.` / `When.` from `tagName`.
- Append `E1`/`E2`/`E3` only when `required_enlightenment` is 1/2/3. Do not double-append OE/AA.

Aurita examples: Gland Division → `0 Cost Active Damage` / `0 Cost Active Damage E2`; Clamorous Ocean → `Exalt …`; Jellyfish Congregation → `OE …`; Sparkling Friendship (AbsoluteAxiom on Rouse) → `AA …` with enlightenment **15**; Happy Little Fairy → `Talent …`; Soulforge kit line → `SF …`.

### is_accumulating

`true` when kit text is every-turn (“at turn start” / “at turn end”); otherwise `false`.

## Enjoy → unique_scaling

When kit text uses **enjoy / enjoys / enjoying**, scale the **subject** ATM via a **local** (`mode: unique_scaling`), not a separate Support ATM for the modifier tag. Default op is `multiply_one_plus`, `targetType: aoe`. Modifier tag is the **root**, not `.Fixed`.

**Tentacle DMG:** when enjoy is followed in the same clause by Tentacle DMG / Tentacle Damage, attach **two** locals with identical fields except `modifierTagName`. Unique TDU is a sibling of TDU, not a prefix child.

Example (Caecus): *"Deal DMG, enjoying a 50% Tentacle DMG bonus"* → parent `Attacker.Active Damage` + both locals:

| Field | Local 1 | Local 2 |
| --- | --- | --- |
| `mode` | `unique_scaling` | `unique_scaling` |
| `modifierTagName` | `Support.Tentacle Damage Up` | `Support.Unique Tentacle Damage Up` |
| `valueScalar` | `0.5` | `0.5` |
| `mathOperation` | `add_scaled` | `add_scaled` |
| `targetType` | `aoe` | `aoe` |
| `layer` | `add` | `add` |

`"24"` Aequor *"enjoys a 75% Tentacle DMG bonus"* → same pair at `0.75`. Counter / STR enjoy stay a single unique_scaling.

- Pack layers with `hasEnjoyClause` / `hasEnjoyTentacleDmgClause` flag text to inspect.
- Flat grants (“gain Shield”, “+STR”) → ATM on that tag, not enjoy local.
- Aftereffect → emit pattern only, not enjoy wording.
- Ambiguous enjoy → `needs_review`.

Helpers: [`src/lib/kit-reader/proposal-heuristics.ts`](../../src/lib/kit-reader/proposal-heuristics.ts) (`detectEnjoyClause`, `detectEnjoyTentacleDmgClause`, `parseEnjoyPercentFactor`).

## Always-aoe tags

When ATM `tagName` matches any prefix in pack `lexicon.aoeTagPrefixes` (including subtags), set `targetType: "aoe"`. Insert CLI normalizes if Agent omits it.

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
