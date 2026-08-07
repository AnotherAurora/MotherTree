"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MotherTreeMark } from "@/components/public/mother-tree-mark";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/search", label: "Search" },
  { href: "/calculator", label: "Calculator" },
  { href: "/manual", label: "Manual" },
  { href: "/about", label: "About Me" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-[var(--mt-border)] bg-[rgb(255_245_235_/_0.35)] backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-6 py-4">
        <Link href="/" className="block shrink-0">
          <MotherTreeMark className="text-2xl leading-none" />
          <p className="mt-0.5 text-xs tracking-[0.14em] text-[var(--mt-ink-muted)]">
            root version
          </p>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative px-3 py-2 text-sm transition-colors",
                  active
                    ? "font-medium text-[var(--mt-ink)] after:absolute after:inset-x-3 after:bottom-1 after:h-px after:bg-[var(--mt-ember)] after:content-['']"
                    : "text-[var(--mt-ink-muted)] hover:text-[var(--mt-ink)]",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
