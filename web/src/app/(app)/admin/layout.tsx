import * as React from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * The only thing standing between a signed-in user and the platform console.
 *
 * There was nothing here before: `(app)/layout.tsx` checks that you are logged
 * in and stops. RLS meant a normal user reaching /admin saw only their own row,
 * so it was never a data breach — but the console rendered for them, which
 * advertises a surface that is one policy slip away from being one. A guard the
 * page cannot forget to call belongs in the layout.
 *
 * `notFound()` rather than a redirect: an admin URL that answers "forbidden"
 * confirms the route exists to someone probing for it.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) notFound();

  // Asks the database, not the session object. A role cached in a cookie is a
  // role the user can edit.
  const { data: isAdmin } = await supabase.rpc("is_platform_admin");

  if (!isAdmin) notFound();

  return <>{children}</>;
}
