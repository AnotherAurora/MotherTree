import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Calculator",
};

export default function CalculatorPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-6 py-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
          Calculator
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-600">
          Calculator tools for Path Carver factors such as keyflare, death
          resist, HP, tentacle damage, and realm mastery. This hub is a
          placeholder until the catalog tools ship.
        </p>
      </div>
    </div>
  );
}
