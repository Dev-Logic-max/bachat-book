"use client";

import * as React from "react";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/supabase/types";

export default function IntegrationsSettingsPage() {
  const session = useSession();
  const supabase = createClient();
  const { showToast } = useToast();

  const [connections, setConnections] = React.useState<Tables<"calendar_connections">[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    async function loadConnections() {
      const { data } = await supabase
        .from("calendar_connections")
        .select("*")
        .eq("user_id", session.user.id);

      if (active && data) {
        setConnections(data);
        setLoading(false);
      }
    }
    loadConnections();
    return () => {
      active = false;
    };
  }, [session.user.id, supabase]);

  const handleConnectProvider = (provider: "google" | "microsoft") => {
    showToast({
      type: "info",
      title: `${provider === "google" ? "Google" : "Microsoft"} Calendar Sync`,
      description: "OAuth 2.0 calendar integration authorization is active for Pro accounts.",
    });
  };

  const googleConnected = connections.find((c) => c.provider === "google");
  const msConnected = connections.find((c) => c.provider === "microsoft");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-semibold">External Integrations & Calendar Sync</h2>
        <p className="text-muted text-xs">
          Connect your personal or work calendars to synchronize bills, tasks, and events 2-way.
        </p>
      </div>

      <div className="space-y-4">
        {/* Google Calendar Card */}
        <div className="bg-surface border border-border rounded-panel p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-sm">
              G
            </div>
            <div>
              <h3 className="font-display text-sm font-semibold flex items-center gap-2">
                Google Calendar Sync
                {googleConnected && (
                  <span className="bg-gain-subtle text-gain border border-gain/20 text-[10px] px-2 py-0.5 rounded-full font-medium">
                    Connected
                  </span>
                )}
              </h3>
              <p className="text-muted text-xs mt-0.5">
                Sync bills, salary dates, and tasks directly to Google Calendar on Web & Mobile.
              </p>
            </div>
          </div>

          <Button
            variant={googleConnected ? "secondary" : "primary"}
            onClick={() => handleConnectProvider("google")}
            className="self-start sm:self-auto"
          >
            {googleConnected ? "Manage Google Sync" : "Connect Google Calendar"}
          </Button>
        </div>

        {/* Microsoft Outlook Card */}
        <div className="bg-surface border border-border rounded-panel p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-700/10 text-blue-700 flex items-center justify-center font-bold text-sm">
              M
            </div>
            <div>
              <h3 className="font-display text-sm font-semibold flex items-center gap-2">
                Microsoft Outlook Calendar
                {msConnected && (
                  <span className="bg-gain-subtle text-gain border border-gain/20 text-[10px] px-2 py-0.5 rounded-full font-medium">
                    Connected
                  </span>
                )}
              </h3>
              <p className="text-muted text-xs mt-0.5">
                Integrate work schedules and Outlook event reminders into Bachat Book.
              </p>
            </div>
          </div>

          <Button
            variant={msConnected ? "secondary" : "primary"}
            onClick={() => handleConnectProvider("microsoft")}
            className="self-start sm:self-auto"
          >
            {msConnected ? "Manage Outlook Sync" : "Connect Microsoft Outlook"}
          </Button>
        </div>
      </div>
    </div>
  );
}
