"use client";

import * as React from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import type { EventType } from "@/lib/supabase/types";

interface AddEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  householdId: string;
  userId: string;
  defaultDate?: string;
  onSuccess?: () => void;
}

const EVENT_TYPES: { value: EventType; label: string; color: string }[] = [
  { value: "general", label: "General Event", color: "#C6A15B" },
  { value: "bill", label: "Bill / Utility Payment", color: "#d92b1f" },
  { value: "salary", label: "Salary / Income Credit", color: "#009639" },
  { value: "committee", label: "Committee (BC) Payout / Draw", color: "#00539b" },
  { value: "tax", label: "Tax / FBR Filing Deadline", color: "#1b4d2e" },
  { value: "holiday", label: "Holiday / National Event", color: "#00693e" },
  { value: "birthday", label: "Birthday / Family Occasion", color: "#e05a1c" },
];

export function AddEventModal({
  isOpen,
  onClose,
  householdId,
  userId,
  defaultDate,
  onSuccess,
}: AddEventModalProps) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [prevDefaultDate, setPrevDefaultDate] = React.useState(defaultDate || "");
  const [date, setDate] = React.useState(() => defaultDate || new Date().toISOString().split("T")[0]);
  const [time, setTime] = React.useState("10:00");
  const [isAllDay, setIsAllDay] = React.useState(true);
  const [eventType, setEventType] = React.useState<EventType>("general");
  const [loading, setLoading] = React.useState(false);

  const { showToast } = useToast();
  const supabase = createClient();

  if (defaultDate && defaultDate !== prevDefaultDate) {
    setPrevDefaultDate(defaultDate);
    setDate(defaultDate);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast({ type: "error", title: "Missing Title", description: "Please enter an event title." });
      return;
    }

    setLoading(true);

    const startDateTime = isAllDay
      ? `${date}T00:00:00.000Z`
      : `${date}T${time}:00.000Z`;

    const endDateTime = isAllDay
      ? `${date}T23:59:59.000Z`
      : `${date}T${time}:00.000Z`;

    const selectedTypeObj = EVENT_TYPES.find((t) => t.value === eventType);

    const { error } = await supabase.from("calendar_events").insert({
      household_id: householdId,
      user_id: userId,
      title: title.trim(),
      description: description.trim() || null,
      start_at: startDateTime,
      end_at: endDateTime,
      is_all_day: isAllDay,
      event_type: eventType,
      color_code: selectedTypeObj?.color || "#C6A15B",
    });

    setLoading(false);

    if (error) {
      showToast({ type: "error", title: "Failed to Add Event", description: error.message });
      return;
    }

    showToast({ type: "success", title: "Event Added", description: `"${title}" created on calendar.` });
    setTitle("");
    setDescription("");
    onClose();
    if (onSuccess) onSuccess();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Calendar Event">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Event Title"
          placeholder="e.g. K-Electric Bill Due, Family Dinner"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <Select
          label="Event Category"
          value={eventType}
          onChange={(e) => setEventType(e.target.value as EventType)}
          options={EVENT_TYPES.map((t) => ({ value: t.value, label: t.label }))}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />

          {!isAllDay && (
            <Input
              label="Time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          )}
        </div>

        <Toggle
          checked={isAllDay}
          onChange={setIsAllDay}
          label="All Day Event"
          description="Check if event has no specific hour"
        />

        <Input
          label="Description / Notes"
          placeholder="e.g. Remember to check meter reading"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="flex justify-end gap-3 pt-3 border-t border-border">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={loading}>
            Save Event
          </Button>
        </div>
      </form>
    </Modal>
  );
}
