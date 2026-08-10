/**
 * Shown until localStorage restore finishes so the real calculator
 * only mounts with the correct saved state (avoids mode-toggle flash).
 */
export function CalculatorPendingHydration() {
  return <div className="min-h-[12rem]" aria-busy />;
}
