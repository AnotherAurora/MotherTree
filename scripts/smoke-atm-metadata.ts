/**
 * Kit Reader ATM metadata helpers.
 * Run: npx tsx scripts/smoke-atm-metadata.ts
 */
import {
  buildAtmMetadata,
  effectLabelFromTagName,
  resolveInsertMetadata,
} from "../src/lib/kit-reader/atm-metadata";
import {
  buildKitPackSourceLabelIndex,
  loadKitPackSourceLabelIndex,
  resolveSourceLabelFromIndex,
} from "../src/lib/kit-reader/resolve-source-label";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { KitPack } from "../src/lib/kit-reader/build-kit-pack";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ok — ${msg}`);
}

console.log("effectLabelFromTagName — trailing .Fixed");

assert(
  effectLabelFromTagName("Support.STR Up.Fixed") === "STR Up",
  "Support.STR Up.Fixed → STR Up",
);
assert(
  effectLabelFromTagName("Defender.Shield.Fixed") === "Shield",
  "Defender.Shield.Fixed → Shield",
);
assert(
  effectLabelFromTagName("Support.Tentacle Damage Up.Fixed") ===
    "Tentacle Damage Up",
  "Support.Tentacle Damage Up.Fixed → Tentacle Damage Up",
);
assert(
  effectLabelFromTagName("Attacker.Active Damage.Fixed Damage") ===
    "Active Damage.Fixed Damage",
  "Active Damage.Fixed Damage unchanged (not a trailing .Fixed suffix)",
);
assert(
  effectLabelFromTagName("Attacker.Active Damage") === "Active Damage",
  "Attacker.Active Damage unchanged",
);

console.log("buildAtmMetadata");

assert(
  buildAtmMetadata({
    sourceLabel: "Exalt",
    tagName: "Defender.Shield.Fixed",
  }) === "Exalt Shield",
  "Exalt + Shield.Fixed → Exalt Shield",
);
assert(
  buildAtmMetadata({
    sourceLabel: "0 Cost",
    tagName: "Support.STR Up.Fixed",
    requiredEnlightenment: 2,
  }) === "0 Cost STR Up E2",
  "enlightenment suffix still appends after .Fixed strip",
);

console.log("resolveInsertMetadata");

assert(
  resolveInsertMetadata({
    sourceLabel: "AA",
    tagName: "Support.Tentacle Damage Up.Fixed",
  }) === "AA Tentacle Damage Up",
  "AA + Tentacle Damage Up.Fixed → AA Tentacle Damage Up",
);
assert(
  resolveInsertMetadata({
    sourceLabel: "Talent",
    tagName: "Support.Tentacle Damage Up.Fixed",
    metadataSuffix: "+ SF",
  }) === "Talent Tentacle Damage Up + SF",
  "Talent + metadataSuffix + SF",
);
assert(
  resolveInsertMetadata({
    sourceLabel: "SF",
    tagName: "Support.Increase Gain.Poison",
    metadataSuffix: "+ SF",
  }) === "SF Increase Gain.Poison",
  "SF sourceLabel skips redundant + SF suffix",
);
assert(
  resolveInsertMetadata({
    sourceLabel: "OE",
    tagName: "Defender.Heal.Fixed",
    metadataOverride: "OE Heal *3",
  }) === "OE Heal *3",
  "metadataOverride wins",
);
assert(
  resolveInsertMetadata({
    sourceLabel: "0 Cost",
    tagName: "Defender.Heal.Fixed",
    requiredEnlightenment: 2,
  }) === "0 Cost Heal E2",
  "E2 enlightenment suffix on Heal.Fixed",
);

console.log("resolve-source-label");

const celestePack = JSON.parse(
  readFileSync(
    resolve(process.cwd(), "sample-data/kit-reader/celeste.kit.json"),
    "utf8",
  ),
) as KitPack;
const index = buildKitPackSourceLabelIndex(celestePack);
assert(
  resolveSourceLabelFromIndex(index, "skill.celeste.defense") === "Defense",
  "skill base → sourceLabel",
);
assert(
  resolveSourceLabelFromIndex(index, "enlighten.celeste.imaginary-cathuria") ===
    "AA",
  "AbsoluteAxiom upgrade → AA",
);
assert(
  resolveSourceLabelFromIndex(index, "talent.celeste.soulforge-aptitude") ===
    "SF",
  "Soulforge talent → SF",
);
assert(
  loadKitPackSourceLabelIndex("sample-data/kit-reader/celeste.kit.json").get(
    "skill.celeste.strike",
  ) === "Strike",
  "loadKitPackSourceLabelIndex from path",
);

console.log("\nAll smoke-atm-metadata checks passed.");
