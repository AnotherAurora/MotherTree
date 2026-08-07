import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Search",
};

export default function SearchPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-6 py-10">
      <div>
        <h1 className="font-[family-name:var(--font-mother-display)] text-4xl font-semibold tracking-tight text-[var(--mt-ink)]">
          Search
        </h1>
        <p className="mt-3 max-w-2xl text-[var(--mt-ink-muted)]">
          Guided, read-only search across allowlisted game data tables. This page
          is a placeholder until Search ships.
        </p>
      </div>
    </div>
  );
}
