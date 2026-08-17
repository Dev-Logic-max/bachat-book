"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * The platform subcategories this household has switched off.
 *
 * Every PICKER filters by this; Settings → Categories deliberately does not,
 * because it is the only screen that can switch them back on.
 *
 * Fetched per mount rather than threaded through the session: the set changes
 * from the settings screen while other surfaces are already open, and a value
 * baked into the server session would stay stale until a full refresh. The query
 * returns ids only, so it stays small even when a household has pruned heavily.
 *
 * Returns an empty set while loading. That is the deliberate direction to fail
 * in — a picker briefly showing one category too many is recoverable, whereas
 * one that briefly hides the category you were reaching for reads as data loss.
 */
export function useHiddenCategoryIds(householdId: string | null | undefined) {
  const supabase = createClient();
  const [hidden, setHidden] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  );

  React.useEffect(() => {
    if (!householdId) return;
    let active = true;

    // Async, so this is not the synchronous setState in useEffect that React
    // Compiler rejects.
    (async () => {
      const { data, error } = await supabase
        .from("household_hidden_categories")
        .select("category_id")
        .eq("household_id", householdId);

      if (!active || error) return;
      setHidden(new Set((data ?? []).map((r) => r.category_id)));
    })();

    return () => {
      active = false;
    };
  }, [householdId, supabase]);

  return hidden;
}
