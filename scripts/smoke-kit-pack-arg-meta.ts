/**
 * Smoke: kit pack description-arg export (resolvedArgMeta + channel token expansion).
 *
 *   npx tsx scripts/smoke-kit-pack-arg-meta.ts
 */
import {
  expandDescriptionTemplate,
  inferDependencyStatFromArgMeta,
  argMetaRequiresReview,
  type KitDescriptionArg,
} from "../src/lib/kit-reader/description-args";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const SKILL_LEVEL = 6;

function expand(
  template: string,
  args: Record<string, KitDescriptionArg>,
): ReturnType<typeof expandDescriptionTemplate> {
  return expandDescriptionTemplate(template, args, SKILL_LEVEL);
}

console.log("Kit pack arg meta / channel expansion");

// Memory Rondo — [Power:Arg1] STR
{
  const { text, resolvedArgs, resolvedArgMeta } = expand(
    "Obtain [Power:Arg1] {STR}.",
    {
      Arg1: {
        kind: "scaling",
        values: ["2", "2.4", "2.8", "3.2", "3.6", "4"],
        stat: "ATK",
        suffix: "%",
      },
    },
  );
  assert(text.includes("Obtain 4 {STR}"), `Power expanded (got "${text}")`);
  assert(resolvedArgs.Arg1 === 4, "Arg1 lv6 = 4");
  assert(resolvedArgMeta.Arg1.stat === "atk", "Power meta stat atk");
  assert(resolvedArgMeta.Arg1.suffix === "%", "Power meta suffix %");
  assert(
    inferDependencyStatFromArgMeta(resolvedArgMeta.Arg1) === "atk",
    "infer atk dep for Power",
  );
  assert(!argMetaRequiresReview(resolvedArgMeta.Arg1), "Power no substatBonus");
}

// Hameln Defense — [Block:Arg1] Shield
{
  const { resolvedArgMeta } = expand("Gain [Block:Arg1] Shield.", {
    Arg1: {
      kind: "scaling",
      values: ["10", "12", "14", "16", "18", "20"],
      stat: "DEF",
      suffix: "%",
    },
  });
  assert(resolvedArgMeta.Arg1.stat === "def", "Block meta stat def");
  assert(
    inferDependencyStatFromArgMeta(resolvedArgMeta.Arg1) === "def",
    "infer def dep for Block",
  );
}

// Agrippa Pale Blessing — [{Poison}:Arg3]
{
  const { text, resolvedArgs, resolvedArgMeta } = expand(
    "Inflict [{Poison}:Arg3] {plural:[{Poison}:Arg3]|stack|stacks} of {Poison} on all enemies.",
    {
      Arg3: {
        kind: "scaling",
        values: ["75", "90", "105", "120", "135", "150"],
        stat: "ATK",
        suffix: "%",
        substatBonus: {
          substat: "SigilYield",
          multiplier: "1",
          mode: "scale_base",
        },
      },
    },
  );
  assert(text.includes("Inflict 150 stacks"), `Poison expanded (got "${text}")`);
  assert(resolvedArgs.Arg3 === 150, "Arg3 lv6 = 150");
  assert(resolvedArgMeta.Arg3.stat === "atk", "Poison meta stat atk");
  assert(resolvedArgMeta.Arg3.hasSubstatBonus === true, "Poison has substatBonus");
  assert(
    resolvedArgMeta.Arg3.substatBonusSubstat === "sigil_yield",
    "substatBonus maps to sigil_yield",
  );
  assert(
    inferDependencyStatFromArgMeta(resolvedArgMeta.Arg3) === "atk",
    "infer atk dep for Poison base",
  );
  assert(
    argMetaRequiresReview(resolvedArgMeta.Arg3) === true,
    "Poison with substatBonus needs review",
  );
}

// Agrippa Strike E2 — Trigger [Arg3]% {Poison} (fixed %, no stat)
{
  const { resolvedArgMeta } = expand(
    "Deal [Damage:Arg1] DMG. Trigger [Arg3]% {Poison} on all enemies.",
    {
      Arg1: {
        kind: "scaling",
        values: ["10", "12", "14", "16", "18", "20"],
        stat: "ATK",
        suffix: "%",
      },
      Arg3: { kind: "fixed", value: "20", suffix: "%" },
    },
  );
  assert(
    inferDependencyStatFromArgMeta(resolvedArgMeta.Arg3) === null,
    "Trigger Arg3 has no stat → null dep",
  );
}

// Regression — bare [Damage:Arg1]
{
  const { text, resolvedArgs } = expand("Deal [Damage:Arg1] DMG.", {
    Arg1: {
      kind: "scaling",
      values: ["10", "12", "14", "16", "18", "20"],
      stat: "ATK",
      suffix: "%",
    },
  });
  assert(text === "Deal 20 DMG.", `Damage regression (got "${text}")`);
  assert(resolvedArgs.Arg1 === 20, "Damage Arg1 lv6 = 20");
}

console.log("OK: all kit-pack arg-meta checks passed");
