import type { Metadata } from "next";
import { Sidebar } from "@/components/admin/sidebar";
import { RecommendationSimulator } from "@/components/simulator/recommendation-simulator";
import {
  getSimulatorAwakenerOptions,
} from "@/lib/actions/simulator";
import { getSimulatorGearOptions } from "@/lib/actions/simulator-flow";

export const metadata: Metadata = {
  title: "Recommendation Simulator Debugger",
};

const EMPTY_GEAR_OPTIONS = { posse: [], wheel: [], covenant: [] };

export default async function SimulatorPage() {
  const [awakenerOptionsResult, gearOptionsResult] = await Promise.all([
    getSimulatorAwakenerOptions(),
    getSimulatorGearOptions(),
  ]);

  const awakenerOptions = awakenerOptionsResult.success
    ? awakenerOptionsResult.data
    : [];
  const gearOptions = gearOptionsResult.success
    ? gearOptionsResult.data
    : EMPTY_GEAR_OPTIONS;

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
        {!gearOptionsResult.success && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Failed to load gear options: {gearOptionsResult.error}
          </div>
        )}
        <RecommendationSimulator
          awakenerOptions={awakenerOptions}
          gearOptions={gearOptions}
        />
      </main>
    </div>
  );
}
