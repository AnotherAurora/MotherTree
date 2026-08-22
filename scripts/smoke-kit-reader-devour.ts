/**
 * Smoke: Kit Reader Devour → 2x Devour copy provider group helpers.
 *
 *   npx tsx scripts/smoke-kit-reader-devour.ts
 */
import {
  buildAtmMetadata,
  resolveInsertMetadata,
} from "../src/lib/kit-reader/atm-metadata";
import {
  DEVOUR_COPY_PROVIDER_GROUP_NAME,
  detectDevourClause,
  devourCopyProviderGroupNameForPack,
  warnDevourUsingWhenTrigger,
} from "../src/lib/kit-reader/proposal-heuristics";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const HELOT_DEVOUR =
  '[{Devour}: Draw 3 "Strike" cards, Temporary Hand Limit +2, increase the Base DMG of Helot\'s "Strike" by 10% for this battle.]';
const PLAIN_EXALT = "In this turn, \"Strike\" Final DMG +100%";
const WHENEVER_DEVOUR =
  "Whenever {Devour} is triggered, move {Colorless Spiral} from the Discard Pile to your hand.";

console.log("Kit Reader Devour helpers");

assert(detectDevourClause(HELOT_DEVOUR), "Helot Surviving Impasse Devour bracket");
assert(detectDevourClause(WHENEVER_DEVOUR), "Whenever Devour clause");
assert(!detectDevourClause(PLAIN_EXALT), "non-Devour Exalt line");

assert(
  DEVOUR_COPY_PROVIDER_GROUP_NAME === "2x Devour",
  "DEVOUR_COPY_PROVIDER_GROUP_NAME constant",
);
assert(
  devourCopyProviderGroupNameForPack() === "2x Devour",
  "devourCopyProviderGroupNameForPack",
);

assert(
  buildAtmMetadata({
    sourceLabel: "Exalt",
    tagName: "Support.Draw.Command Card.Strike",
    isDevour: true,
  }) === "Exalt Devour Draw.Command Card.Strike",
  "buildAtmMetadata Devour segment",
);
assert(
  buildAtmMetadata({
    sourceLabel: "Exalt",
    tagName: "Support.Hand Size",
    isDevour: true,
    requiredEnlightenment: 0,
  }) === "Exalt Devour Hand Size",
  "Devour metadata without E suffix",
);
assert(
  resolveInsertMetadata({
    sourceLabel: "Exalt",
    tagName: "Support.Base Damage.Strike",
    isDevour: true,
  }) === "Exalt Devour Base Damage.Strike",
  "resolveInsertMetadata isDevour",
);
assert(
  resolveInsertMetadata({
    sourceLabel: "Exalt",
    tagName: "Support.Hand Size",
    isDevour: false,
  }) === "Exalt Hand Size",
  "non-Devour unchanged",
);

const whenWarnings = warnDevourUsingWhenTrigger([
  {
    clientKey: "bad-devour-when",
    status: "ok",
    sourceQuote: HELOT_DEVOUR,
    triggerConditionTagName: "Special.When.Devour",
    copyProviderGroupName: null,
  },
]);
assert(whenWarnings.length === 1, "warn on Special.When.Devour");
assert(
  whenWarnings[0]?.message.includes("Special.When.Devour"),
  "When trigger warning message",
);

const missingGroupWarnings = warnDevourUsingWhenTrigger([
  {
    clientKey: "bad-devour-missing-group",
    status: "ok",
    sourceQuote: HELOT_DEVOUR,
    triggerConditionTagName: null,
    copyProviderGroupName: null,
  },
]);
assert(missingGroupWarnings.length === 1, "warn when copy group missing");

const okDevour = warnDevourUsingWhenTrigger([
  {
    clientKey: "exalt-devour-draw-strike",
    status: "ok",
    sourceQuote: HELOT_DEVOUR,
    triggerConditionTagName: null,
    copyProviderGroupName: DEVOUR_COPY_PROVIDER_GROUP_NAME,
  },
]);
assert(okDevour.length === 0, "no warning for correct Devour proposal");

console.log("\nAll smoke-kit-reader-devour checks passed.");
