"use client";

import { ALIEMUS_DR_CONFIG } from "@/components/public/diminishing-return-config";
import { DiminishingReturnCalculator } from "@/components/public/diminishing-return-calculator";

/** Aliemus diminishing-return calculator (config stays on the client). */
export function BaseAliemusCalculator() {
  return <DiminishingReturnCalculator config={ALIEMUS_DR_CONFIG} />;
}
