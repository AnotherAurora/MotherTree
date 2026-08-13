import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Manual",
};

const sectionHeadingClass =
  "font-[family-name:var(--font-mother-display)] text-4xl font-semibold tracking-tight text-[var(--mt-ink)]";

const MANUAL_SECTIONS = [
  {
    id: "calculators",
    href: "/manual/calculators",
    label: "Calculators",
    blurb: "Where to find stats and how each calculator works.",
  },
  {
    id: "search",
    href: "/manual/search",
    label: "Search",
    blurb: "Investment assumptions, how effects are cataloged, and how Search filters and results work.",
  },
] as const;

export default function ManualHubPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-8 sm:px-6 sm:py-10">
      <h1 className={sectionHeadingClass}>Manual</h1>

      <div className="flex flex-col gap-5">
        {MANUAL_SECTIONS.map((section) => {
          const titleId = `manual-section-${section.id}-title`;

          return (
            <div
              key={section.id}
              className="mt-hub-card relative flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6"
            >
              <Link
                href={section.href}
                className="absolute inset-0 z-[1] rounded-[inherit]"
                aria-labelledby={titleId}
              />
              <h2
                id={titleId}
                className="mt-hub-title relative z-[2] shrink-0 font-[family-name:var(--font-mother-display)] text-3xl font-semibold pointer-events-none sm:w-56"
              >
                {section.label}
              </h2>
              <p className="relative z-[2] min-w-0 flex-1 text-base font-medium leading-relaxed text-[var(--mt-ink)] pointer-events-none">
                {section.blurb}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
