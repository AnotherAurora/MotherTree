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
  title: {
    default: "Mother Tree",
    template: "%s · Mother Tree",
  },
  description: "Mother Tree — root version. Search and Calculators for game data.",
};

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className={`${motherDisplay.variable} public-theme flex min-h-screen flex-col`}
    >
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
