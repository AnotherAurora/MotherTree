import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Search",
};

export default function SearchPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-6 py-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
          Search
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-600">
          Guided, read-only search across allowlisted game data tables. This page
          is a placeholder until Search ships.
        </p>
      </div>
    </div>
  );
}
