/**
 * Smoke: Kit Reader Steal → STR Down + STR Up pairing helpers.
 *
 *   npx tsx scripts/smoke-kit-reader-steal.ts
 */
import {
  detectStealClause,
  parseStealStrScalar,
  warnStealMissingStrUpPair,
} from "../src/lib/kit-reader/proposal-heuristics";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const FAINT_ROUSE_STEAL =
  "When Faint plays a card, {Steal} 10 {STR} from all enemies.";
const FAINT_AA_STEAL =
  "Immediately and permanently {Steal} 25 {STR} from all enemies.";
const FAINT_SF_STEAL =
  'After playing Faint\'s Command Cards, temporarily {Steal} {STR} equal to 10% of Faint\'s ATK from all "Humanoid" enemies';
const FAINT_NUTRIENT_EXHAUSTION =
  "Temporarily reduce all enemies' {STR▼} by 16.";
const FAINT_SF_STR_REDUCTION =
  "Faint's {STR} Reduction effect +20%.";

console.log("Kit Reader Steal helpers");

assert(detectStealClause(FAINT_ROUSE_STEAL), "Rouse Steal 10 STR");
assert(detectStealClause(FAINT_AA_STEAL), "AA permanent Steal 25 STR");
assert(detectStealClause(FAINT_SF_STEAL), "SF Steal 10% ATK");
assert(!detectStealClause(FAINT_NUTRIENT_EXHAUSTION), "Exhaustion without Steal");
assert(!detectStealClause(FAINT_SF_STR_REDUCTION), "Increase Gain STR Down amp");

const flat10 = parseStealStrScalar(FAINT_ROUSE_STEAL);
assert(flat10 != null && flat10.valueScalar === 0.1 && flat10.dependencyStat === null, "Steal 10 → 0.1");

const flat25 = parseStealStrScalar(FAINT_AA_STEAL);
assert(flat25 != null && flat25.valueScalar === 0.25 && flat25.dependencyStat === null, "Steal 25 → 0.25");

const pctAtk = parseStealStrScalar(FAINT_SF_STEAL);
assert(
  pctAtk != null && pctAtk.valueScalar === 0.1 && pctAtk.dependencyStat === "atk",
  "Steal 10% ATK → 0.1 atk",
);

const missingPair = warnStealMissingStrUpPair([
  {
    clientKey: "rouse-per-card-str-down",
    status: "ok",
    tagName: "Defender.STR Down",
    sourceKitId: "skill.faint.boundless-starlight",
    sourceQuote: FAINT_ROUSE_STEAL,
    valueScalar: 0.1,
    dependencyStat: null,
    requiredEnlightenment: 0,
    isPermanent: false,
  },
]);
assert(missingPair.length === 1, "STR Down-only Steal should warn");

const fullPair = warnStealMissingStrUpPair([
  {
    clientKey: "rouse-per-card-str-down",
    status: "ok",
    tagName: "Defender.STR Down",
    sourceKitId: "skill.faint.boundless-starlight",
    sourceQuote: FAINT_ROUSE_STEAL,
    valueScalar: 0.1,
    dependencyStat: null,
    requiredEnlightenment: 0,
    isPermanent: false,
  },
  {
    clientKey: "rouse-per-card-str-up",
    status: "ok",
    tagName: "Support.STR Up.Fixed",
    sourceKitId: "skill.faint.boundless-starlight",
    sourceQuote: FAINT_ROUSE_STEAL,
    valueScalar: 0.1,
    dependencyStat: null,
    requiredEnlightenment: 0,
    isPermanent: false,
  },
]);
assert(fullPair.length === 0, "Matched Steal pair should not warn");

console.log("OK: all kit-reader Steal checks passed");
