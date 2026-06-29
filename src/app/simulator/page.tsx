import type { Metadata } from "next";
import { Sidebar } from "@/components/admin/sidebar";
import { RecommendationSimulator } from "@/components/simulator/recommendation-simulator";
import { getSimulatorAwakenerOptions } from "@/lib/actions/simulator";

export const metadata: Metadata = {
  title: "Recommendation Simulator Debugger",
};

export default async function SimulatorPage() {
  const awakenerOptionsResult = await getSimulatorAwakenerOptions();
  const awakenerOptions = awakenerOptionsResult.success
    ? awakenerOptionsResult.data
    : [];

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        {!awakenerOptionsResult.success && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Failed to load awakeners: {awakenerOptionsResult.error}. Check your{" "}
            <code className="rounded bg-red-100 px-1">.env.local</code>{" "}
            configuration.
          </div>
        )}
        <RecommendationSimulator awakenerOptions={awakenerOptions} />
      </main>
    </div>
  );
}
