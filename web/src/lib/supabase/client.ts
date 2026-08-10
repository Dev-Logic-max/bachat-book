import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

/**
 * Browser client. Safe to use in Client Components — the publishable key
 * carries no privileges; RLS on every table is what actually protects the data.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
