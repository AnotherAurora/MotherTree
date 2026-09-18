import { headers } from "next/headers";

/** Generic client-facing copy — do not mention keys, Vercel, or admin. */
export const ADMIN_NOT_FOUND_MESSAGE = "Not found";

/**
 * Admin runs only on a local machine with ADMIN_ENABLED=true.
 * Always false on Vercel, Cloudflare Pages, or Cloudflare Workers, even if a
 * service role key is present.
 */
export function isAdminRuntimeEnabled(): boolean {
  if (process.env.VERCEL) return false;
  if (process.env.CF_PAGES) return false;
  if (process.env.CF_WORKERS === "true") return false;
  return process.env.ADMIN_ENABLED === "true";
}

export function assertAdminRuntime(): void {
  if (!isAdminRuntimeEnabled()) {
    throw new Error(ADMIN_NOT_FOUND_MESSAGE);
  }
}

/** True only for loopback hosts (localhost, 127.0.0.1, [::1], *.localhost). */
export function isLocalHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const normalized = host.trim().toLowerCase();
  if (!normalized) return false;

  // Strip an optional port, including the bracketed IPv6 form "[::1]:3000".
  let hostname = normalized;
  if (normalized.startsWith("[")) {
    const closing = normalized.indexOf("]");
    if (closing === -1) return false;
    hostname = normalized.slice(1, closing);
  } else {
    const colon = normalized.indexOf(":");
    if (colon !== -1) hostname = normalized.slice(0, colon);
  }

  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  ) {
    return true;
  }

  return hostname.endsWith(".localhost");
}

/**
 * Throws unless admin is enabled AND the request arrived on a loopback host.
 * Use at the entry of admin pages and Server Actions so a forged direct
 * request cannot reach admin code even if env vars are misconfigured.
 */
export async function assertAdminLocalRequest(): Promise<void> {
  assertAdminRuntime();
  const host = (await headers()).get("host");
  if (!isLocalHost(host)) {
    throw new Error(ADMIN_NOT_FOUND_MESSAGE);
  }
}

/**
 * Boolean form of {@link assertAdminLocalRequest} for Server Actions and pages
 * that return an error result / `notFound()` instead of throwing.
 */
export async function isAdminLocalRequest(): Promise<boolean> {
  if (!isAdminRuntimeEnabled()) return false;
  const host = (await headers()).get("host");
  return isLocalHost(host);
}

export function adminUnavailableResult<T = void>(): {
  success: false;
  error: string;
} {
  return { success: false, error: ADMIN_NOT_FOUND_MESSAGE };
}
