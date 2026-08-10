"use client";

import * as React from "react";
import Link from "next/link";
import { Landmark, ArrowLeft, Plus } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/types";

export default function AdminInstitutionsPage() {
  const session = useSession();
  const supabase = createClient();

  const [institutions, setInstitutions] = React.useState<Tables<"institutions">[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    async function loadInstitutions() {
      const { data } = await supabase.from("institutions").select("*").order("name", { ascending: true });
      if (active && data) {
        setInstitutions(data);
        setLoading(false);
      }
    }
    loadInstitutions();
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
            <h1 className="font-display text-2xl font-bold tracking-tight">Pakistani Financial Catalog</h1>
            <p className="text-muted text-xs">Manage bank logos, mobile wallets, and utility provider catalog entries.</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-surface border-border rounded-panel border p-8 text-center text-muted text-xs">
          Loading catalog...
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {institutions.map((inst) => (
            <div key={inst.id} className="bg-surface border border-border rounded-panel p-4 shadow-sm flex items-center gap-3">
              {inst.logo_path ? (
                <img src={inst.logo_path} alt="" className="w-8 h-8 rounded-full object-contain shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-brass/10 text-brass font-bold text-xs flex items-center justify-center">
                  {inst.short_name.slice(0, 2)}
                </div>
              )}
              <div>
                <h4 className="font-bold text-xs text-foreground">{inst.name}</h4>
                <span className="text-muted text-[11px] uppercase font-mono">{inst.kind} · {inst.short_name}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
