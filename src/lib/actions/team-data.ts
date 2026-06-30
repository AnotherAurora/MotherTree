"use server";

import type { ActionResult } from "@/lib/actions/crud";
import { fetchTeamData } from "@/lib/team-data/load-team-data";
import type { TeamData, TeamDataInput } from "@/lib/team-data/types";
import { createAdminClient } from "@/lib/supabase/admin";

export type { TeamData, TeamDataInput } from "@/lib/team-data/types";

export async function loadTeamData(
  input: TeamDataInput,
): Promise<ActionResult<TeamData>> {
  try {
    const supabase = createAdminClient();
    const data = await fetchTeamData(supabase, input);
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to load team data",
    };
  }
}
