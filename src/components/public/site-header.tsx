"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { MotherTreeMark } from "@/components/public/mother-tree-mark";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/search", label: "Search" },
  { href: "/calculators", label: "Calculators" },
  { href: "/manual", label: "Manual" },
  { href: "/about", label: "About Me" },
] as const;

function isActivePath(pathname: string, href: string) {
  return href === "/"
    ? pathname === "/"
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  return (
    <header className="border-b border-[var(--mt-border)] bg-[rgb(255_245_235_/_0.35)] backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:gap-6 sm:px-6">
        <Link
          href="/"
          className="block min-w-0 shrink-0"
          onClick={() => setMenuOpen(false)}
        >
          <MotherTreeMark className="text-2xl leading-none" />
          <p className="mt-0.5 text-xs tracking-[0.14em] text-[var(--mt-ink-muted)]">
            root version
          </p>
        </Link>

        <nav
          className="hidden items-center gap-1 md:flex"
          aria-label="Primary"
        >
          {NAV_ITEMS.map((item) => {
            const active = isActivePath(pathname, item.href);

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

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md text-[var(--mt-ink)] transition-colors hover:bg-[var(--mt-surface-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mt-ember)] md:hidden"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? (
            <X className="h-5 w-5" aria-hidden />
          ) : (
            <Menu className="h-5 w-5" aria-hidden />
          )}
        </button>
      </div>

      <nav
        id={menuId}
        aria-label="Primary"
        hidden={!menuOpen}
        className="border-t border-[var(--mt-border)] bg-[rgb(255_245_235_/_0.55)] md:hidden"
      >
        <div className="mx-auto flex max-w-5xl flex-col px-4 py-2 sm:px-6">
          {NAV_ITEMS.map((item) => {
            const active = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "rounded-md px-3 py-3 text-base transition-colors",
                  active
                    ? "bg-[var(--mt-surface)] font-medium text-[var(--mt-ink)] shadow-[inset_3px_0_0_0_var(--mt-ember)]"
                    : "text-[var(--mt-ink-muted)] hover:bg-[var(--mt-surface)] hover:text-[var(--mt-ink)]",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
