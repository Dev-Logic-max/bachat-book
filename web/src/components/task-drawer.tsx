"use client";

import * as React from "react";
import { X, Trash2, CheckSquare, Square, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import type { Tables, TaskPriority, TaskStatus } from "@/lib/supabase/types";

interface TaskDrawerProps {
  task: Tables<"tasks"> | null;
  onClose: () => void;
  onUpdate?: () => void;
}

export function TaskDrawer({ task, onClose, onUpdate }: TaskDrawerProps) {
  const supabase = createClient();
  const { showToast } = useToast();

  const [prevTaskId, setPrevTaskId] = React.useState<string | null>(task?.id || null);
  const [title, setTitle] = React.useState(task?.title || "");
  const [description, setDescription] = React.useState(task?.description || "");
  const [status, setStatus] = React.useState<TaskStatus>(task?.status || "todo");
  const [priority, setPriority] = React.useState<TaskPriority>(task?.priority || "medium");
  const [dueDate, setDueDate] = React.useState(task?.due_date || "");
  const [linkedLabel, setLinkedLabel] = React.useState(task?.linked_label || "");

  const [checklistItems, setChecklistItems] = React.useState<Tables<"task_checklist_items">[]>([]);
  const [newItemTitle, setNewItemTitle] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  if (task && task.id !== prevTaskId) {
    setPrevTaskId(task.id);
    setTitle(task.title || "");
    setDescription(task.description || "");
    setStatus(task.status || "todo");
    setPriority(task.priority || "medium");
    setDueDate(task.due_date || "");
    setLinkedLabel(task.linked_label || "");
  }

  React.useEffect(() => {
    let active = true;
    if (!task) return;
    const taskId = task.id;

    async function loadChecklist() {
      const { data } = await supabase
        .from("task_checklist_items")
        .select("*")
        .eq("task_id", taskId)
        .order("sort_order", { ascending: true });

      if (active && data) {
        setChecklistItems(data);
      }
    }

    loadChecklist();
    return () => {
      active = false;
    };
  }, [task, supabase]);

  if (!task) return null;

  const handleSave = async () => {
    if (!title.trim()) return;
    setLoading(true);

    const { error } = await supabase
      .from("tasks")
      .update({
        title: title.trim(),
        description: description.trim() || null,
        status,
        priority,
        due_date: dueDate,
        is_done: status === "done",
        linked_label: linkedLabel.trim() || null,
      })
      .eq("id", task.id);

    setLoading(false);

    if (error) {
      showToast({ type: "error", title: "Update Failed", description: error.message });
      return;
    }

    showToast({ type: "success", title: "Task Saved", description: "Task updated successfully." });
    onClose();
    if (onUpdate) onUpdate();
  };

  const handleAddChecklistItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemTitle.trim()) return;

    const { data: item, error } = await supabase
      .from("task_checklist_items")
      .insert({
        task_id: task.id,
        title: newItemTitle.trim(),
        is_done: false,
        sort_order: checklistItems.length + 1,
      })
      .select()
      .single();

    if (error || !item) {
      showToast({ type: "error", title: "Could not add item", description: error?.message });
      return;
    }

    setChecklistItems([...checklistItems, item]);
    setNewItemTitle("");
  };

  const handleToggleChecklistItem = async (item: Tables<"task_checklist_items">) => {
    const nextDone = !item.is_done;
    setChecklistItems(
      checklistItems.map((ci) => (ci.id === item.id ? { ...ci, is_done: nextDone } : ci))
    );

    await supabase
      .from("task_checklist_items")
      .update({ is_done: nextDone })
      .eq("id", item.id);
  };

  const handleDeleteChecklistItem = async (id: string) => {
    setChecklistItems(checklistItems.filter((ci) => ci.id !== id));
    await supabase.from("task_checklist_items").delete().eq("id", id);
  };

  const handleDeleteTask = async () => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    setLoading(true);
    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    setLoading(false);

    if (error) {
      showToast({ type: "error", title: "Delete Failed", description: error.message });
      return;
    }

    showToast({ type: "success", title: "Task Deleted", description: "Task removed." });
    onClose();
    if (onUpdate) onUpdate();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-navy-950/60 backdrop-blur-xs flex justify-end">
      <div className="bg-surface border-l border-border w-full max-w-md h-full overflow-y-auto p-6 shadow-2xl flex flex-col justify-between">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <h2 className="font-display text-lg font-bold">Edit Task</h2>
            <button onClick={onClose} className="p-1 text-muted hover:text-foreground rounded-full">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4 my-4">
            <Input
              label="Task Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Status"
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                options={[
                  { value: "todo", label: "To Do" },
                  { value: "in_progress", label: "In Progress" },
                  { value: "done", label: "Completed" },
                ]}
              />

              <Select
                label="Priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                options={[
                  { value: "high", label: "High Priority" },
                  { value: "medium", label: "Medium Priority" },
                  { value: "low", label: "Low Priority" },
                ]}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Due Date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />

              <Input
                label="Linked Tag / Module"
                placeholder="e.g. Bills, FBR Tax"
                value={linkedLabel}
                onChange={(e) => setLinkedLabel(e.target.value)}
              />
            </div>

            <Input
              label="Description / Notes"
              placeholder="e.g. Remember to check invoice number"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            {/* Checklist Section */}
            <div className="pt-4 border-t border-border space-y-3">
              <span className="font-display text-xs font-semibold block">Sub-Item Checklist</span>

              <div className="space-y-2">
                {checklistItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2 rounded-control bg-surface-subtle border border-border text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleChecklistItem(item)}
                      className="flex items-center gap-2 text-left text-foreground hover:opacity-80"
                    >
                      {item.is_done ? (
                        <CheckSquare size={16} className="text-gain shrink-0" />
                      ) : (
                        <Square size={16} className="text-muted shrink-0" />
                      )}
                      <span className={item.is_done ? "line-through text-muted" : "font-medium"}>
                        {item.title}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteChecklistItem(item.id)}
                      className="text-muted hover:text-loss p-1"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Sub-Item Input */}
              <form onSubmit={handleAddChecklistItem} className="flex gap-2">
                <Input
                  placeholder="Add sub-checklist item..."
                  value={newItemTitle}
                  onChange={(e) => setNewItemTitle(e.target.value)}
                  className="text-xs"
                />
                <Button type="submit" variant="secondary" className="shrink-0 text-xs">
                  <Plus size={14} />
                </Button>
              </form>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-6 border-t border-border flex items-center justify-between gap-3">
          <Button type="button" variant="ghost" onClick={handleDeleteTask} className="text-loss hover:bg-loss-subtle">
            <Trash2 size={16} />
            <span>Delete</span>
          </Button>

          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" variant="primary" onClick={handleSave} isLoading={loading}>
              Save Task
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
