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
  { href: "#burst-turn-simulation", label: "Burst Turn Simulation" },
  { href: "#search-options", label: "Search Options and Results" },
] as const;

const TAG_FILTER_ITEMS = [
  {
    id: "attacker",
    label: "Attacker",
    body: "Damage-related tags, listed in damage-formula order.",
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
          cataloged, how burst turns are simulated, how filters behave, and
          what each search option and result column means.
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
          <li>
            Awakener Enlightenment defaults to E3 (adjustable in Search). See{" "}
            <Link href="#awakener-enlightenment" className={manualLinkClass}>
              Awakener Enlightenment
            </Link>
            .
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
              Enemy-based scaling is out of scope: those effects are omitted, or
              listed without a Value from that scaling.
              <ul className="mt-1.5 list-disc space-y-1.5 pl-5">
                <li>
                  For example, Lotan: Cetarchon&apos;s damage increase from
                  enemy Attack is not cataloged.
                </li>
              </ul>
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
                Values are balanced across Posses. For example, Ryker&apos;s
                Posse is the average of all 6 rolls so it does not read as a
                stronger Voice Posse.
              </dd>
            </div>
            <div className="space-y-1">
              <dt className={fieldDtClass}>Awakener</dt>
              <dd className={manualBodyClass}>
                Awakener effects are cataloged for their ideal burst turn,
                within reason. See{" "}
                <Link
                  href="#burst-turn-simulation"
                  className={manualLinkClass}
                >
                  Burst Turn Simulation
                </Link>{" "}
                for more details.
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
          <li>
            For damage / heal / shield tags on Awakener results, Search uses the
            burst-turn value. See{" "}
            <Link href="#burst-turn-simulation" className={manualLinkClass}>
              Burst Turn Simulation
            </Link>{" "}
            for more details.
          </li>
        </ul>
      </section>

      <section
        id="burst-turn-simulation"
        className="scroll-mt-24 space-y-4 border-t border-[var(--mt-border)] pt-8"
      >
        <h2 className={manualSectionHeadingClass}>Burst Turn Simulation</h2>
        <ul className={listClass}>
          <li>
            All meaningful effects from the Awakener and their realm are
            applied.
            <ul className="mt-1.5 list-disc space-y-1.5 pl-5">
              <li>
                For example, basic strike and defense are included only for
                Awakeners who rely on them.
              </li>
            </ul>
          </li>
          <li>
            All Awakener conditions are set to optimal within reason.
            <ul className="mt-1.5 list-disc space-y-1.5 pl-5">
              <li>
                For example, Xu has full Spellbound stacks. Doresain is not
                bursting against an enemy with 1 HP.
              </li>
            </ul>
          </li>
          <li>
            Burst-turn Values are approximations, not exact in-game totals.
            <ul className="mt-1.5 list-disc space-y-1.5 pl-5">
              <li>
                They can diverge because{" "}
                <span className="text-[var(--mt-ink)]">Base Damage</span>,{" "}
                <span className="text-[var(--mt-ink)]">Final Damage</span>, and{" "}
                <span className="text-[var(--mt-ink)]">Increase Gain</span> mix
                multiplicative and additive stacking in-game. Simulation treats
                those tags as fully multiplicative.
              </li>
              <li>
                Awakeners whose burst damage ramps with each card played are
                simplified to their peak damage for the whole sequence.
                <ul className="mt-1.5 list-disc space-y-1.5 pl-5">
                  <li>
                    For example, Mouchette is assumed to have her full Rouse
                    damage buff from the start of the burst sequence.
                  </li>
                </ul>
              </li>
            </ul>
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
          id="assumptions"
          className="scroll-mt-24 space-y-4"
          aria-labelledby="assumptions-heading"
        >
          <h3 id="assumptions-heading" className={manualStepHeadingClass}>
            Assumptions
          </h3>
          <dl className="max-w-3xl space-y-4">
            <div
              id="awakener-enlightenment"
              className="scroll-mt-24 space-y-1"
            >
              <dt className={fieldDtClass}>Awakener Enlightenment</dt>
              <dd className={manualBodyClass}>
                Assumed Awakener enlightenment for which effects appear.
                Effects that require higher enlightenment are excluded.
              </dd>
            </div>
          </dl>
        </section>

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
                Magnitude of the tag, or a % of Dependency Stat when that is
                set. For damage / heal / shield tags on Awakener results, the
                burst-turn value is used.
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
