"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import {
  Database,
  GitBranch,
  Heart,
  Layers,
  Sparkles,
  Tags,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TableName } from "@/lib/database.types";
import { TABLE_CONFIGS } from "@/lib/schema-config";

const ICONS: Partial<Record<TableName, ComponentType<{ className?: string }>>> = {
  tag: Tags,
  awakener: Sparkles,
  desire: Heart,
  awakener_tag_manifestation: Layers,
  tag_default_interaction: Zap,
  manifestation_interaction_override: GitBranch,
  desire_demand: Database,
  path: GitBranch,
};

export function Sidebar() {
  const pathname = usePathname();
  const sorted = [...TABLE_CONFIGS]
    .filter((config) => !config.sidebarHidden)
    .sort((a, b) => a.order - b.order);

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-zinc-200 bg-zinc-950 text-zinc-100">
      <div className="border-b border-zinc-800 px-5 py-6">
        <Link href="/" className="block">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">
            MotherTree
          </p>
          <h1 className="mt-1 text-lg font-semibold text-white">
            Admin Dashboard
          </h1>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {sorted.map((config) => {
          const href = `/tables/${config.name}`;
          const active = pathname === href;
          const Icon = ICONS[config.name] ?? Database;

          return (
            <Link
              key={config.name}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-white text-zinc-950"
                  : "text-zinc-300 hover:bg-zinc-900 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{config.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-800 px-5 py-4 text-xs leading-relaxed text-zinc-500">
        <p>Data from{" "}
          <a
            href="https://github.com/dansa/SKeyDB"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 underline-offset-2 hover:text-zinc-300 hover:underline"
          >
            SKeyDB
          </a>
        </p>
        <p className="mt-1 text-zinc-600">CC BY-NC-SA 4.0</p>
      </div>
    </aside>
  );
}
