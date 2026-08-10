import type { Metadata } from "next";
import Link from "next/link";
import {
  CALCULATOR_GROUPS,
  getGroupHref,
} from "@/lib/public/calculator-catalog";

export const metadata: Metadata = {
  title: "Calculators",
};

const sectionHeadingClass =
  "font-[family-name:var(--font-mother-display)] text-4xl font-semibold tracking-tight text-[var(--mt-ink)]";

export default function CalculatorsHubPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-8 sm:px-6 sm:py-10">
      <h1 className={sectionHeadingClass}>Calculators</h1>

      <div className="flex flex-col gap-5">
        {CALCULATOR_GROUPS.map((group) => {
          const titleId = `calculators-group-${group.id}-title`;
          const href = getGroupHref(group.id);

          return (
            <div
              key={group.id}
              className="mt-hub-card relative flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6"
            >
              <Link
                href={href}
                className="absolute inset-0 z-[1] rounded-[inherit]"
                aria-labelledby={titleId}
              />
              <h2
                id={titleId}
                className="mt-hub-title relative z-[2] shrink-0 font-[family-name:var(--font-mother-display)] text-3xl font-semibold pointer-events-none sm:w-56"
              >
                {group.label}
              </h2>
              <p className="relative z-[2] min-w-0 flex-1 text-base font-medium leading-relaxed text-[var(--mt-ink)] pointer-events-none">
                {group.hubBlurb}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
