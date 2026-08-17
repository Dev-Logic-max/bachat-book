import { createClient } from "@/lib/supabase/server";
import type { Tables, Views } from "@/lib/supabase/types";

export type UserSession = {
  user: {
    id: string;
    email: string;
  };
  profile: Tables<"profiles"> | null;
  household: Tables<"households"> | null;
  preferences: Tables<"preferences"> | null;
  /** The signed-in user's OWN plan. Governs how many workspaces they may create. */
  subscription: Tables<"subscriptions"> | null;
  /**
   * The active workspace's entitlements, resolved from its OWNER's plan.
   *
   * Gate features on this, never on `subscription` — a free member inside a Pro
   * workspace is entitled to Pro *there*, and reading their own plan instead
   * would show them different numbers from the owner on the same screen.
   */
  workspace: Views<"workspace_access"> | null;
};

export async function getSession(): Promise<UserSession | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return null;
  }

  // Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  // Fetch preferences
  const { data: preferences } = await supabase
    .from("preferences")
    .select("*")
    .eq("user_id", user.id)
    .single();

  let household: Tables<"households"> | null = null;
  if (preferences?.default_household_id) {
    const { data: h } = await supabase
      .from("households")
      .select("*")
      .eq("id", preferences.default_household_id)
      .single();
    household = h;
  }

  // Fallback to first household if default not found
  if (!household) {
    const { data: members } = await supabase
      .from("household_members")
      .select("household_id, households(*)")
      .eq("user_id", user.id)
      .limit(1);

    if (members && members.length > 0) {
      household = (members[0] as unknown as { households: Tables<"households"> }).households;
    }
  }

  // The user's own plan — one row per person, keyed by user_id.
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  // The active workspace's entitlements, which follow its OWNER's plan and so
  // may differ from `subscription` above when the user is someone else's guest.
  let workspace: Views<"workspace_access"> | null = null;
  if (household) {
    const { data: ws } = await supabase
      .from("workspace_access")
      .select("*")
      .eq("id", household.id)
      .maybeSingle();
    workspace = ws;
  }

  return {
    user: {
      id: user.id,
      email: user.email,
    },
    profile,
    household,
    preferences,
    subscription,
    workspace,
  };
}
