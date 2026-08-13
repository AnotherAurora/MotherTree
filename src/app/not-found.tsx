import type { Metadata } from "next";
import { Lora } from "next/font/google";
import { SiteFooter } from "@/components/public/site-footer";
import { SiteHeader } from "@/components/public/site-header";

const motherDisplay = Lora({
  variable: "--font-mother-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Not found",
};

export default function NotFound() {
  return (
    <div
      className={`${motherDisplay.variable} public-theme flex min-h-screen flex-col`}
    >
      <SiteHeader />
      <main className="mx-auto flex flex-1 w-full max-w-5xl flex-col px-6 py-16">
        <h1 className="font-[family-name:var(--font-mother-display)] text-4xl font-semibold tracking-tight text-[var(--mt-ink)]">
          Not found
        </h1>
        <p className="mt-4 max-w-xl text-[#3d2a22] leading-relaxed">
          This page does not exist.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
