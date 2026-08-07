import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Manual",
};

export default function ManualPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-6 py-10">
      <div>
        <h1 className="font-[family-name:var(--font-mother-display)] text-4xl font-semibold tracking-tight text-[var(--mt-ink)]">
          Manual
        </h1>
        <p className="mt-3 max-w-2xl text-[var(--mt-ink-muted)]">
          Feature list, mechanics documentation, and tool guides. This page is a
          placeholder until Manual content ships.
        </p>
      </div>
    </div>
  );
}
