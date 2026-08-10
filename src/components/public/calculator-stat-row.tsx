import type { ReactNode } from "react";

type CalculatorStatRowProps = {
  label: string;
  value: ReactNode;
};

/** Label and value adjacent so each row stays easy to match. */
export function CalculatorStatRow({ label, value }: CalculatorStatRowProps) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className="text-[var(--mt-ink)]">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}
