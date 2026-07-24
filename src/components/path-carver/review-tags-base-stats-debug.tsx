"use client";

import type { Awakener } from "@/lib/team-data/types";

type ReviewTagsBaseStatsDebugProps = {
  awakeners: Awakener[];
};

const STAT_COLUMNS: {
  label: string;
  read: (a: Awakener) => number | null;
}[] = [
  { label: "con", read: (a) => a.con },
  { label: "atk", read: (a) => a.atk },
  { label: "def", read: (a) => a.def },
  { label: "keyflare_regen", read: (a) => a.keyflareRegen },
  { label: "damage_amp", read: (a) => a.damageAmp },
  { label: "crit_rate", read: (a) => a.critRate },
  { label: "crit_dmg", read: (a) => a.critDmg },
  { label: "realm_mastery", read: (a) => a.realmMastery },
  { label: "base_aliemus", read: (a) => a.baseAliemus },
  { label: "aliemus_regen", read: (a) => a.aliemusRegen },
  { label: "sigil_yield", read: (a) => a.sigilYield },
  { label: "death_resist", read: (a) => a.deathResist },
];

function formatNum(value: number): string {
  if (Number.isInteger(value)) return String(value);
  const fixed = value.toFixed(4).replace(/\.?0+$/, "");
  return fixed === "-0" ? "0" : fixed;
}

function formatStat(value: number | null): string {
  if (value == null) return "—";
  return formatNum(value);
}

export function ReviewTagsBaseStatsDebug({
  awakeners,
}: ReviewTagsBaseStatsDebugProps) {
  return (
    <div className="space-y-4 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Debug — Base stats
        </p>
        <p className="font-mono text-xs text-zinc-600">
          Total base stats per awakener (table + wheels + covenant; keyflare DR;
          Special.Increase Base Keyflare). Same values used for dependency_stat.
        </p>
      </div>

      <div className="max-h-[420px] overflow-y-auto rounded border border-border bg-white p-3 font-mono text-xs text-zinc-600">
        {awakeners.length === 0 ? (
          <p className="text-zinc-400">No awakeners on this team.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-left">
              <thead>
                <tr className="border-b border-zinc-200 text-[10px] uppercase tracking-wide text-zinc-500">
                  <th className="px-2 py-1.5 font-medium">Awakener</th>
                  {STAT_COLUMNS.map((col) => (
                    <th
                      key={col.label}
                      className="px-2 py-1.5 font-medium tabular-nums"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {awakeners.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-zinc-100 last:border-b-0"
                  >
                    <td className="px-2 py-1.5 font-medium text-zinc-800">
                      {a.name ?? `#${a.id}`}
                      <span className="ml-1 font-normal text-zinc-400">
                        #{a.id}
                      </span>
                    </td>
                    {STAT_COLUMNS.map((col) => (
                      <td
                        key={col.label}
                        className="px-2 py-1.5 tabular-nums text-zinc-600"
                      >
                        {formatStat(col.read(a))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
