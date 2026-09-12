import type { Metadata } from "next";
import { RelicPicker } from "@/components/relic-picker/relic-picker";
import { fetchAllPublicTable } from "@/lib/public-read/fetch";
import {
  buildPublicAwakenerOptions,
  buildPublicGearOptions,
} from "@/lib/public/relic-picker-data";

export const metadata: Metadata = {
  title: "Relic Picker",
};

export const dynamic = "force-dynamic";

async function loadRelicPickerOptions() {
  const [awakeners, realms, wheels, covenants, covenantStatSets, posses] =
    await Promise.all([
      fetchAllPublicTable("awakener"),
      fetchAllPublicTable("realm"),
      fetchAllPublicTable("wheel"),
      fetchAllPublicTable("covenant"),
      fetchAllPublicTable("covenant_stat_set"),
      fetchAllPublicTable("posse"),
    ]);

  const failure = [
    awakeners,
    realms,
    wheels,
    covenants,
    covenantStatSets,
    posses,
  ].find((result) => !result.success);
  if (failure && !failure.success) {
    return { success: false as const, error: failure.error };
  }

  return {
    success: true as const,
    awakenerOptions: buildPublicAwakenerOptions({
      awakeners: awakeners.success ? awakeners.data : [],
      realms: realms.success ? realms.data : [],
    }),
    gearOptions: buildPublicGearOptions({
      posses: posses.success ? posses.data : [],
      wheels: wheels.success ? wheels.data : [],
      covenants: covenants.success ? covenants.data : [],
      covenantStatSets: covenantStatSets.success ? covenantStatSets.data : [],
    }),
  };
}

export default async function RelicPickerPage() {
  const loaded = await loadRelicPickerOptions();

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <div>
        <h1 className="font-[family-name:var(--font-mother-display)] text-4xl font-semibold tracking-tight text-[var(--mt-ink)]">
          Relic Picker
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--mt-ink-muted)]">
          Build a team, then compare every damage relic by how much it raises
          the team&apos;s Total Damage.
        </p>
      </div>

      {loaded.success ? (
        <RelicPicker
          awakenerOptions={loaded.awakenerOptions}
          gearOptions={loaded.gearOptions}
        />
      ) : (
        <p
          role="alert"
          className="rounded-md border border-[var(--mt-border)] bg-[rgb(255_245_235_/_0.35)] px-4 py-3 text-sm text-[var(--mt-ink)]"
        >
          Could not load relic picker data: {loaded.error}
        </p>
      )}
    </div>
  );
}
