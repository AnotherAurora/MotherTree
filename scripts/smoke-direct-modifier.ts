import assert from "node:assert";
import { applyInteractions } from "../src/lib/path-carver/apply-interactions";
import type {
  Awakener,
  Tag,
  DefaultInteraction,
  Manifestation,
} from "../src/lib/team-data/types";

function makeTag(id: number, tagName: string, isPercent: boolean, layer: "pre_add" | "add" | "post_add" = "add"): Tag {
  return {
    id,
    tagName,
    layer,
    isPercent,
    isAdditive: true,
    isSearchable: true,
  };
}

const damageTag = makeTag(1, "Attacker.Active Damage", false, "post_add");
const enhanceTag = makeTag(68, "Support.Enhance", true, "add");

const tagsById: Record<number, Tag> = {
  1: damageTag,
  68: enhanceTag,
};

const awakener: Awakener = {
  id: 1,
  name: "Helot: Catena",
  slug: "helot-catena",
  atk: 1000,
  def: 500,
  hp: 2000,
  keyflareRegen: 1,
  critRate: 0.1,
  critDmg: 1.5,
  damageAmp: 0,
  realmMastery: 0,
  aliemusRegen: 0,
  sigilYield: 0,
  deathResist: 0,
  baseAliemus: 0,
  enlightenment: 15,
};

const awakenersById = new Map<number, Awakener>([[1, awakener]]);

// 100 base damage with 50% direct_modifier Enhance
const manifestation: Manifestation = {
  id: 101,
  awakenerId: 1,
  tagId: 1,
  tagName: "Attacker.Active Damage",
  valueScalar: 100,
  rawScalar: 100,
  dependencyStat: null,
  instanceCount: 1,
  baseCopies: 1,
  requiredEnlightenment: 0,
  requiredRealm: null,
  sourceType: "command card",
  targetType: "single",
  triggerCondition: null,
  isAccumulating: false,
  isPermanent: false,
  buffTargetTypeRestriction: null,
  metadata: "Crimson Shackles Damage",
  replacesManifestationId: null,
  interactionOverrides: [
    {
      id: 1,
      mode: "direct_modifier",
      modifierTagId: 68,
      modifierTagName: "Support.Enhance",
      targetTagId: null,
      targetTagName: null,
      layer: null,
      mathOperation: "multiply_one_plus",
      valueScalar: 0.5,
      targetType: "self",
      dependencyStat: null,
      isDisabled: false,
    },
  ],
  isDamageDealer: true,
};

const res = applyInteractions({
  appliedManifestations: [manifestation],
  defaultInteractions: [],
  tagsById,
  awakenersById,
  awakenerNamesById: new Map([[1, "Helot: Catena"]]),
  desireTargetTagNames: ["Attacker.Active Damage"],
});

// Single hit: 100 * (1 + 0.5) = 150
console.log("Direct modifier totalsByTagId:", res.totalsByTagId);
const damageTotal = res.totalsByTagId.get(1);
assert.strictEqual(damageTotal, 150, "Expected damage total to be 150");

const dmStep = res.steps.find((s) => s.kind === "op" && s.uniqueScaling === "direct_modifier");
assert(dmStep, "Expected direct_modifier step to be present");
console.log("Direct modifier step:", dmStep);

console.log("direct_modifier smoke passed!");
