/** Generic client-facing copy — do not mention keys, Vercel, or admin. */
export const ADMIN_NOT_FOUND_MESSAGE = "Not found";

/**
 * Admin runs only on a local machine with ADMIN_ENABLED=true.
 * Always false on Vercel, even if a service role key is present.
 */
export function isAdminRuntimeEnabled(): boolean {
  if (process.env.VERCEL) return false;
  return process.env.ADMIN_ENABLED === "true";
}

export function assertAdminRuntime(): void {
  if (!isAdminRuntimeEnabled()) {
    throw new Error(ADMIN_NOT_FOUND_MESSAGE);
  }
}

export function adminUnavailableResult<T = void>(): {
  success: false;
  error: string;
} {
  return { success: false, error: ADMIN_NOT_FOUND_MESSAGE };
}
