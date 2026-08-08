import type { Metadata } from "next";
import { AequorRealmCalculator } from "@/components/public/aequor-realm-calculator";
import { BaseAliemusCalculator } from "@/components/public/base-aliemus-calculator";
import { BaseKeyflareCalculator } from "@/components/public/base-keyflare-calculator";
import { DeathResistCalculator } from "@/components/public/death-resist-calculator";
import { KeyflareHarmonyCalculator } from "@/components/public/keyflare-harmony-calculator";

export const metadata: Metadata = {
  title: "Calculators",
};

const sectionHeadingClass =
  "font-[family-name:var(--font-mother-display)] text-4xl font-semibold tracking-tight text-[var(--mt-ink)]";

export default function CalculatorsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-14 px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="sr-only">Calculators</h1>

      <section className="space-y-6" aria-labelledby="keyflare-heading">
        <h2 id="keyflare-heading" className={sectionHeadingClass}>
          Keyflare
        </h2>
        <BaseKeyflareCalculator />
      </section>

      <section
        className="space-y-6"
        aria-labelledby="keyflare-harmony-heading"
      >
        <h2 id="keyflare-harmony-heading" className={sectionHeadingClass}>
          Keyflare Harmony
        </h2>
        <KeyflareHarmonyCalculator />
      </section>

      <section className="space-y-6" aria-labelledby="aliemus-heading">
        <h2 id="aliemus-heading" className={sectionHeadingClass}>
          Aliemus
        </h2>
        <BaseAliemusCalculator />
      </section>

      <section className="space-y-6" aria-labelledby="death-resist-heading">
        <h2 id="death-resist-heading" className={sectionHeadingClass}>
          Death Resist
        </h2>
        <DeathResistCalculator />
      </section>

      <section className="space-y-6" aria-labelledby="aequor-realm-heading">
        <h2 id="aequor-realm-heading" className={sectionHeadingClass}>
          Aequor Realm
        </h2>
        <AequorRealmCalculator />
      </section>
    </div>
  );
}
