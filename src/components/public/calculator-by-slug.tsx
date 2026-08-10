"use client";

import type { ComponentType } from "react";
import { AequorRealmCalculator } from "@/components/public/aequor-realm-calculator";
import { BaseAliemusCalculator } from "@/components/public/base-aliemus-calculator";
import { BaseKeyflareCalculator } from "@/components/public/base-keyflare-calculator";
import { CaroRealmCalculator } from "@/components/public/caro-realm-calculator";
import { ChaosRealmCalculator } from "@/components/public/chaos-realm-calculator";
import { DeathResistCalculator } from "@/components/public/death-resist-calculator";
import { KeyflareHarmonyCalculator } from "@/components/public/keyflare-harmony-calculator";
import { TeamMaxHpCalculator } from "@/components/public/team-max-hp-calculator";
import { UltraRealmCalculator } from "@/components/public/ultra-realm-calculator";
import type { CalculatorSlug } from "@/lib/public/calculator-catalog";

const CALCULATOR_COMPONENTS: Record<CalculatorSlug, ComponentType> = {
  keyflare: BaseKeyflareCalculator,
  "keyflare-harmony": KeyflareHarmonyCalculator,
  aliemus: BaseAliemusCalculator,
  "death-resist": DeathResistCalculator,
  "team-max-hp": TeamMaxHpCalculator,
  "chaos-realm": ChaosRealmCalculator,
  "aequor-realm": AequorRealmCalculator,
  "caro-realm": CaroRealmCalculator,
  "ultra-realm": UltraRealmCalculator,
};

export function CalculatorBySlug({ slug }: { slug: CalculatorSlug }) {
  const Component = CALCULATOR_COMPONENTS[slug];
  return <Component />;
}
