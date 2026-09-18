---
name: Astral Reign Relic Research
overview: "Pinned SKeyDB research for the MotherTree relic update. Full inventory of all 91 Standard Astral Reign relic families (category ASTRAL_REIGN) with the raw descriptionTemplate + descriptionArgs for their Astral Reign Gold or Cursed variant. Silver variants intentionally skipped; Faded Legacy Cursed/Blessed/Sinful variants excluded."
todos:
  - id: pin-source
    content: Pin SKeyDB commit + raw URL patterns for relic catalog/records
    status: completed
  - id: define-filter
    content: Filter categories contains ASTRAL_REIGN; variant category ASTRAL_REIGN and tier in Gold/Cursed (skip Silver)
    status: completed
  - id: extract-effects
    content: Extract raw descriptionTemplate + descriptionArgs for every in-scope variant
    status: completed
isProject: false
---

# Astral Reign Relic Research (SKeyDB)

Research artifact for the MotherTree relic update. Written for other agents to consume.

## Scope (locked)

- Include every relic family whose `categories` contains `ASTRAL_REIGN`.
- For each family, include the variant whose `category` is `ASTRAL_REIGN` and whose `tier` is `Gold` or `Cursed`.
- Skip `Silver` variants.
- Include families that are also cross-listed with `EVENT` / `OTHER` / `FADED_LEGACY`; their extra categories are noted.
- **Out of scope:** `Faded Legacy - Cursed/Blessed/Sinful` variants and `Dimensional Image` / `Event` / `Pendulum` relics.

## Source of truth (pinned)

- Repo: `dansa/SKeyDB` (unofficial Morimens fan database, CC BY-NC-SA 4.0 data)
- Commit: `b7a70c00a33a031811fa88d9fd8dd7564ca286c1` (2026-09-05)
- Relic catalog: `src/data/public-v3/catalogs/relics.json`
- Relic records: `src/data/public-v3/records/relics/relic-####.json`
- Domain/type definitions: `src/domain/relics.ts`, `src/domain/relic-database-display-scopes.ts`, `src/domain/public-description-args.schema.ts`
- Raw URL pattern:

```text
https://raw.githubusercontent.com/dansa/SKeyDB/b7a70c00a33a031811fa88d9fd8dd7564ca286c1/src/data/public-v3/catalogs/relics.json
https://raw.githubusercontent.com/dansa/SKeyDB/b7a70c00a33a031811fa88d9fd8dd7564ca286c1/src/data/public-v3/records/relics/relic-0061.json
```

## Data model / terminology

- `relicType`: `Relic` | `Pendulum` | `Event` | `Dimensional Image`. All in-scope relics are `Relic`.
- `categories`: array of `ASTRAL_REIGN` | `FADED_LEGACY` | `DIMENSIONAL_IMAGE` | `EVENT` | `PENDULUM` | `OTHER`.
- Display scopes (`relic-database-display-scopes.ts`): `STANDARD` = `ASTRAL_REIGN` + `FADED_LEGACY`; plus `DIMENSIONAL_IMAGE`, `OTHER`, `EVENT`, `PENDULUM`.
- Variant `tier` values: `Silver`, `Gold`, `Pendulum`, `Special`, `Unique`, `Cursed`, `Sinful`, `Blessed`, `Base`, `Upgraded`.
- Variant `variantType`: `STANDARD` for Astral Reign / Faded Legacy variants; also `BLESSED`, `SINFUL`, etc.
- Variant `label` format: `Astral Reign - Silver`, `Astral Reign - Gold`, `Astral Reign - Cursed`, `Faded Legacy - Cursed/Blessed/Sinful`.
- The Astral Reign pool is a Silver (base) + Gold (`+`) upgrade pair. Some families instead expose an `Astral Reign - Cursed` variant (no Silver/Gold).

## Effect encoding

Each variant carries `descriptionTemplate` (string) and `descriptionArgs` (object). The template contains:

- `[ArgN]` placeholders that reference keys in `descriptionArgs` (`Arg1`, `Arg2`, ...).
- `{Token}` game-term placeholders (see legend below).

`descriptionArgs` entries are discriminated by `kind`:

| kind | fields | meaning |
| --- | --- | --- |
| `fixed` | `value`, optional `suffix`, `stat`, `substatBonus` | literal value |
| `linear` | `base`, `gainPerLevel` | linear rank scaling |
| `scaling` | `values[]` | per-rank value list |
| `computed` | `formulaKey`, `baseFormula`, `multiplier`, `inputs[]` | scaling formula (mostly `scaled` / `esotericResearchDepth`) |

Computed args in this set mostly use `formulaKey: "scaled"` with `baseFormula: "esotericResearchDepth"` and `inputs: ["accountLevel", "ownedPosseCount"]`. In SKeyDB these render as account-level base value, with Astral Reign research bonus from owned posse count. The raw args remain unresolved; resolved default values are annotated per variant below.

### Resolved default values (accountLevel 50, ownedPosseCount 50)

SKeyDB's default formula context is `accountLevel = 50` and `ownedPosseCount` = all collectible posses (54), capped at 50 for the Astral Reign research bonus. At level 50, `stageGrow = 490` and `accountDamagePower = 206`. Resolved values use `ceil(x - 1e-9)` (SKeyDB `ceilDisplayValue`).

| baseFormula | default resolution |
| --- | --- |
| `accountStageGrowth` | `ceil(490 * multiplier)` (no posse bonus) |
| `esotericResearchDepth` | `ceil(490 * 1.5 * multiplier)` |
| `occultResearchDepth` | `ceil(1009.4 * 1.5 * multiplier)` |

Each affected variant below carries a `Resolved default` line, e.g. `Arg1 = 12`.

### Token legend

Tokens observed across the in-scope Astral Reign Gold/Cursed templates. `{derived:...}` / `{overlay:...}` denote derived / overlay cards; `{ATK}` / `{DEF}` / `{CON}` denote stat references. `{plural:[ArgN]|singular|plural}` is an SKeyDB pluralization macro that resolves against the referenced arg.

- `{Adv. Insight}`
- `{Annihilation}`
- `{Bleed}`
- `{Bleeding}`
- `{Counter}`
- `{Crimson Furnace}`
- `{Death Resistance}`
- `{derived:Insight}`
- `{derived:Silver Key Dawn}`
- `{Devour}`
- `{Embryo Fusion}`
- `{Embryo}`
- `{Exhaust}`
- `{Keyflare Rouse}`
- `{plural:[Arg1]|additional card|additional cards}`
- `{plural:[Arg1]|card|cards}`
- `{plural:[Arg1]|stack|stacks}`
- `{plural:[Arg1]|time|times}`
- `{plural:[Arg2]|card|cards}`
- `{plural:[Arg2]|stack|stacks}`
- `{plural:[Arg2]|time|times}`
- `{plural:[Arg3]|time|times}`
- `{plural:[Arg5]|turn|turns}`
- `{Poison}`
- `{Prepare}`
- `{Pure DMG}`
- `{Raging Waves}`
- `{Retain}`
- `{Rouse}`
- `{Stagger}`
- `{STR}`
- `{STRâ–¼}`
- `{Surging Tides}`
- `{Tentacle DMG}`
- `{Tranquil Sea}`
- `{Ultra Round}`
- `{Ultra Space}`
- `{Vulnerable}`
- `{Weakness}`

## Inventory

All 91 Standard Astral Reign relic families with an in-scope variant.

| # | Relic ID | Name | Slug | Rarity | Categories | Variant tier | Aliases |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `relic-0061` | Alfonso's Artifact | `alfonsos-artifact` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Alfonso's Artifact+ |
| 2 | `relic-0064` | Arcana Archive | `arcana-archive` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Arcana Archive+ |
| 3 | `relic-0065` | Arcana Relic | `arcana-relic` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Arcana Relic+ |
| 4 | `relic-0066` | Arcane Gloves | `arcane-gloves` | N | ASTRAL_REIGN, EVENT | Gold | Arcane Gloves+, â˜†Arcane Glovesâ˜† |
| 5 | `relic-0076` | Black Candle | `black-candle` | - | ASTRAL_REIGN, FADED_LEGACY | Cursed | Blessed: Black Candle, Sinful: Black Candle |
| 6 | `relic-0078` | Blessed Blood | `blessed-blood` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Blessed Blood+, Painted Blessed Blood, Painted Blessed Blood+ |
| 7 | `relic-0079` | Bloody Pebble | `bloody-pebble` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Bloody Pebble+, Painted Bloody Pebble, Painted Bloody Pebble+ |
| 8 | `relic-0081` | Brand-New Wallet | `brand-new-wallet` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Brand-New Wallet+ |
| 9 | `relic-0086` | Celestial Astrolabe | `celestial-astrolabe` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Celestial Astrolabe+ |
| 10 | `relic-0088` | Chant of the Tides | `chant-of-the-tides` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Chant of the Tides+ |
| 11 | `relic-0133` | Chronometric Device | `chronometric-device` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Chronometric Device+ |
| 12 | `relic-0137` | Crimson Brooch | `crimson-brooch` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Crimson Brooch+ |
| 13 | `relic-0139` | Dearest Babe | `dearest-babe` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Dearest Babe+ |
| 14 | `relic-0140` | Deceased's Chrono | `deceaseds-chrono` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Deceased's Chrono+ |
| 15 | `relic-0143` | Differential Engine | `differential-engine` | N | ASTRAL_REIGN, EVENT | Gold | Differential Engine+, â˜†Differential Engineâ˜† |
| 16 | `relic-0152` | Doctor's Case | `doctors-case` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Doctor's Case+ |
| 17 | `relic-0155` | Easter Moment | `easter-moment` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Easter Moment+ |
| 18 | `relic-0157` | Eerie Hook | `eerie-hook` | - | ASTRAL_REIGN, FADED_LEGACY | Cursed | Blessed: Eerie Hook, Sinful: Eerie Hook |
| 19 | `relic-0164` | Filigree Agate | `filigree-agate` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Filigree Agate+, Painted Filigree Agate, Painted Filigree Agate+ |
| 20 | `relic-0166` | Fleeting Beauty | `fleeting-beauty` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Fleeting Beauty+ |
| 21 | `relic-0167` | Foreign Stamp Album | `foreign-stamp-album` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Foreign Stamp Album+ |
| 22 | `relic-0168` | Forgotten Loom | `forgotten-loom` | N | ASTRAL_REIGN, EVENT, OTHER | Gold | Forgotten Loom+, â˜†Forgotten Loomâ˜† |
| 23 | `relic-0169` | Forgotten Prelude | `forgotten-prelude` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Forgotten Prelude+ |
| 24 | `relic-0170` | Forsaken Blood | `forsaken-blood` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Forsaken Blood+ |
| 25 | `relic-0174` | Gilded Reverie | `gilded-reverie` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Gilded Reverie+, Painted Gilded Reverie, Painted Gilded Reverie+ |
| 26 | `relic-0176` | Guardian Hand | `guardian-hand` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Guardian Hand+ |
| 27 | `relic-0178` | Harford's Elixir | `harfords-elixir` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Harford's Elixir+ |
| 28 | `relic-0180` | Hierophant's Staff | `hierophants-staff` | N | ASTRAL_REIGN, FADED_LEGACY, EVENT | Gold | Hierophant's Staff+ |
| 29 | `relic-0181` | Highest Honor | `highest-honor` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Highest Honor+ |
| 30 | `relic-0185` | Hyperstring Pocketwatch | `hyperstring-pocketwatch` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Hyperstring Pocketwatch+ |
| 31 | `relic-0186` | In Twilight | `in-twilight` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | In Twilight+ |
| 32 | `relic-0188` | Iron Lock | `iron-lock` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Iron Lock+, Painted Iron Lock, Painted Iron Lock+ |
| 33 | `relic-0190` | Jade Imprint | `jade-imprint` | - | ASTRAL_REIGN, FADED_LEGACY | Cursed | Blessed: Jade Imprint, Sinful: Jade Imprint |
| 34 | `relic-0192` | Kaleidoscope | `kaleidoscope` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Kaleidoscope+ |
| 35 | `relic-0196` | Laurel Cufflinks | `laurel-cufflinks` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Laurel Cufflinks+ |
| 36 | `relic-0197` | Lemurian Delight | `lemurian-delight` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Lemurian Delight+ |
| 37 | `relic-0204` | Lucky Rabbit's Paw | `lucky-rabbits-paw` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Lucky Rabbit's Paw+ |
| 38 | `relic-0206` | Luminous Hourglass | `luminous-hourglass` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Luminous Hourglass+ |
| 39 | `relic-0207` | Malignant Child | `malignant-child` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Malignant Child+, Painted Malignant Child, Painted Malignant Child+ |
| 40 | `relic-0216` | Mind Engraving | `mind-engraving` | - | ASTRAL_REIGN, FADED_LEGACY | Cursed | Blessed: Mind Engraving, Sinful: Mind Engraving |
| 41 | `relic-0220` | Mute Jukebox | `mute-jukebox` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Mute Jukebox+ |
| 42 | `relic-0222` | Mythag Insignia | `mythag-insignia` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Mythag Insignia+ |
| 43 | `relic-0223` | Nameless Appendage | `nameless-appendage` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Nameless Appendage+ |
| 44 | `relic-0224` | Nettle Vest | `nettle-vest` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Nettle Vest+ |
| 45 | `relic-0225` | Neurotoxin | `neurotoxin` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Neurotoxin+ |
| 46 | `relic-0226` | Nightmare Manifest | `nightmare-manifest` | - | ASTRAL_REIGN, FADED_LEGACY | Cursed | Blessed: Nightmare Manifest, Sinful: Nightmare Manifest |
| 47 | `relic-0229` | Omen Ritual Bird | `omen-ritual-bird` | - | ASTRAL_REIGN, FADED_LEGACY | Cursed | Blessed: Omen Ritual Bird, Sinful: Omen Ritual Bird |
| 48 | `relic-0231` | Other Tongue | `other-tongue` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Other Tongue+ |
| 49 | `relic-0232` | Our Home | `our-home` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Our Home+ |
| 50 | `relic-0234` | Pathwalker's Remains | `pathwalkers-remains` | - | ASTRAL_REIGN, FADED_LEGACY | Cursed | Blessed: Pathwalker's Remains, Sinful: Pathwalker's Remains |
| 51 | `relic-0235` | Phantom Hand | `phantom-hand` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Phantom Hand+ |
| 52 | `relic-0236` | Plague Record | `plague-record` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Plague Record+ |
| 53 | `relic-0239` | Preserved Butterfly | `preserved-butterfly` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Preserved Butterfly+ |
| 54 | `relic-0241` | Prophet's Lamp | `prophets-lamp` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Prophet's Lamp+ |
| 55 | `relic-0242` | Proto Battery | `proto-battery` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Proto Battery+ |
| 56 | `relic-0251` | Putney Morning Post | `putney-morning-post` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Putney Morning Post+ |
| 57 | `relic-0252` | Radium Jawbone | `radium-jawbone` | N | ASTRAL_REIGN, EVENT | Gold | Radium Jawbone+, â˜†Radium Jawboneâ˜† |
| 58 | `relic-0253` | Relic of the Past | `relic-of-the-past` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Relic of the Past+ |
| 59 | `relic-0254` | Rhind Papyrus | `rhind-papyrus` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Rhind Papyrus+ |
| 60 | `relic-0255` | Rite of Spring | `rite-of-spring` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Painted Rite of Spring, Painted Rite of Spring+, Rite of Spring+ |
| 61 | `relic-0256` | Ritual Dagger | `ritual-dagger` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Ritual Dagger+ |
| 62 | `relic-0258` | Rusted Saw | `rusted-saw` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Painted Rusted Saw, Painted Rusted Saw+, Rusted Saw+ |
| 63 | `relic-0259` | Rusty Lancet | `rusty-lancet` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Rusty Lancet+ |
| 64 | `relic-0260` | Sacred Agony | `sacred-agony` | - | ASTRAL_REIGN, FADED_LEGACY | Cursed | - |
| 65 | `relic-0261` | Safe Passage | `safe-passage` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Safe Passage+ |
| 66 | `relic-0263` | Salvific Limb | `salvific-limb` | - | ASTRAL_REIGN, FADED_LEGACY | Cursed | - |
| 67 | `relic-0264` | Serpent's Husk | `serpents-husk` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Serpent's Husk+ |
| 68 | `relic-0265` | Severed Head Worm | `severed-head-worm` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Severed Head Worm+ |
| 69 | `relic-0269` | Silent Prelude | `silent-prelude` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Silent Prelude+ |
| 70 | `relic-0271` | Silver Tongue | `silver-tongue` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Silver Tongue+ |
| 71 | `relic-0273` | Solar Disc | `solar-disc` | N | ASTRAL_REIGN, FADED_LEGACY, EVENT | Gold | Solar Disc+ |
| 72 | `relic-0276` | Spatial Deflector | `spatial-deflector` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Spatial Deflector+ |
| 73 | `relic-0278` | Stellar Brew | `stellar-brew` | N | ASTRAL_REIGN, FADED_LEGACY, EVENT | Gold | Stellar Brew+ |
| 74 | `relic-0279` | Submersible Helm | `submersible-helm` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Submersible Helm+ |
| 75 | `relic-0281` | Swarm Mind | `swarm-mind` | - | ASTRAL_REIGN, FADED_LEGACY | Cursed | Blessed: Swarm Mind, Sinful: Swarm Mind |
| 76 | `relic-0283` | Tilted Scales | `tilted-scales` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Tilted Scales+ |
| 77 | `relic-0284` | Time Scarab | `time-scarab` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Time Scarab+ |
| 78 | `relic-0286` | Tiny Music Box | `tiny-music-box` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Tiny Music Box+ |
| 79 | `relic-0287` | Trickster's Hat | `tricksters-hat` | - | ASTRAL_REIGN, FADED_LEGACY | Cursed | - |
| 80 | `relic-0288` | Trigon Prism | `trigon-prism` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Trigon Prism+ |
| 81 | `relic-0289` | True North Compass | `true-north-compass` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | True North Compass+ |
| 82 | `relic-0290` | Truth Unbound | `truth-unbound` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Truth Unbound+ |
| 83 | `relic-0294` | Uncanny Salve | `uncanny-salve` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Uncanny Salve+ |
| 84 | `relic-0296` | Veil of the Nameless Deity | `veil-of-the-nameless-deity` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Veil of the Nameless Deity+ |
| 85 | `relic-0297` | Vision Corrector | `vision-corrector` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Vision Corrector+ |
| 86 | `relic-0298` | Vitality Injection | `vitality-injection` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Vitality Injection+ |
| 87 | `relic-0299` | Voyager's Parasol | `voyagers-parasol` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Voyager's Parasol+ |
| 88 | `relic-0300` | Wailing Bell | `wailing-bell` | - | ASTRAL_REIGN | Cursed | - |
| 89 | `relic-0302` | Weeping Pipe | `weeping-pipe` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Weeping Pipe+ |
| 90 | `relic-0304` | Wriggling Cord | `wriggling-cord` | - | ASTRAL_REIGN, FADED_LEGACY | Cursed | - |
| 91 | `relic-0305` | Yellow Snail | `yellow-snail` | N | ASTRAL_REIGN, FADED_LEGACY | Gold | Yellow Snail+ |

## Effects

### Astral Reign - Gold (78)

#### Alfonso's Artifact - Gold

- Relic: `relic-0061` | Slug: `alfonsos-artifact` | Rarity: `N`
- Variant: `relic-variant-0063` | name: `Alfonso's Artifact+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Alfonso's Artifact+

Template:

```text
Whenever a card enters {Ultra Space}, if the Awakener of this card is different from that of other cards in {Ultra Space}, place [Arg1] {derived:Insight} cards in hand.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "2"
             }
}
```

#### Arcana Archive - Gold

- Relic: `relic-0064` | Slug: `arcana-archive` | Rarity: `N`
- Variant: `relic-variant-0068` | name: `Arcana Archive+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Arcana Archive+

Template:

```text
When you play 2 consecutive cards with higher Arithmetica Cost than the previous one, gain [Arg1] {Counter}, up to 3 times per turn.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "computed",
                 "formulaKey":  "scaled",
                 "baseFormula":  "occultResearchDepth",
                 "multiplier":  0.12,
                 "inputs":  [
                                "accountLevel",
                                "ownedPosseCount"
                            ]
             }
}
```
- Resolved default (Account Lv 50, ownedPosseCount 50): `Arg1 = 182`

#### Arcana Relic - Gold

- Relic: `relic-0065` | Slug: `arcana-relic` | Rarity: `N`
- Variant: `relic-variant-0071` | name: `Arcana Relic+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Arcana Relic+

Template:

```text
When you play 2 consecutive cards with lower Arithmetica Cost than the previous one, Inflict [Arg1] {Poison} to all enemies, up to 3 times per turn.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "computed",
                 "formulaKey":  "scaled",
                 "baseFormula":  "occultResearchDepth",
                 "multiplier":  0.24,
                 "inputs":  [
                                "accountLevel",
                                "ownedPosseCount"
                            ]
             }
}
```
- Resolved default (Account Lv 50, ownedPosseCount 50): `Arg1 = 364`

#### Arcane Gloves - Gold

- Relic: `relic-0066` | Slug: `arcane-gloves` | Rarity: `N`
- Variant: `relic-variant-0073` | name: `Arcane Gloves+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `EVENT`
- Aliases: Arcane Gloves+, â˜†Arcane Glovesâ˜†

Template:

```text
After playing a card, if the number of cards in hand is less than or equal to [Arg1], draw [Arg2] {plural:[Arg2]|card|cards}. This effect can trigger up to [Arg3] {plural:[Arg3]|time|times} per turn.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "3"
             },
    "Arg2":  {
                 "kind":  "fixed",
                 "value":  "2"
             },
    "Arg3":  {
                 "kind":  "fixed",
                 "value":  "2"
             }
}
```

#### Blessed Blood - Gold

- Relic: `relic-0078` | Slug: `blessed-blood` | Rarity: `N`
- Variant: `relic-variant-0091` | name: `Blessed Blood+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Blessed Blood+, Painted Blessed Blood, Painted Blessed Blood+

Template:

```text
At turn end, restore [Heal:Arg1] HP.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "computed",
                 "formulaKey":  "scaled",
                 "baseFormula":  "esotericResearchDepth",
                 "multiplier":  0.1,
                 "inputs":  [
                                "accountLevel",
                                "ownedPosseCount"
                            ]
             }
}
```
- Resolved default (Account Lv 50, ownedPosseCount 50): `Arg1 = 74`

#### Bloody Pebble - Gold

- Relic: `relic-0079` | Slug: `bloody-pebble` | Rarity: `N`
- Variant: `relic-variant-0096` | name: `Bloody Pebble+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Bloody Pebble+, Painted Bloody Pebble, Painted Bloody Pebble+

Template:

```text
After directly using {Embryo} for the first time each turn, Active DMG will cause [Arg1]% of the DMG dealt as {Bleed} for the rest of the turn.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "30",
                 "suffix":  "%"
             }
}
```

#### Brand-New Wallet - Gold

- Relic: `relic-0081` | Slug: `brand-new-wallet` | Rarity: `N`
- Variant: `relic-variant-0102` | name: `Brand-New Wallet+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Brand-New Wallet+

Template:

```text
After using {Keyflare Rouse}, draw [Arg1] {plural:[Arg1]|card|cards} and gain [Arg2] Keyflare.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "4"
             },
    "Arg2":  {
                 "kind":  "fixed",
                 "value":  "200"
             }
}
```

#### Celestial Astrolabe - Gold

- Relic: `relic-0086` | Slug: `celestial-astrolabe` | Rarity: `N`
- Variant: `relic-variant-0109` | name: `Celestial Astrolabe+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Celestial Astrolabe+

Template:

```text
After using {Keyflare Rouse}, increase the Base DMG dealt by all Awakeners by [Arg1]% and gain [Arg2] Keyflare.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "20",
                 "suffix":  "%"
             },
    "Arg2":  {
                 "kind":  "fixed",
                 "value":  "200"
             }
}
```

#### Chant of the Tides - Gold

- Relic: `relic-0088` | Slug: `chant-of-the-tides` | Rarity: `N`
- Variant: `relic-variant-0113` | name: `Chant of the Tides+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Chant of the Tides+

Template:

```text
At battle start, Tentacle Limit +[Arg1], gain [Arg2] Tentacles.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "2"
             },
    "Arg2":  {
                 "kind":  "fixed",
                 "value":  "2"
             }
}
```

#### Chronometric Device - Gold

- Relic: `relic-0133` | Slug: `chronometric-device` | Rarity: `N`
- Variant: `relic-variant-0187` | name: `Chronometric Device+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Chronometric Device+

Template:

```text
After releasing the second "Posse" each turn, gain [Arg1] Keyflare, and all Awakeners gain [Arg2] Aliemus.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "500"
             },
    "Arg2":  {
                 "kind":  "fixed",
                 "value":  "10"
             }
}
```

#### Crimson Brooch - Gold

- Relic: `relic-0137` | Slug: `crimson-brooch` | Rarity: `N`
- Variant: `relic-variant-0193` | name: `Crimson Brooch+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Crimson Brooch+

Template:

```text
At the start of combat, gain [Arg1] {STR}.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "computed",
                 "formulaKey":  "scaled",
                 "baseFormula":  "esotericResearchDepth",
                 "multiplier":  0.1,
                 "inputs":  [
                                "accountLevel",
                                "ownedPosseCount"
                            ]
             }
}
```
- Resolved default (Account Lv 50, ownedPosseCount 50): `Arg1 = 74`

#### Dearest Babe - Gold

- Relic: `relic-0139` | Slug: `dearest-babe` | Rarity: `N`
- Variant: `relic-variant-0198` | name: `Dearest Babe+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Dearest Babe+

Template:

```text
Whenever 1 {Embryo} is generated, gain [Arg1] {Crimson Furnace}, up to 3 times per turn.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "computed",
                 "formulaKey":  "scaled",
                 "baseFormula":  "esotericResearchDepth",
                 "multiplier":  0.075,
                 "inputs":  [
                                "accountLevel",
                                "ownedPosseCount"
                            ]
             }
}
```
- Resolved default (Account Lv 50, ownedPosseCount 50): `Arg1 = 56`

#### Deceased's Chrono - Gold

- Relic: `relic-0140` | Slug: `deceaseds-chrono` | Rarity: `N`
- Variant: `relic-variant-0201` | name: `Deceased's Chrono+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Deceased's Chrono+

Template:

```text
When "Defense" is played, gain [Arg1] Temporary {Counter}, triggers a maximum of 3 times per turn.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "computed",
                 "formulaKey":  "scaled",
                 "baseFormula":  "occultResearchDepth",
                 "multiplier":  0.35,
                 "inputs":  [
                                "accountLevel",
                                "ownedPosseCount"
                            ]
             }
}
```
- Resolved default (Account Lv 50, ownedPosseCount 50): `Arg1 = 530`

#### Differential Engine - Gold

- Relic: `relic-0143` | Slug: `differential-engine` | Rarity: `N`
- Variant: `relic-variant-0205` | name: `Differential Engine+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `EVENT`
- Aliases: Differential Engine+, â˜†Differential Engineâ˜†

Template:

```text
After using Exalt 4 times in one turn, gain [Arg1] Arithmetica. 3 turns cooldown.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "6"
             }
}
```

#### Doctor's Case - Gold

- Relic: `relic-0152` | Slug: `doctors-case` | Rarity: `N`
- Variant: `relic-variant-0218` | name: `Doctor's Case+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Doctor's Case+

Template:

```text
At the start of the turn, if HP is below 50%, Temporary DMG Amplification +[Arg1]%. If HP is below 25%, draw [Arg2] additional cards and gain [Arg2] Arithmetica.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "50",
                 "suffix":  "%"
             },
    "Arg2":  {
                 "kind":  "fixed",
                 "value":  "2"
             }
}
```

#### Easter Moment - Gold

- Relic: `relic-0155` | Slug: `easter-moment` | Rarity: `N`
- Variant: `relic-variant-0223` | name: `Easter Moment+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Easter Moment+

Template:

```text
At turn start, all Awakeners whose Aliemus is insufficient to unleash Exalt gain [Arg1] Aliemus.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "20"
             }
}
```

#### Filigree Agate - Gold

- Relic: `relic-0164` | Slug: `filigree-agate` | Rarity: `N`
- Variant: `relic-variant-0237` | name: `Filigree Agate+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Filigree Agate+, Painted Filigree Agate, Painted Filigree Agate+

Template:

```text
Gain [Arg1] Temporary {STR} whenever DMG is dealt, up to 15 times per turn.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "computed",
                 "formulaKey":  "scaled",
                 "baseFormula":  "esotericResearchDepth",
                 "multiplier":  0.015,
                 "inputs":  [
                                "accountLevel",
                                "ownedPosseCount"
                            ]
             }
}
```
- Resolved default (Account Lv 50, ownedPosseCount 50): `Arg1 = 12`

#### Fleeting Beauty - Gold

- Relic: `relic-0166` | Slug: `fleeting-beauty` | Rarity: `N`
- Variant: `relic-variant-0243` | name: `Fleeting Beauty+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Fleeting Beauty+

Template:

```text
Gain [Arg1] Keyflare when "Exalt" is released.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "200"
             }
}
```

#### Foreign Stamp Album - Gold

- Relic: `relic-0167` | Slug: `foreign-stamp-album` | Rarity: `N`
- Variant: `relic-variant-0246` | name: `Foreign Stamp Album+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Foreign Stamp Album+

Template:

```text
After using {Keyflare Rouse}, grant {Retain} and {Prepare} to the [Arg1] {plural:[Arg1]|card|cards} with the highest Arithmetica in your hand before the next play, and gain [Arg2] Keyflare.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "4"
             },
    "Arg2":  {
                 "kind":  "fixed",
                 "value":  "200"
             }
}
```

#### Forgotten Loom - Gold

- Relic: `relic-0168` | Slug: `forgotten-loom` | Rarity: `N`
- Variant: `relic-variant-0249` | name: `Forgotten Loom+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `EVENT`, `OTHER`
- Aliases: Forgotten Loom+, â˜†Forgotten Loomâ˜†

Template:

```text
After the battle starts, gain [Arg1] Realm Mastery. All Awakener and Relic {Poison} effects are +[Arg2]%.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "200"
             },
    "Arg2":  {
                 "kind":  "fixed",
                 "value":  "20",
                 "suffix":  "%"
             }
}
```

#### Forgotten Prelude - Gold

- Relic: `relic-0169` | Slug: `forgotten-prelude` | Rarity: `N`
- Variant: `relic-variant-0252` | name: `Forgotten Prelude+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Forgotten Prelude+

Template:

```text
Use {Keyflare Rouse} and gain [Arg1] {Counter} and [Arg2] Keyflare.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "computed",
                 "formulaKey":  "scaled",
                 "baseFormula":  "occultResearchDepth",
                 "multiplier":  0.3,
                 "inputs":  [
                                "accountLevel",
                                "ownedPosseCount"
                            ]
             },
    "Arg2":  {
                 "kind":  "fixed",
                 "value":  "200"
             }
}
```
- Resolved default (Account Lv 50, ownedPosseCount 50): `Arg1 = 455`

#### Forsaken Blood - Gold

- Relic: `relic-0170` | Slug: `forsaken-blood` | Rarity: `N`
- Variant: `relic-variant-0255` | name: `Forsaken Blood+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Forsaken Blood+

Template:

```text
All Awakeners Base DMG +[Arg1]%. Immediately before unleashing Exalt, temporarily increase the Base DMG dealt by this Awakener by [Arg2]%.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "20",
                 "suffix":  "%"
             },
    "Arg2":  {
                 "kind":  "fixed",
                 "value":  "50",
                 "suffix":  "%"
             }
}
```

#### Gilded Reverie - Gold

- Relic: `relic-0174` | Slug: `gilded-reverie` | Rarity: `N`
- Variant: `relic-variant-0269` | name: `Gilded Reverie+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Gilded Reverie+, Painted Gilded Reverie, Painted Gilded Reverie+

Template:

```text
Each turn, when {Devour} occurs for the first time, other Awakeners gain [Arg1] Aliemus.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "20"
             }
}
```

#### Guardian Hand - Gold

- Relic: `relic-0176` | Slug: `guardian-hand` | Rarity: `N`
- Variant: `relic-variant-0275` | name: `Guardian Hand+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Guardian Hand+

Template:

```text
At turn start, if HP is below 25%, gain [Arg1] Shield.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "computed",
                 "formulaKey":  "scaled",
                 "baseFormula":  "esotericResearchDepth",
                 "multiplier":  0.25,
                 "inputs":  [
                                "accountLevel",
                                "ownedPosseCount"
                            ]
             }
}
```
- Resolved default (Account Lv 50, ownedPosseCount 50): `Arg1 = 184`

#### Harford's Elixir - Gold

- Relic: `relic-0178` | Slug: `harfords-elixir` | Rarity: `N`
- Variant: `relic-variant-0279` | name: `Harford's Elixir+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Harford's Elixir+

Template:

```text
The first "Posse" each turn grants Temporary DMG Amplification +[Arg1]%, with stronger effects at lower HP.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "50",
                 "suffix":  "%"
             }
}
```

#### Hierophant's Staff - Gold

- Relic: `relic-0180` | Slug: `hierophants-staff` | Rarity: `N`
- Variant: `relic-variant-0284` | name: `Hierophant's Staff+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`, `EVENT`
- Aliases: Hierophant's Staff+

Template:

```text
Gain [Arg1]% DMG Amplification At battle start. Deal Active DMG and inflict [Arg2] {Poison} on all enemies, triggering up to 5 times per turn.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "30",
                 "suffix":  "%"
             },
    "Arg2":  {
                 "kind":  "computed",
                 "formulaKey":  "scaled",
                 "baseFormula":  "occultResearchDepth",
                 "multiplier":  0.06,
                 "inputs":  [
                                "accountLevel",
                                "ownedPosseCount"
                            ]
             }
}
```
- Resolved default (Account Lv 50, ownedPosseCount 50): `Arg2 = 91`

#### Highest Honor - Gold

- Relic: `relic-0181` | Slug: `highest-honor` | Rarity: `N`
- Variant: `relic-variant-0287` | name: `Highest Honor+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Highest Honor+

Template:

```text
At turn start, if HP is below 25%, gain [Arg1] Temporary {STR}.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "computed",
                 "formulaKey":  "scaled",
                 "baseFormula":  "esotericResearchDepth",
                 "multiplier":  0.22,
                 "inputs":  [
                                "accountLevel",
                                "ownedPosseCount"
                            ]
             }
}
```
- Resolved default (Account Lv 50, ownedPosseCount 50): `Arg1 = 162`

#### Hyperstring Pocketwatch - Gold

- Relic: `relic-0185` | Slug: `hyperstring-pocketwatch` | Rarity: `N`
- Variant: `relic-variant-0293` | name: `Hyperstring Pocketwatch+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Hyperstring Pocketwatch+

Template:

```text
Gain [Arg1] Shield from {Annihilation}, with a cooldown of 3 turns.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "computed",
                 "formulaKey":  "scaled",
                 "baseFormula":  "esotericResearchDepth",
                 "multiplier":  0.4,
                 "inputs":  [
                                "accountLevel",
                                "ownedPosseCount"
                            ]
             }
}
```
- Resolved default (Account Lv 50, ownedPosseCount 50): `Arg1 = 294`

#### In Twilight - Gold

- Relic: `relic-0186` | Slug: `in-twilight` | Rarity: `N`
- Variant: `relic-variant-0296` | name: `In Twilight+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: In Twilight+

Template:

```text
At turn end, if Keyflare is full, consumes [Arg1] Keyflare to put a {derived:Silver Key Dawn} into hand.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "350"
             }
}
```

#### Iron Lock - Gold

- Relic: `relic-0188` | Slug: `iron-lock` | Rarity: `N`
- Variant: `relic-variant-0300` | name: `Iron Lock+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Iron Lock+, Painted Iron Lock, Painted Iron Lock+

Template:

```text
After releasing "Exalt, " gain [Arg1] Temporary {STR}.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "computed",
                 "formulaKey":  "scaled",
                 "baseFormula":  "esotericResearchDepth",
                 "multiplier":  0.0625,
                 "inputs":  [
                                "accountLevel",
                                "ownedPosseCount"
                            ]
             }
}
```
- Resolved default (Account Lv 50, ownedPosseCount 50): `Arg1 = 46`

#### Kaleidoscope - Gold

- Relic: `relic-0192` | Slug: `kaleidoscope` | Rarity: `N`
- Variant: `relic-variant-0311` | name: `Kaleidoscope+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Kaleidoscope+

Template:

```text
At the start of the battle, gain [Arg1]% DMG Amplification. For each Command Card played by a different Awakener, gain an additional [Arg1]% Temporary DMG Amplification.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "30",
                 "suffix":  "%"
             }
}
```

#### Laurel Cufflinks - Gold

- Relic: `relic-0196` | Slug: `laurel-cufflinks` | Rarity: `N`
- Variant: `relic-variant-0319` | name: `Laurel Cufflinks+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Laurel Cufflinks+

Template:

```text
After using {Keyflare Rouse}, all Awakeners gain [Arg1] Aliemus and [Arg2] Keyflare.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "20"
             },
    "Arg2":  {
                 "kind":  "fixed",
                 "value":  "200"
             }
}
```

#### Lemurian Delight - Gold

- Relic: `relic-0197` | Slug: `lemurian-delight` | Rarity: `N`
- Variant: `relic-variant-0322` | name: `Lemurian Delight+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Lemurian Delight+

Template:

```text
Activate all Tentacle attacks on enemies immediately using the {Raging Waves} stance [Arg1] {plural:[Arg1]|time|times}, with a 3-turn cooldown.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "2"
             }
}
```

#### Lucky Rabbit's Paw - Gold

- Relic: `relic-0204` | Slug: `lucky-rabbits-paw` | Rarity: `N`
- Variant: `relic-variant-0331` | name: `Lucky Rabbit's Paw+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Lucky Rabbit's Paw+

Template:

```text
The first "Posse" each turn refunds [Arg1]% of the consumed Keyflare.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "50",
                 "suffix":  "%"
             }
}
```

#### Luminous Hourglass - Gold

- Relic: `relic-0206` | Slug: `luminous-hourglass` | Rarity: `N`
- Variant: `relic-variant-0336` | name: `Luminous Hourglass+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Luminous Hourglass+

Template:

```text
After entering the {Ultra Round}, the first Non-Derived Command Card played activates an additional [Arg1] {plural:[Arg1]|time|times}.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "2"
             }
}
```

#### Malignant Child - Gold

- Relic: `relic-0207` | Slug: `malignant-child` | Rarity: `N`
- Variant: `relic-variant-0339` | name: `Malignant Child+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Malignant Child+, Painted Malignant Child, Painted Malignant Child+

Template:

```text
After the battle starts, Inflict [Arg1] {plural:[Arg1]|stack|stacks} of {Weakness} to all enemies, with the effect doubled in Boss Battles. All Awakeners' Base DMG is +[Arg2]%.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "2"
             },
    "Arg2":  {
                 "kind":  "fixed",
                 "value":  "30",
                 "suffix":  "%"
             }
}
```

#### Mute Jukebox - Gold

- Relic: `relic-0220` | Slug: `mute-jukebox` | Rarity: `N`
- Variant: `relic-variant-0360` | name: `Mute Jukebox+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Mute Jukebox+

Template:

```text
After playing a Non-Derived Command Card, shuffle [Arg1] temporary copies of that card with its Arithmetica Cost reduced by 2 into the Draw Pile. Cooldown: 3 turns.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "2"
             }
}
```

#### Mythag Insignia - Gold

- Relic: `relic-0222` | Slug: `mythag-insignia` | Rarity: `N`
- Variant: `relic-variant-0364` | name: `Mythag Insignia+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Mythag Insignia+

Template:

```text
After using {Keyflare Rouse}, gain [Arg1] Arithmetica and [Arg2] Keyflare.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "4"
             },
    "Arg2":  {
                 "kind":  "fixed",
                 "value":  "200"
             }
}
```

#### Nameless Appendage - Gold

- Relic: `relic-0223` | Slug: `nameless-appendage` | Rarity: `N`
- Variant: `relic-variant-0367` | name: `Nameless Appendage+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Nameless Appendage+

Template:

```text
Switching to {Tranquil Sea} stance makes all enemies lose [Arg1] Temporary {STRâ–¼}. 3-turn cooldown.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "computed",
                 "formulaKey":  "scaled",
                 "baseFormula":  "esotericResearchDepth",
                 "multiplier":  0.16,
                 "inputs":  [
                                "accountLevel",
                                "ownedPosseCount"
                            ]
             }
}
```
- Resolved default (Account Lv 50, ownedPosseCount 50): `Arg1 = 118`

#### Nettle Vest - Gold

- Relic: `relic-0224` | Slug: `nettle-vest` | Rarity: `N`
- Variant: `relic-variant-0370` | name: `Nettle Vest+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Nettle Vest+

Template:

```text
Gain [Arg1] {Counter} at the start of battle, effects are doubled in Boss Battles.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "computed",
                 "formulaKey":  "scaled",
                 "baseFormula":  "occultResearchDepth",
                 "multiplier":  0.4,
                 "inputs":  [
                                "accountLevel",
                                "ownedPosseCount"
                            ]
             }
}
```
- Resolved default (Account Lv 50, ownedPosseCount 50): `Arg1 = 606`

#### Neurotoxin - Gold

- Relic: `relic-0225` | Slug: `neurotoxin` | Rarity: `N`
- Variant: `relic-variant-0373` | name: `Neurotoxin+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Neurotoxin+

Template:

```text
At the start of battle, Inflict [Arg1] {Poison} to all enemies, with double effect in Boss Battles.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "computed",
                 "formulaKey":  "scaled",
                 "baseFormula":  "occultResearchDepth",
                 "multiplier":  0.8,
                 "inputs":  [
                                "accountLevel",
                                "ownedPosseCount"
                            ]
             }
}
```
- Resolved default (Account Lv 50, ownedPosseCount 50): `Arg1 = 1212`

#### Other Tongue - Gold

- Relic: `relic-0231` | Slug: `other-tongue` | Rarity: `N`
- Variant: `relic-variant-0388` | name: `Other Tongue+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Other Tongue+

Template:

```text
"Strike" inflicts {Poison} equal to [Arg1]% of DMG dealt, with a maximum of [Arg2] per turn.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "20"
             },
    "Arg2":  {
                 "kind":  "computed",
                 "formulaKey":  "scaled",
                 "baseFormula":  "occultResearchDepth",
                 "multiplier":  0.8,
                 "inputs":  [
                                "accountLevel",
                                "ownedPosseCount"
                            ]
             }
}
```
- Resolved default (Account Lv 50, ownedPosseCount 50): `Arg2 = 1212`

#### Our Home - Gold

- Relic: `relic-0232` | Slug: `our-home` | Rarity: `N`
- Variant: `relic-variant-0391` | name: `Our Home+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Our Home+

Template:

```text
Use {Keyflare Rouse} and gain [Arg1] {STR} and [Arg2] Keyflare.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "computed",
                 "formulaKey":  "scaled",
                 "baseFormula":  "esotericResearchDepth",
                 "multiplier":  0.05,
                 "inputs":  [
                                "accountLevel",
                                "ownedPosseCount"
                            ]
             },
    "Arg2":  {
                 "kind":  "fixed",
                 "value":  "200"
             }
}
```
- Resolved default (Account Lv 50, ownedPosseCount 50): `Arg1 = 37`

#### Phantom Hand - Gold

- Relic: `relic-0235` | Slug: `phantom-hand` | Rarity: `N`
- Variant: `relic-variant-0399` | name: `Phantom Hand+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Phantom Hand+

Template:

```text
At the start of the battle, all enemies lose [Arg1] Temporary {STRâ–¼}. Using {Crimson Furnace} will also trigger this effect, but has a 3-turn cooldown.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "computed",
                 "formulaKey":  "scaled",
                 "baseFormula":  "esotericResearchDepth",
                 "multiplier":  0.12,
                 "inputs":  [
                                "accountLevel",
                                "ownedPosseCount"
                            ]
             }
}
```
- Resolved default (Account Lv 50, ownedPosseCount 50): `Arg1 = 89`

#### Plague Record - Gold

- Relic: `relic-0236` | Slug: `plague-record` | Rarity: `N`
- Variant: `relic-variant-0402` | name: `Plague Record+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Plague Record+

Template:

```text
{Embryo Fusion} Automatic gain +[Arg1]%.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "200",
                 "suffix":  "%"
             }
}
```

#### Preserved Butterfly - Gold

- Relic: `relic-0239` | Slug: `preserved-butterfly` | Rarity: `N`
- Variant: `relic-variant-0407` | name: `Preserved Butterfly+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Preserved Butterfly+

Template:

```text
After using {Keyflare Rouse}, gain [Arg1] Shield and [Arg2] Keyflare.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "computed",
                 "formulaKey":  "scaled",
                 "baseFormula":  "esotericResearchDepth",
                 "multiplier":  0.3,
                 "inputs":  [
                                "accountLevel",
                                "ownedPosseCount"
                            ]
             },
    "Arg2":  {
                 "kind":  "fixed",
                 "value":  "200"
             }
}
```
- Resolved default (Account Lv 50, ownedPosseCount 50): `Arg1 = 221`

#### Prophet's Lamp - Gold

- Relic: `relic-0241` | Slug: `prophets-lamp` | Rarity: `N`
- Variant: `relic-variant-0411` | name: `Prophet's Lamp+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Prophet's Lamp+

Template:

```text
After the first "Posse" in each turn, apply [Arg1] {plural:[Arg1]|stack|stacks} of {Poison} to all enemies and gain [Arg2] {plural:[Arg2]|stack|stacks} of {Counter}.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "computed",
                 "formulaKey":  "scaled",
                 "baseFormula":  "occultResearchDepth",
                 "multiplier":  0.15,
                 "inputs":  [
                                "accountLevel",
                                "ownedPosseCount"
                            ]
             },
    "Arg2":  {
                 "kind":  "computed",
                 "formulaKey":  "scaled",
                 "baseFormula":  "occultResearchDepth",
                 "multiplier":  0.075,
                 "inputs":  [
                                "accountLevel",
                                "ownedPosseCount"
                            ]
             }
}
```
- Resolved default (Account Lv 50, ownedPosseCount 50): `Arg1 = 228`, `Arg2 = 114`

#### Proto Battery - Gold

- Relic: `relic-0242` | Slug: `proto-battery` | Rarity: `N`
- Variant: `relic-variant-0414` | name: `Proto Battery+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Proto Battery+

Template:

```text
At turn start, all Awakeners gain [Arg1] Aliemus.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "10"
             }
}
```

#### Putney Morning Post - Gold

- Relic: `relic-0251` | Slug: `putney-morning-post` | Rarity: `N`
- Variant: `relic-variant-0425` | name: `Putney Morning Post+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Putney Morning Post+

Template:

```text
Gain [Arg1]% DMG Amplification at the start of the Battle, and gain [Arg2] Arithmetica after receiving {Counter} for the first time each turn.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "30",
                 "suffix":  "%"
             },
    "Arg2":  {
                 "kind":  "fixed",
                 "value":  "2"
             }
}
```

#### Radium Jawbone - Gold

- Relic: `relic-0252` | Slug: `radium-jawbone` | Rarity: `N`
- Variant: `relic-variant-0427` | name: `Radium Jawbone+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `EVENT`
- Aliases: Radium Jawbone+, â˜†Radium Jawboneâ˜†

Template:

```text
After releasing "Exalt, " all enemies take 1 instance of {Pure DMG} equal to [Arg2]% of team's Max HP and trigger [Arg2]% {Poison}.
```

Args:

```json
{
    "Arg2":  {
                 "kind":  "fixed",
                 "value":  "30",
                 "suffix":  "%"
             }
}
```

#### Relic of the Past - Gold

- Relic: `relic-0253` | Slug: `relic-of-the-past` | Rarity: `N`
- Variant: `relic-variant-0430` | name: `Relic of the Past+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Relic of the Past+

Template:

```text
At the start of battle and after triggering {Death Resistance}, gain [Arg1] Keyflare.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "1000"
             }
}
```

#### Rhind Papyrus - Gold

- Relic: `relic-0254` | Slug: `rhind-papyrus` | Rarity: `N`
- Variant: `relic-variant-0433` | name: `Rhind Papyrus+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Rhind Papyrus+

Template:

```text
Gain [Arg1]% DMG Amplification at the start of the battle. After applying {Poison} for the first time each turn, draw [Arg2] {plural:[Arg2]|card|cards}.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "30",
                 "suffix":  "%"
             },
    "Arg2":  {
                 "kind":  "fixed",
                 "value":  "2"
             }
}
```

#### Rite of Spring - Gold

- Relic: `relic-0255` | Slug: `rite-of-spring` | Rarity: `N`
- Variant: `relic-variant-0436` | name: `Rite of Spring+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Painted Rite of Spring, Painted Rite of Spring+, Rite of Spring+

Template:

```text
After the battle starts, Inflict [Arg1] {plural:[Arg1]|stack|stacks} of {Vulnerable} to all enemies, with the effect doubled in Boss Battles. All Awakener base DMG is +[Arg2]%.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "2"
             },
    "Arg2":  {
                 "kind":  "fixed",
                 "value":  "30",
                 "suffix":  "%"
             }
}
```

#### Ritual Dagger - Gold

- Relic: `relic-0256` | Slug: `ritual-dagger` | Rarity: `N`
- Variant: `relic-variant-0441` | name: `Ritual Dagger+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Ritual Dagger+

Template:

```text
When attacked by an enemy, deal {Pure DMG} equal to [Arg3]% of team's Max HP. This DMG enjoys a [Arg2]% {Counter} bonus. Each enemy can trigger this effect up to 1 time per turn.
```

Args:

```json
{
    "Arg2":  {
                 "kind":  "fixed",
                 "value":  "200",
                 "suffix":  "%"
             },
    "Arg3":  {
                 "kind":  "fixed",
                 "value":  "50",
                 "suffix":  "%"
             }
}
```

#### Rusted Saw - Gold

- Relic: `relic-0258` | Slug: `rusted-saw` | Rarity: `N`
- Variant: `relic-variant-0445` | name: `Rusted Saw+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Painted Rusted Saw, Painted Rusted Saw+, Rusted Saw+

Template:

```text
Upon losing a HP, the {Crimson Furnace} grants [Arg1]% of the HP loss.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "20",
                 "suffix":  "%"
             }
}
```

#### Rusty Lancet - Gold

- Relic: `relic-0259` | Slug: `rusty-lancet` | Rarity: `N`
- Variant: `relic-variant-0450` | name: `Rusty Lancet+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Rusty Lancet+

Template:

```text
"Strike" additionally deals DMG equal to [Arg1]% of the Awakener's ATK 2 more times, triggering up to 3 times per turn.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "60",
                 "suffix":  "%"
             }
}
```

#### Safe Passage - Gold

- Relic: `relic-0261` | Slug: `safe-passage` | Rarity: `N`
- Variant: `relic-variant-0455` | name: `Safe Passage+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Safe Passage+

Template:

```text
Gain [Arg1]% DMG Amplification at the start of battle. After taking damage, gain [Arg2] {Counter}, triggering a maximum of 3 times per turn.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "30",
                 "suffix":  "%"
             },
    "Arg2":  {
                 "kind":  "computed",
                 "formulaKey":  "scaled",
                 "baseFormula":  "occultResearchDepth",
                 "multiplier":  0.06,
                 "inputs":  [
                                "accountLevel",
                                "ownedPosseCount"
                            ]
             }
}
```
- Resolved default (Account Lv 50, ownedPosseCount 50): `Arg2 = 91`

#### Serpent's Husk - Gold

- Relic: `relic-0264` | Slug: `serpents-husk` | Rarity: `N`
- Variant: `relic-variant-0461` | name: `Serpent's Husk+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Serpent's Husk+

Template:

```text
All Awakeners' base effects for HP Recovery and Shield are +[Arg1]%.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "20",
                 "suffix":  "%"
             }
}
```

#### Severed Head Worm - Gold

- Relic: `relic-0265` | Slug: `severed-head-worm` | Rarity: `N`
- Variant: `relic-variant-0464` | name: `Severed Head Worm+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Severed Head Worm+

Template:

```text
At turn end, if in {Surging Tides} stance, gain [Arg1] {Tentacle DMG}, 3 turn cooldown.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "computed",
                 "formulaKey":  "scaled",
                 "baseFormula":  "esotericResearchDepth",
                 "multiplier":  0.1,
                 "inputs":  [
                                "accountLevel",
                                "ownedPosseCount"
                            ]
             }
}
```
- Resolved default (Account Lv 50, ownedPosseCount 50): `Arg1 = 74`

#### Silent Prelude - Gold

- Relic: `relic-0269` | Slug: `silent-prelude` | Rarity: `N`
- Variant: `relic-variant-0471` | name: `Silent Prelude+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Silent Prelude+

Template:

```text
Draw or discard a card to gain [Arg1] Temporary {STR}, triggering a maximum of 15 times per turn.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "computed",
                 "formulaKey":  "scaled",
                 "baseFormula":  "esotericResearchDepth",
                 "multiplier":  0.0125,
                 "inputs":  [
                                "accountLevel",
                                "ownedPosseCount"
                            ]
             }
}
```
- Resolved default (Account Lv 50, ownedPosseCount 50): `Arg1 = 10`

#### Silver Tongue - Gold

- Relic: `relic-0271` | Slug: `silver-tongue` | Rarity: `N`
- Variant: `relic-variant-0475` | name: `Silver Tongue+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Silver Tongue+

Template:

```text
All Awakeners gain [Arg1] Keyflare from their first "Command Card" each turn.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "200"
             }
}
```

#### Solar Disc - Gold

- Relic: `relic-0273` | Slug: `solar-disc` | Rarity: `N`
- Variant: `relic-variant-0480` | name: `Solar Disc+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`, `EVENT`
- Aliases: Solar Disc+

Template:

```text
After the battle starts, gain [Arg1] Realm Mastery. Draw [Arg2] {plural:[Arg2]|card|cards} at the start of odd turns, and gain [Arg2] Arithmetica at the start of even turns.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "100"
             },
    "Arg2":  {
                 "kind":  "fixed",
                 "value":  "2"
             }
}
```

#### Spatial Deflector - Gold

- Relic: `relic-0276` | Slug: `spatial-deflector` | Rarity: `N`
- Variant: `relic-variant-0485` | name: `Spatial Deflector+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Spatial Deflector+

Template:

```text
Battle starts by inflicting [Arg1] {plural:[Arg1]|stack|stacks} of {Weakness} and {Vulnerable} on all enemies. This effect will also trigger after {Annihilation}, but has a 3 turn cooldown.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "2"
             }
}
```

#### Stellar Brew - Gold

- Relic: `relic-0278` | Slug: `stellar-brew` | Rarity: `N`
- Variant: `relic-variant-0490` | name: `Stellar Brew+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`, `EVENT`
- Aliases: Stellar Brew+

Template:

```text
After every 5 uses of "Exalt," the next [Arg1] Non-Derived Command Card takes effect 1 more time.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "2"
             }
}
```

#### Submersible Helm - Gold

- Relic: `relic-0279` | Slug: `submersible-helm` | Rarity: `N`
- Variant: `relic-variant-0493` | name: `Submersible Helm+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Submersible Helm+

Template:

```text
After dealing active or {Tentacle DMG}, increases the target's {Tentacle DMG} taken by [Arg1]% for the remainder of the turn. Can trigger up to 20 times per turn.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "2",
                 "suffix":  "%"
             }
}
```

#### Tilted Scales - Gold

- Relic: `relic-0283` | Slug: `tilted-scales` | Rarity: `N`
- Variant: `relic-variant-0502` | name: `Tilted Scales+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Tilted Scales+

Template:

```text
Before turn end, each Awakener to which a Command Card in hand belongs gains [Arg1] Aliemus.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "6"
             }
}
```

#### Time Scarab - Gold

- Relic: `relic-0284` | Slug: `time-scarab` | Rarity: `N`
- Variant: `relic-variant-0505` | name: `Time Scarab+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Time Scarab+

Template:

```text
{Annihilation} grants the Awakener with the lowest Aliemus gains [Arg1] Aliemus, with a cooldown of 3 turns.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "100"
             }
}
```

#### Tiny Music Box - Gold

- Relic: `relic-0286` | Slug: `tiny-music-box` | Rarity: `N`
- Variant: `relic-variant-0509` | name: `Tiny Music Box+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Tiny Music Box+

Template:

```text
Gain [Arg1] {STR} at the start of the battle. Each time you play a card with {Exhaust}, gain [Arg2] Temporary {STR}, triggering up to 10 times per turn.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "computed",
                 "formulaKey":  "scaled",
                 "baseFormula":  "esotericResearchDepth",
                 "multiplier":  0.07,
                 "inputs":  [
                                "accountLevel",
                                "ownedPosseCount"
                            ]
             },
    "Arg2":  {
                 "kind":  "computed",
                 "formulaKey":  "scaled",
                 "baseFormula":  "esotericResearchDepth",
                 "multiplier":  0.02,
                 "inputs":  [
                                "accountLevel",
                                "ownedPosseCount"
                            ]
             }
}
```
- Resolved default (Account Lv 50, ownedPosseCount 50): `Arg1 = 52`, `Arg2 = 15`

#### Trigon Prism - Gold

- Relic: `relic-0288` | Slug: `trigon-prism` | Rarity: `N`
- Variant: `relic-variant-0514` | name: `Trigon Prism+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Trigon Prism+

Template:

```text
Whenever a card enters the {Ultra Space}, draw [Arg1] Command Cards belonging to this card's owner from the Draw Pile. If unable to draw, gain an equal amount of Arithmetica instead. This effect can trigger at most 2 times per turn.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "2"
             }
}
```

#### True North Compass - Gold

- Relic: `relic-0289` | Slug: `true-north-compass` | Rarity: `N`
- Variant: `relic-variant-0517` | name: `True North Compass+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: True North Compass+

Template:

```text
At turn start, draw [Arg1] {plural:[Arg1]|card|cards}.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "2"
             }
}
```

#### Truth Unbound - Gold

- Relic: `relic-0290` | Slug: `truth-unbound` | Rarity: `N`
- Variant: `relic-variant-0520` | name: `Truth Unbound+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Truth Unbound+

Template:

```text
After the battle starts, gain [Arg1] Realm Mastery. All Awakeners' {Counter} and Relics' {Counter} DMG +[Arg2]%.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "200"
             },
    "Arg2":  {
                 "kind":  "fixed",
                 "value":  "20",
                 "suffix":  "%"
             }
}
```

#### Uncanny Salve - Gold

- Relic: `relic-0294` | Slug: `uncanny-salve` | Rarity: `N`
- Variant: `relic-variant-0526` | name: `Uncanny Salve+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Uncanny Salve+

Template:

```text
Use {Keyflare Rouse} to inflict [Arg1] {Poison} on all enemies and gain [Arg2] Keyflare.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "computed",
                 "formulaKey":  "scaled",
                 "baseFormula":  "occultResearchDepth",
                 "multiplier":  0.6,
                 "inputs":  [
                                "accountLevel",
                                "ownedPosseCount"
                            ]
             },
    "Arg2":  {
                 "kind":  "fixed",
                 "value":  "200"
             }
}
```
- Resolved default (Account Lv 50, ownedPosseCount 50): `Arg1 = 909`

#### Veil of the Nameless Deity - Gold

- Relic: `relic-0296` | Slug: `veil-of-the-nameless-deity` | Rarity: `N`
- Variant: `relic-variant-0530` | name: `Veil of the Nameless Deity+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Veil of the Nameless Deity+

Template:

```text
All Awakeners gain [Arg1] Aliemus when 4 different Awakeners' Command Cards are played consecutively in the same turn. 3-turn cooldown.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "40"
             }
}
```

#### Vision Corrector - Gold

- Relic: `relic-0297` | Slug: `vision-corrector` | Rarity: `N`
- Variant: `relic-variant-0533` | name: `Vision Corrector+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Vision Corrector+

Template:

```text
Increase the DMG of the first five attacks dealt each turn by [Arg1]%.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "30",
                 "suffix":  "%"
             }
}
```

#### Vitality Injection - Gold

- Relic: `relic-0298` | Slug: `vitality-injection` | Rarity: `N`
- Variant: `relic-variant-0536` | name: `Vitality Injection+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Vitality Injection+

Template:

```text
Max Arithmetica +[Arg1].
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "2"
             }
}
```

#### Voyager's Parasol - Gold

- Relic: `relic-0299` | Slug: `voyagers-parasol` | Rarity: `N`
- Variant: `relic-variant-0539` | name: `Voyager's Parasol+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Voyager's Parasol+

Template:

```text
Restores [Heal:Arg1] HP and grants [Arg2] Keyflare after using {Keyflare Rouse}.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "computed",
                 "formulaKey":  "scaled",
                 "baseFormula":  "esotericResearchDepth",
                 "multiplier":  0.2,
                 "inputs":  [
                                "accountLevel",
                                "ownedPosseCount"
                            ]
             },
    "Arg2":  {
                 "kind":  "fixed",
                 "value":  "200"
             }
}
```
- Resolved default (Account Lv 50, ownedPosseCount 50): `Arg1 = 147`

#### Weeping Pipe - Gold

- Relic: `relic-0302` | Slug: `weeping-pipe` | Rarity: `N`
- Variant: `relic-variant-0544` | name: `Weeping Pipe+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Weeping Pipe+

Template:

```text
The Base DMG dealt by all Awakeners +[Arg1]%.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "60",
                 "suffix":  "%"
             }
}
```

#### Yellow Snail - Gold

- Relic: `relic-0305` | Slug: `yellow-snail` | Rarity: `N`
- Variant: `relic-variant-0553` | name: `Yellow Snail+` | label: `Astral Reign - Gold` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Yellow Snail+

Template:

```text
The first "Posse" activation each turn triggers all Tentacle attacks [Arg1] {plural:[Arg1]|time|times} against enemies, dealing 50% DMG.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "2"
             }
}
```

### Astral Reign - Cursed (13)

#### Black Candle - Cursed

- Relic: `relic-0076` | Slug: `black-candle` | Rarity: `-`
- Variant: `relic-variant-0087` | name: `Black Candle` | label: `Astral Reign - Cursed` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Blessed: Black Candle, Sinful: Black Candle

Template:

```text
Increase all Awakeners' Base DMG by [Arg1]%. Each time the deck is reset, an additional [Arg2]% is granted, but a {Stagger} card is added to your hand. The maximum increase is [Arg3]%.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "50",
                 "suffix":  "%"
             },
    "Arg2":  {
                 "kind":  "fixed",
                 "value":  "10",
                 "suffix":  "%"
             },
    "Arg3":  {
                 "kind":  "fixed",
                 "value":  "100",
                 "suffix":  "%"
             }
}
```

#### Eerie Hook - Cursed

- Relic: `relic-0157` | Slug: `eerie-hook` | Rarity: `-`
- Variant: `relic-variant-0228` | name: `Eerie Hook` | label: `Astral Reign - Cursed` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Blessed: Eerie Hook, Sinful: Eerie Hook

Template:

```text
When you play 4 Command Cards belonging to different Awakeners within a single turn, increase the Final DMG dealt by all Awakeners this turn by [Arg1]%, and lose [Arg2] Aliemus. This can only be triggered once per turn.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "35",
                 "suffix":  "%"
             },
    "Arg2":  {
                 "kind":  "fixed",
                 "value":  "5"
             }
}
```

#### Jade Imprint - Cursed

- Relic: `relic-0190` | Slug: `jade-imprint` | Rarity: `-`
- Variant: `relic-variant-0307` | name: `Jade Imprint` | label: `Astral Reign - Cursed` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Blessed: Jade Imprint, Sinful: Jade Imprint

Template:

```text
After using {Keyflare Rouse}, choose [Arg1] Non-Derived Command Card corresponding to that Awakener in your hand. {Exhaust} that card to place [Arg2] Base Copy of it into the Draw Pile, hand, and Discard Pile respectively.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "1"
             },
    "Arg2":  {
                 "kind":  "fixed",
                 "value":  "1"
             }
}
```

#### Mind Engraving - Cursed

- Relic: `relic-0216` | Slug: `mind-engraving` | Rarity: `-`
- Variant: `relic-variant-0353` | name: `Mind Engraving` | label: `Astral Reign - Cursed` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Blessed: Mind Engraving, Sinful: Mind Engraving

Template:

```text
After using {Keyflare Rouse}, consume an additional [Arg1] Keyflare, reducing the Arithmetica Cost of the received {Rouse} card to 0. Upon playing, the corresponding Awakener gains an additional [Arg2] Aliemus.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "500"
             },
    "Arg2":  {
                 "kind":  "fixed",
                 "value":  "30"
             }
}
```

#### Nightmare Manifest - Cursed

- Relic: `relic-0226` | Slug: `nightmare-manifest` | Rarity: `-`
- Variant: `relic-variant-0377` | name: `Nightmare Manifest` | label: `Astral Reign - Cursed` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Blessed: Nightmare Manifest, Sinful: Nightmare Manifest

Template:

```text
At turn start, if Keyflare is greater than [Arg1], consume [Arg1] Keyflare to put 1 {Adv. Insight} into hand.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "500"
             }
}
```

#### Omen Ritual Bird - Cursed

- Relic: `relic-0229` | Slug: `omen-ritual-bird` | Rarity: `-`
- Variant: `relic-variant-0384` | name: `Omen Ritual Bird` | label: `Astral Reign - Cursed` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Blessed: Omen Ritual Bird, Sinful: Omen Ritual Bird

Template:

```text
Gain [Arg1] {STR} At battle start. At turn start, for each [Arg2] Permanent {STR}, gain [Arg3] Temporary {STR}, up to [Arg4] Temporary {STR}, and lose Shield equals to half of the Temporary {STR} gained by that Relic at turn end.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "computed",
                 "formulaKey":  "scaled",
                 "baseFormula":  "esotericResearchDepth",
                 "multiplier":  0.05,
                 "inputs":  [
                                "accountLevel",
                                "ownedPosseCount"
                            ]
             },
    "Arg2":  {
                 "kind":  "fixed",
                 "value":  "4"
             },
    "Arg3":  {
                 "kind":  "fixed",
                 "value":  "1"
             },
    "Arg4":  {
                 "kind":  "fixed",
                 "value":  "200"
             }
}
```
- Resolved default (Account Lv 50, ownedPosseCount 50): `Arg1 = 37`

#### Pathwalker's Remains - Cursed

- Relic: `relic-0234` | Slug: `pathwalkers-remains` | Rarity: `-`
- Variant: `relic-variant-0396` | name: `Pathwalker's Remains` | label: `Astral Reign - Cursed` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Blessed: Pathwalker's Remains, Sinful: Pathwalker's Remains

Template:

```text
At turn start, gain [Arg1] {Counter}. After using Exalt [Arg2] {plural:[Arg2]|time|times} in one turn, remove [Arg3]% Permanent {Counter}, and gain [Arg4]% of the removed amount as Temporary {Counter}. Cooldown: [Arg5] {plural:[Arg5]|turn|turns}.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "computed",
                 "formulaKey":  "scaled",
                 "baseFormula":  "occultResearchDepth",
                 "multiplier":  0.2,
                 "inputs":  [
                                "accountLevel",
                                "ownedPosseCount"
                            ]
             },
    "Arg2":  {
                 "kind":  "fixed",
                 "value":  "3"
             },
    "Arg3":  {
                 "kind":  "fixed",
                 "value":  "25",
                 "suffix":  "%"
             },
    "Arg4":  {
                 "kind":  "fixed",
                 "value":  "500",
                 "suffix":  "%"
             },
    "Arg5":  {
                 "kind":  "fixed",
                 "value":  "3"
             }
}
```
- Resolved default (Account Lv 50, ownedPosseCount 50): `Arg1 = 303`

#### Sacred Agony - Cursed

- Relic: `relic-0260` | Slug: `sacred-agony` | Rarity: `-`
- Variant: `relic-variant-0452` | name: `Sacred Agony` | label: `Astral Reign - Cursed` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: -

Template:

```text
At turn start, if there are more than [Arg1] Permanent Tentacles, lose [Arg2] Tentacles to gain [Arg3] Temporary Tentacles, otherwise gain [Arg4] Permanent Tentacles.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "1"
             },
    "Arg2":  {
                 "kind":  "fixed",
                 "value":  "1"
             },
    "Arg3":  {
                 "kind":  "fixed",
                 "value":  "3"
             },
    "Arg4":  {
                 "kind":  "fixed",
                 "value":  "1"
             }
}
```

#### Salvific Limb - Cursed

- Relic: `relic-0263` | Slug: `salvific-limb` | Rarity: `-`
- Variant: `relic-variant-0458` | name: `Salvific Limb` | label: `Astral Reign - Cursed` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: -

Template:

```text
At the start of the battle, inflict [Arg1] {Poison} on all enemies. At turn start, remove [Arg2]% of the enemy's {Poison} and inflict [Arg3]% of the removed amount as {Bleeding}.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "computed",
                 "formulaKey":  "scaled",
                 "baseFormula":  "occultResearchDepth",
                 "multiplier":  0.8,
                 "inputs":  [
                                "accountLevel",
                                "ownedPosseCount"
                            ]
             },
    "Arg2":  {
                 "kind":  "fixed",
                 "value":  "25",
                 "suffix":  "%"
             },
    "Arg3":  {
                 "kind":  "fixed",
                 "value":  "500",
                 "suffix":  "%"
             }
}
```
- Resolved default (Account Lv 50, ownedPosseCount 50): `Arg1 = 1212`

#### Swarm Mind - Cursed

- Relic: `relic-0281` | Slug: `swarm-mind` | Rarity: `-`
- Variant: `relic-variant-0498` | name: `Swarm Mind` | label: `Astral Reign - Cursed` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: Blessed: Swarm Mind, Sinful: Swarm Mind

Template:

```text
At turn start, gain [Arg1] {STR} for every 1 vacant space in {Ultra Space}, but suffer [Arg2] {plural:[Arg2]|stack|stacks} of {Poison}.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "computed",
                 "formulaKey":  "scaled",
                 "baseFormula":  "esotericResearchDepth",
                 "multiplier":  0.01,
                 "inputs":  [
                                "accountLevel",
                                "ownedPosseCount"
                            ]
             },
    "Arg2":  {
                 "kind":  "computed",
                 "formulaKey":  "scaled",
                 "baseFormula":  "accountStageGrowth",
                 "multiplier":  0.005,
                 "inputs":  [
                                "accountLevel"
                            ]
             }
}
```
- Resolved default (Account Lv 50, ownedPosseCount 50): `Arg1 = 8`, `Arg2 = 3`

#### Trickster's Hat - Cursed

- Relic: `relic-0287` | Slug: `tricksters-hat` | Rarity: `-`
- Variant: `relic-variant-0511` | name: `Trickster's Hat` | label: `Astral Reign - Cursed` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: -

Template:

```text
After the draw phase, draw [Arg1] {plural:[Arg1]|additional card|additional cards}. and choose [Arg2] {plural:[Arg2]|card|cards} from your hand to discard.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "3"
             },
    "Arg2":  {
                 "kind":  "fixed",
                 "value":  "2"
             }
}
```

#### Wailing Bell - Cursed

- Relic: `relic-0300` | Slug: `wailing-bell` | Rarity: `-`
- Variant: `relic-variant-0540` | name: `Wailing Bell` | label: `Astral Reign - Cursed` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`
- Aliases: -

Template:

```text
At turn start, draw [Arg1] less cards. Gain 1 Arithmetica for each card played with Arithmetica Cost >= [Arg2], triggering up to [Arg3] {plural:[Arg3]|time|times} per turn.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "1"
             },
    "Arg2":  {
                 "kind":  "fixed",
                 "value":  "3"
             },
    "Arg3":  {
                 "kind":  "fixed",
                 "value":  "3"
             }
}
```

#### Wriggling Cord - Cursed

- Relic: `relic-0304` | Slug: `wriggling-cord` | Rarity: `-`
- Variant: `relic-variant-0550` | name: `Wriggling Cord` | label: `Astral Reign - Cursed` | variantType: `STANDARD`
- Categories: `ASTRAL_REIGN`, `FADED_LEGACY`
- Aliases: -

Template:

```text
At turn start, {Embryo Fusion} +[Arg1]. {Embryo} cards will be discarded at turn end.
```

Args:

```json
{
    "Arg1":  {
                 "kind":  "fixed",
                 "value":  "100"
             }
}
```

## Caveats

- Values in `descriptionArgs` are raw. `fixed` values are literal; `computed` values are annotated with a `Resolved default` line using accountLevel 50 / ownedPosseCount 50 (see *Resolved default values*). Resolved values are Astral Reign values (owned-posse research bonus applied); `accountStageGrowth` args (Swarm Mind `Arg2`) do not receive the posse bonus.
- `{Token}` and `[ArgN]` placeholders are preserved exactly as in SKeyDB source.
- Faded Legacy variants of these same families exist (`Cursed`, `Blessed`, `Sinful`) and are deliberately excluded. The Faded Legacy `Cursed` variant is a distinct effect from the Astral Reign `Cursed` variant where both exist.
- Some families carry extra categories (`EVENT`, `OTHER`); those extra-category variants are also excluded here.
- SKeyDB is unofficial fan data licensed CC BY-NC-SA 4.0; game text/assets remain Qookka Games property.

## MotherTree mapping notes

- MotherTree currently has no relic model. Existing gear-like data uses `*_tag_manifestation` tables (`posse_tag_manifestation`, `wheel_tag_manifestation`, `covenant_tag_manifestation`).
- A relic update would likely add an analogous `relic_tag_manifestation` (or dedicated relic/variant) table plus tag/interaction rows, following the same verified/pending pattern used by the Kit Reader.
- Each row here maps cleanly to one variant: source key `relic-####` + `relic-variant-####`, name, category/tier, and effect text. Preserve `descriptionTemplate` verbatim and store `descriptionArgs` as structured metadata rather than flattening computed formulas.
- Decide per MotherTree convention whether effect text is stored as raw template + args or rendered prose. This file preserves the raw form.
