"use client";

import * as React from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";

interface QuickTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  householdId: string;
  userId: string;
  onSuccess?: () => void;
}

const PRIORITIES = [
  { value: "medium", label: "Medium Priority" },
  { value: "high", label: "High Priority" },
  { value: "low", label: "Low Priority" },
];

export function QuickTaskModal({
  isOpen,
  onClose,
  householdId,
  userId,
  onSuccess,
}: QuickTaskModalProps) {
  const [title, setTitle] = React.useState("");
  const [dueDate, setDueDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [priority, setPriority] = React.useState<"low" | "medium" | "high">("medium");
  const [linkedLabel, setLinkedLabel] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const { showToast } = useToast();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);

    const { error } = await supabase.from("tasks").insert({
      user_id: userId,
      household_id: householdId,
      title: title.trim(),
      due_date: dueDate,
      priority,
      linked_label: linkedLabel.trim() || null,
      is_done: false,
    });

    setLoading(false);

    if (error) {
      showToast({ type: "error", title: "Error adding task", description: error.message });
      return;
    }

    showToast({
      type: "success",
      title: "Task created",
      description: `Task "${title}" added successfully.`,
    });

    setTitle("");
    setLinkedLabel("");
    onClose();
    onSuccess?.();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Task"
      subtitle="Create a financial to-do or reminder"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        <Input
          label="Task Description"
          placeholder="e.g. Pay electricity bill / Submit tax file"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          autoFocus
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Due Date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
          />

          <Select
            label="Priority"
            options={PRIORITIES}
            value={priority}
            onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high")}
          />
        </div>

        <Input
          label="Linked Amount / Tag (Optional)"
          placeholder="e.g. Rs 14,500"
          value={linkedLabel}
          onChange={(e) => setLinkedLabel(e.target.value)}
        />

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={loading}>
            Create Task
          </Button>
        </div>
      </form>
    </Modal>
  );
}
