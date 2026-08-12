import type { Metadata } from "next";
import { CovenantCalculator } from "@/components/public/covenant-calculator";

export const metadata: Metadata = {
  title: "Covenant",
};

export default function CovenantCalculatorPage() {
  return <CovenantCalculator />;
}
