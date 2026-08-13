import Link from "next/link";
import { CalculatorBySlug } from "@/components/public/calculator-by-slug";
import {
  getCalculatorHref,
  getCalculatorsByGroup,
  getGroupLabel,
  getRelatedCalculators,
  isCalculatorSlug,
  type CalculatorEntry,
} from "@/lib/public/calculator-catalog";
import { cn } from "@/lib/utils";

const groupHeadingClass =
  "font-[family-name:var(--font-mother-display)] text-4xl font-semibold tracking-tight text-[var(--mt-ink)]";

const toolHeadingClass =
  "font-[family-name:var(--font-mother-display)] text-3xl font-semibold tracking-tight text-[var(--mt-ink)]";

export function CalculatorToolShell({ entry }: { entry: CalculatorEntry }) {
  if (!isCalculatorSlug(entry.slug)) {
    return null;
  }

  const groupTools = getCalculatorsByGroup(entry.group);
  const related = getRelatedCalculators(entry);

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href="/calculators"
        className="inline-block text-sm font-medium text-[var(--mt-ember)] underline underline-offset-4 hover:text-[var(--mt-ember-deep)]"
      >
        ← Calculators
      </Link>

      <h1 className={groupHeadingClass}>{getGroupLabel(entry.group)}</h1>

      <nav aria-label={`${getGroupLabel(entry.group)} calculators`}>
        <ul className="flex flex-wrap gap-1 border-b border-[var(--mt-border)]">
          {groupTools.map((tool) => {
            const active = tool.slug === entry.slug;

            return (
              <li key={tool.slug}>
                <Link
                  href={getCalculatorHref(tool)}
                  className={cn(
                    "relative block px-3 py-2 text-sm transition-colors sm:px-4",
                    active
                      ? "font-medium text-[var(--mt-ink)] after:absolute after:inset-x-3 after:bottom-0 after:h-px after:bg-[var(--mt-ember)] after:content-['']"
                      : "text-[var(--mt-ink-muted)] hover:text-[var(--mt-ink)]",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {tool.title}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <h2
        className={
          entry.pageHeading === "sr-only" ? "sr-only" : toolHeadingClass
        }
      >
        {entry.title}
      </h2>

      <CalculatorBySlug slug={entry.slug} />

      {related.length > 0 || entry.manualHref ? (
        <nav
          className="border-t border-[var(--mt-border)] pt-6"
          aria-label="Related"
        >
          <p className="mb-3 text-sm font-medium text-[var(--mt-ink-muted)]">
            Related
          </p>
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            {related.map((tool) => (
              <li key={tool.slug}>
                <Link
                  href={getCalculatorHref(tool)}
                  className="text-base font-medium text-[var(--mt-ember)] underline underline-offset-4 hover:text-[var(--mt-ember-deep)]"
                >
                  {tool.title}
                </Link>
              </li>
            ))}
            {entry.manualHref ? (
              <li>
                <Link
                  href={entry.manualHref}
                  className="text-base font-medium text-[var(--mt-ember)] underline underline-offset-4 hover:text-[var(--mt-ember-deep)]"
                >
                  Manual
                </Link>
              </li>
            ) : null}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
