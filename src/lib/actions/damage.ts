"use server";

import type { ActionResult } from "@/lib/actions/crud";
import { fetchDamageContext } from "@/lib/damage/load-context";
import type { DamageContext, DamageContextInput } from "@/lib/damage/types";
import { createAdminClient } from "@/lib/supabase/admin";

export type { DamageContext, DamageContextInput } from "@/lib/damage/types";

export async function loadDamageContext(
  input: DamageContextInput,
): Promise<ActionResult<DamageContext>> {
  try {
    const supabase = createAdminClient();
    const data = await fetchDamageContext(supabase, input);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to load damage context",
    };
  }
}
