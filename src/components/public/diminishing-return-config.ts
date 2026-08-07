import {
  applyAliemusDiminishingReturn,
  applyKeyflareDiminishingReturn,
} from "@/lib/path-carver/awakener-base-stats";

export type DiminishingReturnConfig = {
  id: string;
  storageKey: string;
  /** Path Carver DR (ceiled). */
  applyDr: (x: number) => number;
  /** Continuous asymptote; displayed diminished never exceeds this. */
  cap: number;
  /**
   * Raw input where continuous f(x) equals `level` exactly.
   * Ceil jumps from `level` to `level + 1` just above this.
   * Null at/above cap.
   */
  rawAtLevel: (level: number) => number | null;
  resultLabel: string;
  neededForNextLabel: string;
  maxReachedLabel: string;
  rawAxisLabel: string;
  inputALabel: string;
  inputBLabel: string;
};

/** Keyflare: f(x)=15+144(x-15)/(x+129), cap 159. */
function keyflareRawAtLevel(level: number): number | null {
  if (level >= 159) return null;
  const denom = 159 - level;
  if (denom === 0) return null;
  return (225 + 129 * level) / denom;
}

/** Aliemus: f(x)=72x/(x+72), cap 72. */
function aliemusRawAtLevel(level: number): number | null {
  if (level >= 72) return null;
  const denom = 72 - level;
  if (denom === 0) return null;
  return (72 * level) / denom;
}

export const KEYFLARE_DR_CONFIG: DiminishingReturnConfig = {
  id: "keyflare",
  storageKey: "mt.calculators.base-keyflare",
  applyDr: applyKeyflareDiminishingReturn,
  cap: 159,
  rawAtLevel: keyflareRawAtLevel,
  resultLabel: "Diminished Keyflare",
  neededForNextLabel: "Keyflare needed for +1",
  maxReachedLabel: "Max diminished keyflare reached.",
  rawAxisLabel: "Raw Keyflare",
  inputALabel: "Keyflare source A",
  inputBLabel: "Keyflare source B",
};

export const ALIEMUS_DR_CONFIG: DiminishingReturnConfig = {
  id: "aliemus",
  storageKey: "mt.calculators.base-aliemus",
  applyDr: applyAliemusDiminishingReturn,
  cap: 72,
  rawAtLevel: aliemusRawAtLevel,
  resultLabel: "Diminished Aliemus",
  neededForNextLabel: "Aliemus needed for +1",
  maxReachedLabel: "Max diminished aliemus reached.",
  rawAxisLabel: "Raw Aliemus",
  inputALabel: "Aliemus source A",
  inputBLabel: "Aliemus source B",
};
