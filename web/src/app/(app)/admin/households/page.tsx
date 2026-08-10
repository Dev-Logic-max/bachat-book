"use client";

import * as React from "react";
import Link from "next/link";
import { Home, ArrowLeft, ShieldCheck, CreditCard } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/types";

export default function AdminHouseholdsPage() {
  const session = useSession();
  const supabase = createClient();

  const [households, setHouseholds] = React.useState<Tables<"households">[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    async function loadHouseholds() {
      const { data } = await supabase.from("households").select("*").order("created_at", { ascending: false });
      if (active && data) {
        setHouseholds(data);
        setLoading(false);
      }
    }
    loadHouseholds();
    return () => {
      active = false;
    };
  }, [supabase]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin">
            <Button variant="ghost" className="p-2">
              <ArrowLeft size={18} />
            </Button>
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Household Management</h1>
            <p className="text-muted text-xs">Inspect registered households and manage subscription plan tiers.</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-surface border-border rounded-panel border p-8 text-center text-muted text-xs">
          Loading households...
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-panel overflow-hidden shadow-sm divide-y divide-border">
          {households.map((h) => (
            <div key={h.id} className="p-4 flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-brass/10 text-brass flex items-center justify-center font-bold">
                  <Home size={16} />
                </div>
                <div>
                  <h4 className="font-bold text-foreground">{h.name}</h4>
                  <span className="text-muted text-[11px] capitalize">{h.kind} Household · {h.base_currency}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="bg-gain-subtle text-gain border border-gain/20 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  Pro Plan
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
