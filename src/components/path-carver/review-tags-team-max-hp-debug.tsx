"use client";

import type { TeamMaxHpResult } from "@/lib/path-carver/team-max-hp";

type ReviewTagsTeamMaxHpDebugProps = {
  teamMaxHp: TeamMaxHpResult;
};

function formatNum(value: number): string {
  if (Number.isInteger(value)) return String(value);
  const fixed = value.toFixed(4).replace(/\.?0+$/, "");
  return fixed === "-0" ? "0" : fixed;
}

export function ReviewTagsTeamMaxHpDebug({
  teamMaxHp,
}: ReviewTagsTeamMaxHpDebugProps) {
  const rows: { label: string; value: string }[] = [
    { label: "total CON", value: formatNum(teamMaxHp.totalCon) },
    { label: "account level", value: String(teamMaxHp.accountLevel) },
    {
      label: "awakener avg level",
      value: String(teamMaxHp.awakenerAverageLevel),
    },
    { label: "effective HP level", value: String(teamMaxHp.effectiveHpLevel) },
    { label: "HpMultiplier", value: formatNum(teamMaxHp.hpMultiplier) },
    { label: "baseline Max HP", value: String(teamMaxHp.baselineMaxHp) },
    {
      label: "Max HP Up total",
      value: formatNum(teamMaxHp.maxHpUpTotal),
    },
    { label: "bonus Max HP", value: String(teamMaxHp.bonusMaxHp) },
    { label: "final Max HP", value: String(teamMaxHp.finalMaxHp) },
  ];

  return (
    <div className="space-y-4 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Debug — Team Max HP
        </p>
        <p className="font-mono text-xs text-zinc-600">
          baseline = ceil(sum CON × HpMultiplier[effectiveLevel]); bonus =
          ceil(baseline × Max HP Up) (0.1 = +10%). Used as all_stats.team_max_hp.
        </p>
      </div>

      <div className="overflow-x-auto rounded border border-border bg-white p-3 font-mono text-xs text-zinc-600">
        <table className="w-full border-collapse text-left">
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.label}
                className="border-b border-zinc-100 last:border-b-0"
              >
                <td className="px-2 py-1.5 text-zinc-500">{row.label}</td>
                <td className="px-2 py-1.5 tabular-nums font-medium text-zinc-800">
                  {row.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
