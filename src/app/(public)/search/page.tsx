import type { Metadata } from "next";
import { SearchFilters } from "@/components/public/search-filters";
import { listPublicTable } from "@/lib/actions/public-read";
import type { PublicRow } from "@/lib/public-read/allowlist";
import { buildSearchFilterOptions } from "@/lib/public/search-filter-options";

export const metadata: Metadata = {
  title: "Search",
};

async function loadSearchFilterOptions() {
  const [tagsResult, interactionsResult, realmsResult] = await Promise.all([
    listPublicTable("tag"),
    listPublicTable("tag_default_interaction"),
    listPublicTable("realm"),
  ]);

  if (!tagsResult.success) {
    return { success: false as const, error: tagsResult.error };
  }
  if (!interactionsResult.success) {
    return { success: false as const, error: interactionsResult.error };
  }
  if (!realmsResult.success) {
    return { success: false as const, error: realmsResult.error };
  }

  const tags = tagsResult.data as PublicRow<"tag">[];
  const interactions =
    interactionsResult.data as PublicRow<"tag_default_interaction">[];
  const realms = realmsResult.data as PublicRow<"realm">[];

  if (tagsResult.truncated || interactionsResult.truncated || realmsResult.truncated) {
    return {
      success: false as const,
      error:
        "Search option lists were truncated by the row cap. Try again later or contact the maintainer.",
    };
  }

  return {
    success: true as const,
    options: buildSearchFilterOptions(tags, interactions, realms),
  };
}

export default async function SearchPage() {
  const loaded = await loadSearchFilterOptions();

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-10">
      <div>
        <h1 className="font-[family-name:var(--font-mother-display)] text-4xl font-semibold tracking-tight text-[var(--mt-ink)]">
          Search
        </h1>
        <p className="mt-3 max-w-2xl text-[var(--mt-ink-muted)]">
          Only 1 tag from Attacker/Defender/Support at a time
        </p>
      </div>

      {loaded.success ? (
        <SearchFilters options={loaded.options} />
      ) : (
        <p
          role="alert"
          className="rounded-md border border-[var(--mt-border)] bg-[rgb(255_245_235_/_0.35)] px-4 py-3 text-sm text-[var(--mt-ink)]"
        >
          Could not load search options: {loaded.error}
        </p>
      )}
    </div>
  );
}
