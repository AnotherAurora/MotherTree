import Link from "next/link";

type HubItem = {
  href: string;
  title: string;
  bullets: readonly string[];
  learnMore?: { href: string; label: string };
};

const HUB_ITEMS: readonly HubItem[] = [
  {
    href: "/search",
    title: "Search",
    bullets: [
      "Search my personal interpretations and custom-recorded data for Morimens.",
      "Features detailed entries for Awakeners, Wheels, Posses, and Covenants, modeled around my own combat testing and assumptions.",
      "Includes over 160 custom tags to categorize and filter game elements based on my analysis.",
      "Filter by target range, scaling stat, modifier values, or sort by numeric impact.",
    ],
    learnMore: {
      href: "/manual",
      label:
        "Learn more about search features, methodology, and recording assumptions",
    },
  },
  {
    href: "/calculator",
    title: "Calculator",
    bullets: [
      "Dedicated calculators designed for specific Morimens mechanics.",
      "Calculate Base Tentacle Damage, Death Resistance, Keyflare, Aliemus, and more.",
      "Determine exact stat thresholds required to reach the next breakpoint.",
    ],
  },
  {
    href: "/manual",
    title: "Manual",
    bullets: [
      "Complete feature list for both the search engine and calculators.",
      "Detailed documentation of underlying mechanics and recording assumptions.",
      "Step-by-step instructions for getting the most out of every tool on the site.",
    ],
  },
  {
    href: "/about",
    title: "About Me",
    bullets: [
      "The background story behind this project and its ultimate vision.",
    ],
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="sr-only">Mother Tree</h1>
      <div className="flex flex-col gap-5">
        {HUB_ITEMS.map((item) => {
          const titleId = `hub-${item.href.replace(/^\//, "")}-title`;

          return (
            <div
              key={item.href}
              className="mt-hub-card relative flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-0"
            >
              <Link
                href={item.href}
                className="absolute inset-0 z-[1] rounded-[inherit]"
                aria-labelledby={titleId}
              />
              <h2
                id={titleId}
                className="mt-hub-title relative shrink-0 font-[family-name:var(--font-mother-display)] text-3xl font-semibold sm:w-44"
              >
                {item.title}
              </h2>
              <ul className="mt-hub-card-body relative min-w-0 flex-1 list-disc space-y-2 pl-5 text-base font-medium leading-relaxed text-[var(--mt-ink)]">
                {item.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
                {item.learnMore ? (
                  <li className="relative z-[2] list-none -ml-5 font-normal">
                    <Link
                      href={item.learnMore.href}
                      className="font-medium text-[var(--mt-ember)] underline underline-offset-4 hover:text-[var(--mt-ember-deep)]"
                    >
                      [{item.learnMore.label}]
                    </Link>
                  </li>
                ) : null}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
