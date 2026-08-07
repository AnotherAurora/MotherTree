"use server";

import { headers } from "next/headers";
import {
  isPublicReadTable,
  type PublicReadTable,
  type PublicRow,
} from "@/lib/public-read/allowlist";
import { fetchPublicTable } from "@/lib/public-read/fetch";
import { checkPublicRateLimit } from "@/lib/public-read/rate-limit";

export type ListPublicTableResult<T extends PublicReadTable = PublicReadTable> =
  | { success: true; data: PublicRow<T>[]; truncated: boolean }
  | { success: false; error: string };

async function clientIpKey(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return `ip:${first}`;
  }
  const realIp = h.get("x-real-ip")?.trim();
  if (realIp) return `ip:${realIp}`;
  return "ip:unknown";
}

/**
 * Public guided read entrypoint. Allowlisted tables only; no arbitrary SQL.
 * Enforces ~60 req/min/IP and 500-row cap with timestamp columns omitted.
 */
export async function listPublicTable(
  table: string,
  options?: { limit?: number },
): Promise<ListPublicTableResult> {
  if (!isPublicReadTable(table)) {
    return { success: false, error: `Table "${table}" is not publicly readable` };
  }

  const rate = checkPublicRateLimit(await clientIpKey());
  if (!rate.ok) {
    return {
      success: false,
      error: `Rate limit exceeded. Retry in ${Math.ceil(rate.retryAfterMs / 1000)}s`,
    };
  }

  return fetchPublicTable(table, { limit: options?.limit });
}
