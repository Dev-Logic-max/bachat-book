"use client";

import * as React from "react";
import Link from "next/link";
import { ShieldCheck, Users, Home, CreditCard, Landmark, ArrowUpRight, Activity } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { formatPKR } from "@/lib/format";

export default function AdminConsolePage() {
  const session = useSession();
  const supabase = createClient();

  const [stats, setStats] = React.useState({
    totalUsers: 0,
    totalHouseholds: 0,
    totalVolumePaisa: 0,
    proSubscriptions: 0,
  });
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    async function loadAdminStats() {
      const [profilesRes, householdsRes, txsRes, subsRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("households").select("id", { count: "exact", head: true }),
        supabase.from("transactions").select("amount_paisa"),
        supabase.from("subscriptions").select("id", { count: "exact", head: true }),
      ]);

      const volumePaisa = (txsRes.data || []).reduce((sum, t) => sum + Math.abs(t.amount_paisa), 0);

      if (active) {
        setStats({
          totalUsers: profilesRes.count || 1,
          totalHouseholds: householdsRes.count || 1,
          totalVolumePaisa: volumePaisa,
          proSubscriptions: subsRes.count || 1,
        });
        setLoading(false);
      }
    }

    loadAdminStats();
    return () => {
      active = false;
    };
  }, [supabase]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold tracking-tight">Super-Admin Platform Console</h1>
            <span className="bg-brass/20 text-brass-strong border border-brass/40 px-2.5 py-0.5 rounded-full text-xs font-semibold">
              Super Admin Access
            </span>
          </div>
          <p className="text-muted text-xs mt-0.5">
            Monitor platform health, user growth, household subscriptions, and global catalogs.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link href="/admin/households">
            <Button variant="secondary" className="text-xs">
              Manage Households
            </Button>
          </Link>
          <Link href="/admin/institutions">
            <Button variant="primary" className="text-xs">
              Manage Bank Catalog
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-surface border border-border rounded-panel p-5 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-brass/10 text-brass flex items-center justify-center font-bold">
            <Users size={20} />
          </div>
          <div>
            <span className="text-muted text-xs font-semibold block">Total Platform Users</span>
            <span className="font-display text-xl font-bold text-foreground">{stats.totalUsers}</span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-panel p-5 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-navy-900/10 text-navy-900 dark:text-brass flex items-center justify-center font-bold">
            <Home size={20} />
          </div>
          <div>
            <span className="text-muted text-xs font-semibold block">Active Households</span>
            <span className="font-display text-xl font-bold text-foreground">{stats.totalHouseholds}</span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-panel p-5 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-gain-subtle text-gain flex items-center justify-center font-bold">
            <Activity size={20} />
          </div>
          <div>
            <span className="text-muted text-xs font-semibold block">Managed Volume (PKR)</span>
            <span className="font-display text-xl font-bold text-foreground">{formatPKR(stats.totalVolumePaisa)}</span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-panel p-5 shadow-xs flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-brass/20 text-brass-strong flex items-center justify-center font-bold">
            <CreditCard size={20} />
          </div>
          <div>
            <span className="text-muted text-xs font-semibold block">Pro Subscriptions</span>
            <span className="font-display text-xl font-bold text-foreground">{stats.proSubscriptions}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
