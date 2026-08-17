"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Whether an email provider key is configured.
 *
 * A server action rather than a prop, because the admin console is a client
 * component and this value lives in the environment. It returns a BOOLEAN and
 * never the key — the point of keeping secrets out of `platform_settings` is
 * lost if the console can read them back by another route.
 *
 * Guarded on its own. A server action is a public HTTP endpoint: anyone who
 * knows its id can invoke it, so it cannot rely on the page that calls it having
 * already checked the role.
 */
export async function getEmailKeyPresent(): Promise<boolean> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (!isAdmin) return false;

  return Boolean(process.env.EMAIL_API_KEY);
}
