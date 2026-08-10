import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

/**
 * Server client for Server Components, Route Handlers and Server Actions.
 *
 * `cookies()` is async in Next 16, so this is async too — always `await` it.
 *
 * The setAll try/catch is deliberate: Server Components cannot write cookies.
 * The proxy refreshes the session on every request, so a failure here is
 * expected and harmless rather than something to log.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — the proxy handles the refresh.
          }
        },
      },
    },
  );
}
