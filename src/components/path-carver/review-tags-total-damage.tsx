"use client";

import type { TotalDamageResult } from "@/lib/path-carver/total-damage";

type ReviewTagsTotalDamageProps = {
  totalDamage: TotalDamageResult;
};

function formatNum(value: number): string {
  if (Number.isInteger(value)) return String(value);
  const fixed = value.toFixed(4).replace(/\.?0+$/, "");
  return fixed === "-0" ? "0" : fixed;
}

export function ReviewTagsTotalDamage({
  totalDamage,
}: ReviewTagsTotalDamageProps) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium text-zinc-800">Total Damage</p>
        <p className="text-lg font-semibold tabular-nums text-zinc-900">
          {formatNum(totalDamage.total)}
        </p>
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2">Channel</th>
              <th className="px-3 py-2 text-right">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {totalDamage.byChannel.map((channel) => (
              <tr key={channel.tagName}>
                <td className="px-3 py-2 text-zinc-700">{channel.tagName}</td>
                <td className="px-3 py-2 text-right tabular-nums text-zinc-600">
                  {formatNum(channel.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
