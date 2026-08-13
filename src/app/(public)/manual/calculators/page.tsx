import type { Metadata } from "next";
import Link from "next/link";
import { ManualCallout } from "@/components/public/manual-callout";
import {
  manualBackLinkClass,
  manualBodyClass,
  manualLinkClass,
  manualPageHeadingClass,
  manualSectionHeadingClass,
  manualStepHeadingClass,
} from "@/components/public/manual-prose";
import { ManualScreenshot } from "@/components/public/manual-screenshot";

export const metadata: Metadata = {
  title: "Calculators · Manual",
};

const TOC_SECTIONS = [
  {
    href: "#finding-stats",
    label: "Part 1 — Where to find your stats",
    children: [
      { href: "#step-1-build-team", label: "Step 1: Build your team" },
      { href: "#step-2-click-awakener", label: "Step 2: Click an Awakener" },
      { href: "#step-3-click-details", label: "Step 3: Click Details" },
      {
        href: "#step-4-faded-legacy",
        label: "Step 4: Faded Legacy team stats",
      },
      { href: "#warning-team-info", label: "Warning: Team Info" },
    ],
  },
  {
    href: "#showcase",
    label: "Part 2 — Calculator showcase",
    children: [
      { href: "#showcase-keyflare-aliemus", label: "Keyflare & Aliemus" },
      { href: "#showcase-keyflare-harmony", label: "Keyflare Harmony" },
      { href: "#showcase-death-resist", label: "Death Resist" },
      { href: "#showcase-team-max-hp", label: "Team Max HP" },
      { href: "#showcase-realms", label: "Realms" },
      { href: "#showcase-covenant", label: "Covenant" },
    ],
  },
] as const;

export default function ManualCalculatorsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-8 sm:px-6 sm:py-10">
      <Link href="/manual" className={manualBackLinkClass}>
        ← Manual
      </Link>

      <header className="space-y-4">
        <h1 className={manualPageHeadingClass}>Calculators</h1>
        <p className={manualBodyClass}>
          How to copy accurate stats from the game, what to avoid in the team
          UI, and a quick tour of each public calculator.
        </p>
      </header>

      <nav aria-label="On this page" className="max-w-3xl space-y-3">
        <p className="text-sm font-medium text-[var(--mt-ink)]">On this page</p>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-[var(--mt-ink-muted)]">
          {TOC_SECTIONS.map((section) => (
            <li key={section.href}>
              <Link href={section.href} className={manualLinkClass}>
                {section.label}
              </Link>
              <ul className="mt-1.5 list-disc space-y-1.5 pl-5">
                {section.children.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className={manualLinkClass}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </nav>

      <div
        id="finding-stats"
        className="scroll-mt-24 space-y-8 border-t border-[var(--mt-border)] pt-8"
      >
        <h2 className={manualSectionHeadingClass}>
          Part 1 — Where to find your stats
        </h2>

        <section
          id="step-1-build-team"
          className="scroll-mt-24 space-y-3"
        >
          <h3 className={manualStepHeadingClass}>Step 1: Build your team</h3>
          <ManualScreenshot
            src="/screenshots/team.jpg"
            alt="Team building screen with four Awakeners selected for Investigation Main 1"
          />
        </section>

        <section
          id="step-2-click-awakener"
          className="scroll-mt-24 space-y-3"
        >
          <h3 className={manualStepHeadingClass}>Step 2: Click an Awakener</h3>
          <ManualScreenshot
            src="/screenshots/switch_around.jpg"
            alt="Select Awakeners screen showing Attributes CON, ATK, and DEF, with Details highlighted"
          />
          <p className={manualBodyClass}>
            Here you can see your Attributes and quickly switch between
            Awakeners to gather their stats.
          </p>
        </section>

        <section
          id="step-3-click-details"
          className="scroll-mt-24 space-y-3"
        >
          <h3 className={manualStepHeadingClass}>Step 3: Click Details</h3>
          <ManualScreenshot
            src="/screenshots/own_stat.jpg"
            alt="Attribute Details pop-up listing individual awakener stats with equipment bonuses"
          />
          <p className={manualBodyClass}>
            This is that Awakener&apos;s Attribute Details with equipment. You
            can also tap the question mark to see the diminished value.
          </p>
        </section>

        <section
          id="step-4-faded-legacy"
          className="scroll-mt-24 space-y-3"
        >
          <h3 className={manualStepHeadingClass}>
            Step 4: Enter any Faded Legacy stage
          </h3>
          <ManualScreenshot
            src="/screenshots/team_stat.jpg"
            alt="Team Information overlay in a Faded Legacy stage showing summed team attributes"
          />
          <p className={manualBodyClass}>
            Click and hold your posse button, then scroll down to see your team
            sum attributes.
          </p>
        </section>

        <ManualCallout id="warning-team-info" title="Warning: don’t use Team Info">
          <ManualScreenshot
            src="/screenshots/do_not.jpg"
            alt="Team building UI with the Team Info button crossed out"
          />
          <p className={manualBodyClass}>
            For the most accurate numbers, skip Team Info in the team building
            UI. Entering a mission can apply odd rounding (for example double
            round-up, or 14 RM reading as 15 RM). Prefer Steps 3 and 4 above.
          </p>
        </ManualCallout>
      </div>

      <div
        id="showcase"
        className="scroll-mt-24 space-y-10 border-t border-[var(--mt-border)] pt-8"
      >
        <h2 className={manualSectionHeadingClass}>
          Part 2 — Calculator showcase
        </h2>

        <section
          id="showcase-keyflare-aliemus"
          className="scroll-mt-24 space-y-3"
        >
          <h3 className={manualStepHeadingClass}>Keyflare &amp; Aliemus</h3>
          <p className={manualBodyClass}>
            Enter Awakener stats from{" "}
            <Link href="#step-3-click-details" className={manualLinkClass}>
              Step 3: Click Details
            </Link>
            . You get the diminished value and how close you are to the next
            breakpoint. Aliemus uses the same input pattern as Keyflare.
          </p>
          <ManualScreenshot
            src="/screenshots/Keyflare.png"
            alt="Keyflare calculator showing raw inputs, diminished value, and breakpoint graph"
          />
          <p className={manualBodyClass}>
            <Link href="/calculators/core/keyflare" className={manualLinkClass}>
              Open Keyflare →
            </Link>
            {" · "}
            <Link href="/calculators/core/aliemus" className={manualLinkClass}>
              Open Aliemus →
            </Link>
          </p>
        </section>

        <section
          id="showcase-keyflare-harmony"
          className="scroll-mt-24 space-y-3"
        >
          <h3 className={manualStepHeadingClass}>Keyflare Harmony</h3>
          <p className={manualBodyClass}>
            Enter each Awakener&apos;s Keyflare to see how Astral Reign&apos;s
            Keyflare Harmony rule applies.
          </p>
          <ManualScreenshot
            src="/screenshots/Keyflare_Harmony.png"
            alt="Keyflare Harmony calculator with four awakener inputs and regen totals"
          />
          <p className={manualBodyClass}>
            <Link
              href="/calculators/core/keyflare-harmony"
              className={manualLinkClass}
            >
              Open Keyflare Harmony →
            </Link>
          </p>
        </section>

        <section
          id="showcase-death-resist"
          className="scroll-mt-24 space-y-3"
        >
          <h3 className={manualStepHeadingClass}>Death Resist</h3>
          <p className={manualBodyClass}>
            Enter your DR to see how much more you need for a guaranteed
            trigger. The calculator applies Astral Reign&apos;s rule and turns
            part of DR into Max HP increase. Chaos Awakener Exist adds 100% DR,
            Primordia Chaos removes it. If you copied DR from{" "}
            <Link href="#step-4-faded-legacy" className={manualLinkClass}>
              Step 4: Faded Legacy team stats
            </Link>
            , you won&apos;t need either checkbox.
          </p>
          <ManualScreenshot
            src="/screenshots/Death_Resist.png"
            alt="Death Resist calculator showing guaranteed trigger graph and Max HP increase"
          />
          <p className={manualBodyClass}>
            <Link
              href="/calculators/core/death-resist"
              className={manualLinkClass}
            >
              Open Death Resist →
            </Link>
          </p>
        </section>

        <section
          id="showcase-team-max-hp"
          className="scroll-mt-24 space-y-3"
        >
          <h3 className={manualStepHeadingClass}>Team Max HP</h3>
          <p className={manualBodyClass}>
            Enter CON, Soulforge, levels, and Death Resist to see final team Max
            HP. Death Resist is included because Astral Reign raises max HP from
            DR.
          </p>
          <ManualScreenshot
            src="/screenshots/Team_Max_HP.png"
            alt="Team Max HP calculator with CON, Soulforge, Death Resist, and level inputs"
          />
          <p className={manualBodyClass}>
            <Link
              href="/calculators/core/team-max-hp"
              className={manualLinkClass}
            >
              Open Team Max HP →
            </Link>
          </p>
        </section>

        <section id="showcase-realms" className="scroll-mt-24 space-y-3">
          <h3 className={manualStepHeadingClass}>Realms</h3>
          <p className={manualBodyClass}>
            Every realm calculator is here except Primordia Chaos (too many
            posse-specific stat changes to show cleanly). Useful for seeing
            exactly what Realm Mastery is doing.
          </p>
          <p className={manualBodyClass}>
            <Link
              href="/calculators/realms/chaos-realm"
              className={manualLinkClass}
            >
              Open Realms calculators →
            </Link>
          </p>
        </section>

        <section id="showcase-covenant" className="scroll-mt-24 space-y-3">
          <h3 className={manualStepHeadingClass}>Covenant</h3>
          <p className={manualBodyClass}>
            Totals for Covenant Main Stat and Sub Stats, including Bond.
          </p>
          <ManualScreenshot
            src="/screenshots/Covenant.png"
            alt="Covenant calculator showing Main Stat, Sub Stats, Bond, and totals"
          />
          <p className={manualBodyClass}>
            <Link href="/calculators/covenant" className={manualLinkClass}>
              Open Covenant →
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
