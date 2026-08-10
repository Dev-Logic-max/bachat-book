"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { AddEventModal } from "@/components/add-event-modal";
import { createClient } from "@/lib/supabase/client";
import { formatHijri } from "@/lib/format";
import type { Tables } from "@/lib/supabase/types";

type CalendarView = "month" | "week" | "day" | "agenda";

export default function CalendarPage() {
  const session = useSession();
  const supabase = createClient();

  const householdId = session.household?.id || "";
  const userId = session.user.id;

  const [currentDate, setCurrentDate] = React.useState(new Date(2026, 7, 1)); // Default August 2026
  const [view, setView] = React.useState<CalendarView>("month");
  const [events, setEvents] = React.useState<Tables<"calendar_events">[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [addModalOpen, setAddModalOpen] = React.useState(false);
  const [selectedDateStr, setSelectedDateStr] = React.useState("");
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    let active = true;
    if (!householdId) return;

    async function loadEvents() {
      const { data } = await supabase
        .from("calendar_events")
        .select("*")
        .eq("household_id", householdId)
        .order("start_at", { ascending: true });

      if (active && data) {
        setEvents(data);
        setLoading(false);
      }
    }

    loadEvents();
    return () => {
      active = false;
    };
  }, [householdId, refreshKey, supabase]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const today = () => setCurrentDate(new Date());

  // Month grid calculations
  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sun

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Format Hijri string for current month hero
  const hijriStr = formatHijri(currentDate);

  const handleCellClick = (dayNum: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    setSelectedDateStr(dateStr);
    setAddModalOpen(true);
  };

  const getEventsForDay = (dayNum: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    return events.filter((e) => e.start_at.startsWith(dateStr));
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold tracking-tight">
              {monthNames[month]} {year}
            </h1>
            <span className="bg-brass/20 text-brass-strong border border-brass/40 px-2.5 py-0.5 rounded-full text-xs font-semibold">
              AH: {hijriStr}
            </span>
          </div>
          <p className="text-muted text-xs mt-0.5">
            Dual Hijri + Gregorian spine for financial events, bill payments, and tasks.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {/* View Switcher */}
          <div className="bg-surface border border-border rounded-control p-1 flex items-center gap-1 text-xs">
            {(["month", "agenda"] as CalendarView[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1 rounded-control font-semibold capitalize transition-colors ${
                  view === v
                    ? "bg-navy-900 text-on-navy dark:bg-brass dark:text-navy-900"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          <Button
            variant="primary"
            onClick={() => {
              setSelectedDateStr(new Date().toISOString().split("T")[0]);
              setAddModalOpen(true);
            }}
            className="flex items-center gap-1.5"
          >
            <Plus size={16} />
            <span>Add Event</span>
          </Button>
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center justify-between bg-surface border border-border rounded-panel p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={prevMonth} className="p-2">
            <ChevronLeft size={18} />
          </Button>
          <Button variant="ghost" onClick={today} className="text-xs font-semibold">
            Today
          </Button>
          <Button variant="ghost" onClick={nextMonth} className="p-2">
            <ChevronRight size={18} />
          </Button>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#d92b1f]" /> Bill
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#009639]" /> Salary
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00539b]" /> Committee
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1b4d2e]" /> Tax / FBR
          </span>
        </div>
      </div>

      {/* View Content */}
      {view === "month" ? (
        <div className="bg-surface border border-border rounded-panel overflow-hidden shadow-sm">
          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b border-border bg-surface-subtle text-center text-[11px] font-bold text-muted py-2">
            <div>SUN</div>
            <div>MON</div>
            <div>TUE</div>
            <div>WED</div>
            <div>THU</div>
            <div>FRI</div>
            <div>SAT</div>
          </div>

          {/* Month Grid Cells */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-border min-h-[500px]">
            {/* Blank leading cells */}
            {Array.from({ length: startingDayOfWeek }).map((_, i) => (
              <div key={`blank-${i}`} className="bg-surface-subtle/40 p-2 min-h-[100px]" />
            ))}

            {/* Day Cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dayEvents = getEventsForDay(dayNum);
              const isToday =
                new Date().getDate() === dayNum &&
                new Date().getMonth() === month &&
                new Date().getFullYear() === year;

              return (
                <div
                  key={dayNum}
                  onClick={() => handleCellClick(dayNum)}
                  className={`p-2 min-h-[100px] hover:bg-surface-subtle/80 cursor-pointer transition-colors flex flex-col justify-between ${
                    isToday ? "bg-brass/10 font-bold" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs w-6 h-6 rounded-full flex items-center justify-center ${
                        isToday ? "bg-brass text-navy-900 font-bold" : "text-foreground font-semibold"
                      }`}
                    >
                      {dayNum}
                    </span>

                    {dayEvents.length > 0 && (
                      <span className="text-[10px] text-muted font-mono">{dayEvents.length} events</span>
                    )}
                  </div>

                  {/* Day Events Pills */}
                  <div className="space-y-1 mt-2">
                    {dayEvents.slice(0, 3).map((event) => (
                      <div
                        key={event.id}
                        className="text-[10px] truncate px-1.5 py-0.5 rounded text-white font-medium"
                        style={{ backgroundColor: event.color_code || "#C6A15B" }}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="text-[9px] text-muted block font-semibold">+ {dayEvents.length - 3} more</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Agenda View */
        <div className="bg-surface border border-border rounded-panel overflow-hidden shadow-sm">
          {events.length === 0 ? (
            <div className="p-8 text-center text-muted text-xs">No events scheduled.</div>
          ) : (
            <div className="divide-y divide-border">
              {events.map((event) => (
                <div key={event.id} className="p-4 hover:bg-surface-subtle transition-colors flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-10 rounded-full shrink-0"
                      style={{ backgroundColor: event.color_code || "#C6A15B" }}
                    />
                    <div>
                      <h3 className="font-semibold text-xs text-foreground">{event.title}</h3>
                      <p className="text-muted text-[11px] mt-0.5">{event.description || "No description"}</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-semibold block">{event.start_at.split("T")[0]}</span>
                    <span className="text-[10px] text-muted capitalize">{event.event_type}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Event Modal */}
      <AddEventModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        householdId={householdId}
        userId={userId}
        defaultDate={selectedDateStr}
        onSuccess={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
