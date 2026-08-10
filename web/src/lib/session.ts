import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";

export type UserSession = {
  user: {
    id: string;
    email: string;
  };
  profile: Tables<"profiles"> | null;
  household: Tables<"households"> | null;
  preferences: Tables<"preferences"> | null;
  subscription: Tables<"subscriptions"> | null;
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

  // Fetch active subscription for household
  let subscription: Tables<"subscriptions"> | null = null;
  if (household) {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("household_id", household.id)
      .single();
    subscription = sub;
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
  };
}
