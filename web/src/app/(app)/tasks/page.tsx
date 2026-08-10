"use client";

import * as React from "react";
import { Plus, ListChecks, Kanban, CheckCircle2, Clock, CheckSquare } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { QuickTaskModal } from "@/components/quick-task-modal";
import { TaskDrawer } from "@/components/task-drawer";
import { createClient } from "@/lib/supabase/client";
import type { Tables, TaskStatus, TaskPriority } from "@/lib/supabase/types";

type TaskWithChecklist = Tables<"tasks"> & {
  task_checklist_items?: Tables<"task_checklist_items">[];
};

type ViewMode = "kanban" | "list";

export default function TasksPage() {
  const session = useSession();
  const supabase = createClient();

  const householdId = session.household?.id || "";
  const userId = session.user.id;

  const [tasks, setTasks] = React.useState<TaskWithChecklist[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [viewMode, setViewMode] = React.useState<ViewMode>("kanban");

  const [addModalOpen, setAddModalOpen] = React.useState(false);
  const [activeTask, setActiveTask] = React.useState<Tables<"tasks"> | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    let active = true;
    if (!householdId) return;

    async function loadTasks() {
      const { data } = await supabase
        .from("tasks")
        .select("*, task_checklist_items(*)")
        .eq("household_id", householdId)
        .order("due_date", { ascending: true });

      if (active && data) {
        setTasks(data as unknown as TaskWithChecklist[]);
        setLoading(false);
      }
    }

    loadTasks();
    return () => {
      active = false;
    };
  }, [householdId, refreshKey, supabase]);

  const reloadData = () => setRefreshKey((k) => k + 1);

  const todoTasks = tasks.filter((t) => (t.status || (t.is_done ? "done" : "todo")) === "todo");
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress");
  const doneTasks = tasks.filter((t) => t.status === "done" || t.is_done);

  const handleUpdateStatus = async (task: TaskWithChecklist, newStatus: TaskStatus) => {
    setTasks(
      tasks.map((t) => (t.id === task.id ? { ...t, status: newStatus, is_done: newStatus === "done" } : t))
    );

    await supabase
      .from("tasks")
      .update({ status: newStatus, is_done: newStatus === "done" })
      .eq("id", task.id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Task Board & Financial To-Dos</h1>
          <p className="text-muted text-xs">
            Manage household chores, bill payments, and financial deadlines.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {/* View Mode Switcher */}
          <div className="bg-surface border border-border rounded-control p-1 flex items-center gap-1 text-xs">
            <button
              onClick={() => setViewMode("kanban")}
              className={`px-3 py-1 rounded-control font-semibold flex items-center gap-1.5 transition-colors ${
                viewMode === "kanban"
                  ? "bg-navy-900 text-on-navy dark:bg-brass dark:text-navy-900"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <Kanban size={14} />
              <span>Board</span>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1 rounded-control font-semibold flex items-center gap-1.5 transition-colors ${
                viewMode === "list"
                  ? "bg-navy-900 text-on-navy dark:bg-brass dark:text-navy-900"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <ListChecks size={14} />
              <span>List</span>
            </button>
          </div>

          <Button variant="primary" onClick={() => setAddModalOpen(true)} className="flex items-center gap-1.5">
            <Plus size={16} />
            <span>Add Task</span>
          </Button>
        </div>
      </div>

      {/* Main View */}
      {loading ? (
        <div className="bg-surface border-border rounded-panel border p-8 text-center text-muted text-xs">
          Loading task board...
        </div>
      ) : viewMode === "kanban" ? (
        /* Kanban Board Columns */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* To Do Column */}
          <KanbanColumn
            title="To Do"
            tasks={todoTasks}
            status="todo"
            badgeColor="bg-muted/20 text-muted-foreground"
            onTaskClick={setActiveTask}
            onStatusChange={handleUpdateStatus}
          />

          {/* In Progress Column */}
          <KanbanColumn
            title="In Progress"
            tasks={inProgressTasks}
            status="in_progress"
            badgeColor="bg-brass/20 text-brass-strong"
            onTaskClick={setActiveTask}
            onStatusChange={handleUpdateStatus}
          />

          {/* Done Column */}
          <KanbanColumn
            title="Completed"
            tasks={doneTasks}
            status="done"
            badgeColor="bg-gain-subtle text-gain"
            onTaskClick={setActiveTask}
            onStatusChange={handleUpdateStatus}
          />
        </div>
      ) : (
        /* List View */
        <div className="bg-surface border border-border rounded-panel overflow-hidden shadow-sm divide-y divide-border">
          {tasks.map((task) => (
            <div
              key={task.id}
              onClick={() => setActiveTask(task)}
              className="p-4 hover:bg-surface-subtle cursor-pointer transition-colors flex items-center justify-between gap-4 text-xs"
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUpdateStatus(task, task.status === "done" ? "todo" : "done");
                  }}
                  className="text-muted hover:text-gain transition-colors"
                >
                  <CheckCircle2
                    size={18}
                    className={task.status === "done" || task.is_done ? "text-gain fill-gain/20" : "text-muted"}
                  />
                </button>

                <div>
                  <h4 className={`font-semibold ${task.status === "done" || task.is_done ? "line-through text-muted" : "text-foreground"}`}>
                    {task.title}
                  </h4>
                  <p className="text-muted text-[11px] mt-0.5">{task.description || "No description"}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {task.linked_label && (
                  <span className="bg-surface-subtle border border-border text-muted px-2 py-0.5 rounded-full text-[10px] font-medium">
                    {task.linked_label}
                  </span>
                )}

                <PriorityBadge priority={task.priority} />

                <span className="text-muted text-[11px] font-mono">{task.due_date}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Add Task Modal */}
      <QuickTaskModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        householdId={householdId}
        userId={userId}
        onSuccess={reloadData}
      />

      {/* Task Drawer */}
      <TaskDrawer
        task={activeTask}
        onClose={() => setActiveTask(null)}
        onUpdate={reloadData}
      />
    </div>
  );
}

function KanbanColumn({
  title,
  tasks,
  status,
  badgeColor,
  onTaskClick,
  onStatusChange,
}: {
  title: string;
  tasks: TaskWithChecklist[];
  status: TaskStatus;
  badgeColor: string;
  onTaskClick: (task: TaskWithChecklist) => void;
  onStatusChange: (task: TaskWithChecklist, newStatus: TaskStatus) => void;
}) {
  return (
    <div className="bg-surface-subtle border border-border rounded-panel p-4 space-y-3 min-h-[450px] flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-sm font-bold">{title}</h3>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${badgeColor}`}>
              {tasks.length}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {tasks.map((task) => {
            const checklist = task.task_checklist_items || [];
            const doneCount = checklist.filter((ci) => ci.is_done).length;

            return (
              <div
                key={task.id}
                onClick={() => onTaskClick(task)}
                className="bg-surface border border-border rounded-panel p-4 shadow-xs hover:shadow-md cursor-pointer transition-all space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-semibold text-xs line-clamp-2 text-foreground">{task.title}</h4>
                  <PriorityBadge priority={task.priority} />
                </div>

                {task.description && (
                  <p className="text-muted text-[11px] line-clamp-2">{task.description}</p>
                )}

                {/* Sub-Checklist Progress */}
                {checklist.length > 0 && (
                  <div className="flex items-center gap-1.5 text-[11px] text-muted font-mono pt-1">
                    <CheckSquare size={12} className="text-brass" />
                    <span>
                      {doneCount}/{checklist.length} items
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-border/60 text-[10px] text-muted">
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    <span>{task.due_date}</span>
                  </span>

                  {task.linked_label && (
                    <span className="bg-surface-subtle text-foreground border border-border px-2 py-0.5 rounded-full font-medium">
                      {task.linked_label}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const colors = {
    high: "bg-loss-subtle text-loss border-loss/20",
    medium: "bg-brass/10 text-brass-strong border-brass/20",
    low: "bg-surface-subtle text-muted border-border",
  };

  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${colors[priority]}`}>
      {priority}
    </span>
  );
}
