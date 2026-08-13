import type { Metadata } from "next";
import Link from "next/link";
import {
  manualBackLinkClass,
  manualBodyClass,
  manualLinkClass,
  manualPageHeadingClass,
  manualSectionHeadingClass,
  manualStepHeadingClass,
} from "@/components/public/manual-prose";

export const metadata: Metadata = {
  title: "Search · Manual",
};

const TOC_ITEMS = [
  { href: "#investment-assumptions", label: "Investment Assumptions" },
  { href: "#how-effects-are-cataloged", label: "How Effects are Cataloged" },
  { href: "#how-search-works", label: "How Search Works" },
  { href: "#search-options", label: "Search Options and Results" },
] as const;

const TAG_FILTER_ITEMS = [
  {
    id: "attacker",
    label: "Attacker",
    body: "Damage-related tags, ordered to match the damage formula and the UI layer order.",
  },
  {
    id: "defender",
    label: "Defender",
    body: "Sustain-related tags.",
  },
  {
    id: "support",
    label: "Support",
    body: "Utility and Buff effects.",
  },
  {
    id: "from",
    label: "From",
    body: "Limits results to Awakener, Covenant, Wheel, or Posse.",
  },
  {
    id: "target-type",
    label: "Target Type",
    body: "Filters to a specific range for the effect.",
  },
  {
    id: "buff-restriction",
    label: "Buff Restriction",
    body: "Limits buffs applied specifically to Command Card, Exalt, or Tentacle.",
  },
  {
    id: "required-realm",
    label: "Required Realm",
    body: "Filters to effects that apply only when a specific realm condition is met.",
  },
  {
    id: "dependency-stat",
    label: "Dependency Stat",
    body: "Filters to a specific stat scaling.",
  },
  {
    id: "trigger-condition",
    label: "Trigger Condition",
    body: "Filters to effects that trigger under specific conditions.",
  },
  {
    id: "every-turn",
    label: "Every Turn",
    body: "Filters to effects that happen every turn.",
  },
] as const;

const listClass =
  "max-w-3xl list-disc space-y-1.5 pl-5 text-[var(--mt-ink-muted)] leading-relaxed";

const fieldDtClass = `${manualStepHeadingClass} text-lg`;

export default function ManualSearchPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-8 sm:px-6 sm:py-10">
      <Link href="/manual" className={manualBackLinkClass}>
        ← Manual
      </Link>

      <header className="space-y-4">
        <h1 className={manualPageHeadingClass}>Search</h1>
        <p className={manualBodyClass}>
          Investment assumptions used for Value scaling, how effects are
          cataloged, how filters behave, and what each search option and result
          column means.
        </p>
        <p className={manualBodyClass}>
          <Link href="/search" className={manualLinkClass}>
            Open Search →
          </Link>
        </p>
      </header>

      <nav aria-label="On this page" className="max-w-3xl space-y-3">
        <p className="text-sm font-medium text-[var(--mt-ink)]">On this page</p>
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-[var(--mt-ink-muted)]">
          {TOC_ITEMS.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className={manualLinkClass}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section
        id="investment-assumptions"
        className="scroll-mt-24 space-y-4 border-t border-[var(--mt-border)] pt-8"
      >
        <h2 className={manualSectionHeadingClass}>Investment Assumptions</h2>
        <ul className={listClass}>
          <li>Account level 60</li>
          <li>Awakener level 60</li>
          <li>Awakener skills lv6</li>
          <li>Wheels +12</li>
          <li>Soulforge lv10</li>
          <li>
            Gnostic Potential lv0, except limited awakeners who are lv5
          </li>
        </ul>
      </section>

      <section
        id="how-effects-are-cataloged"
        className="scroll-mt-24 space-y-6 border-t border-[var(--mt-border)] pt-8"
      >
        <h2 className={manualSectionHeadingClass}>How Effects are Cataloged</h2>

        <div className="space-y-3">
          <h3 className={manualStepHeadingClass}>What&apos;s left out</h3>
          <ul className={listClass}>
            <li>
              Enemy scaling is out of scope: those effects are either omitted
              from the catalog, or listed without an enemy-based Value.
            </li>
            <li>
              Exploration effects (for example shop) are not cataloged.
            </li>
            <li>
              Astral Reign rules are assumed, so R-rarity wheels are excluded.
            </li>
          </ul>
        </div>

        <div className="space-y-3">
          <h3 className={manualStepHeadingClass}>How values are chosen</h3>
          <p className={manualBodyClass}>
            Effects are cataloged as close to real combat as practical, while
            keeping comparisons fair within each source type.
          </p>
          <dl className="max-w-3xl space-y-4">
            <div className="space-y-1">
              <dt className={fieldDtClass}>Posse</dt>
              <dd className={manualBodyClass}>
                Values are balanced across Posses. Ryker&apos;s Posse is the
                average of all 6 rolls so it does not read as a stronger Voice Posse.
              </dd>
            </div>
            <div className="space-y-1">
              <dt className={fieldDtClass}>Awakener</dt>
              <dd className={manualBodyClass}>
                Ideal burst turn is recorded. Xu&apos;s poison trigger uses full
                Spellbound.
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section
        id="how-search-works"
        className="scroll-mt-24 space-y-4 border-t border-[var(--mt-border)] pt-8"
      >
        <h2 className={manualSectionHeadingClass}>How Search Works</h2>
        <ul className={listClass}>
          <li>
            You must select at least one filter from Tags or More criteria to
            search.
          </li>
          <li>
            Selecting a tag also returns more specific versions of it. For
            example, searching for{" "}
            <span className="text-[var(--mt-ink)]">Final Damage</span> also
            shows{" "}
            <span className="text-[var(--mt-ink)]">
              Final Damage for Strike
            </span>
            .
          </li>
        </ul>
      </section>

      <div
        id="search-options"
        className="scroll-mt-24 space-y-8 border-t border-[var(--mt-border)] pt-8"
      >
        <h2 className={manualSectionHeadingClass}>
          Search Options and Results
        </h2>

        <section
          id="tags-and-filters"
          className="scroll-mt-24 space-y-4"
          aria-labelledby="tags-and-filters-heading"
        >
          <h3
            id="tags-and-filters-heading"
            className={manualStepHeadingClass}
          >
            Tags and filters
          </h3>
          <dl className="max-w-3xl space-y-4">
            {TAG_FILTER_ITEMS.map((item) => (
              <div key={item.id} id={item.id} className="scroll-mt-24 space-y-1">
                <dt className={fieldDtClass}>{item.label}</dt>
                <dd className={manualBodyClass}>{item.body}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section
          id="result-columns"
          className="scroll-mt-24 space-y-4"
          aria-labelledby="result-columns-heading"
        >
          <h3 id="result-columns-heading" className={manualStepHeadingClass}>
            Result columns
          </h3>
          <dl className="max-w-3xl space-y-4">
            <div id="name" className="scroll-mt-24 space-y-1">
              <dt className={fieldDtClass}>Name</dt>
              <dd className={manualBodyClass}>
                Effect or source name. Links out to SKeyDB for the full effect
                text.
              </dd>
            </div>
            <div id="value" className="scroll-mt-24 space-y-1">
              <dt className={fieldDtClass}>Value</dt>
              <dd className={manualBodyClass}>
                Magnitude of the tag. If there is no Dependency Stat, this is
                the raw magnitude. If Dependency Stat is set, awakener rows show
                the scaled result using the{" "}
                <Link
                  href="#investment-assumptions"
                  className={manualLinkClass}
                >
                  investment assumptions
                </Link>
                . For Wheel, Covenant, and Posse it shows the coefficient as a %
                of that dependency stat. Rows with a negative Value are omitted.
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
