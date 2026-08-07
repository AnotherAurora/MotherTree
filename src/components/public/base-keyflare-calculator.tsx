"use client";

import { KEYFLARE_DR_CONFIG } from "@/components/public/diminishing-return-config";
import { DiminishingReturnCalculator } from "@/components/public/diminishing-return-calculator";

/** Keyflare diminishing-return calculator (config stays on the client). */
export function BaseKeyflareCalculator() {
  return <DiminishingReturnCalculator config={KEYFLARE_DR_CONFIG} />;
}
