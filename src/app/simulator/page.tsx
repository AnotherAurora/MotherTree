import type { Metadata } from "next";
import { Sidebar } from "@/components/admin/sidebar";
import { RecommendationSimulator } from "@/components/simulator/recommendation-simulator";

export const metadata: Metadata = {
  title: "Recommendation Simulator Debugger",
};

export default function SimulatorPage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <RecommendationSimulator />
      </main>
    </div>
  );
}
