"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Priority = "must" | "should" | "free";

type Task = {
  id: string;
  user_id: string;
  goal_id: string | null;
  title: string;
  description: string | null;
  category:
    | "fitness"
    | "learning"
    | "career"
    | "work"
    | "family"
    | "friends"
    | "hobby"
    | "personal"
    | "free";
  priority: Priority;
  duration_minutes: number;
  strict_mode: boolean;
  max_reminders_per_day: number;
  allow_snooze: boolean;
  status: string;
};

type Goal = {
  id: string;
  name: string;
  category: string;
  priority: Priority;
};

type Schedule = {
  id: string;
  task_id: string;
  user_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string | null;
  start_date: string | null;
  end_date: string | null;
  repeat_type: "once" | "daily" | "weekly";
  reminder_interval_minutes: number;
  is_active: boolean;
};

type CompletionStatus =
  | "pending"
  | "completed"
  | "skipped"
  | "snoozed"
  | "rescheduled";

type Completion = {
  id: string;
  task_id: string;
  user_id: string;
  scheduled_for: string;
  completed_at: string | null;
  status: CompletionStatus;
  snooze_until: string | null;
  notes: string | null;
};

type TodayTask = Task & {
  schedule: Schedule;
  completion: Completion | null;
};

function getTodayDayOfWeek() {
  return new Date().getDay();
}

function getTodayDateString() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);

  const date = new Date(year, month - 1, day);

  const weekday = date.toLocaleDateString("en-US", {
    weekday: "long",
  });

  const monthName = date.toLocaleDateString("en-US", {
    month: "short",
  });

  return `${weekday}, ${monthName} ${day}`;
}

function formatTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);

  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;

  return `${displayHour}:${String(minutes).padStart(2, "0")} ${period}`;
}

function getScheduledDateTime(dateString: string, time: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);

  const date = new Date(year, month - 1, day, hours, minutes, 0, 0);

  return date.toISOString();
}

function getCompletionLabel(completion: Completion | null) {
  if (!completion) {
    return "Pending";
  }

  switch (completion.status) {
    case "completed":
      return "Completed";
    case "skipped":
      return "Skipped";
    case "snoozed":
      return "Snoozed";
    case "rescheduled":
      return "Rescheduled";
    default:
      return "Pending";
  }
}

export default function HomePage() {
  const router = useRouter();

  const [tasks, setTasks] = useState<TodayTask[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");

  const [showAddTask, setShowAddTask] = useState(false);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskCategory, setNewTaskCategory] = useState<Task["category"]>(
    "personal"
  );
  const [newTaskPriority, setNewTaskPriority] =
    useState<Priority>("should");
  const [newTaskDuration, setNewTaskDuration] = useState(30);
  const [newTaskTime, setNewTaskTime] = useState("20:00");

  const [showFreeTime, setShowFreeTime] = useState(false);
  const [freeMinutes, setFreeMinutes] = useState(30);

  const [freeSuggestion, setFreeSuggestion] =
    useState<TodayTask | null>(null);

  const [rejectedSuggestions, setRejectedSuggestions] = useState<string[]>(
    []
  );

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const todayDate = getTodayDateString();
  const todayDay = getTodayDayOfWeek();

  async function loadToday() {
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setUserEmail(user.email ?? "");

      const [
        { data: taskData, error: taskError },
        { data: scheduleData, error: scheduleError },
        { data: completionData, error: completionError },
        { data: goalData, error: goalError },
      ] = await Promise.all([
        supabase
          .from("tasks")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "active"),

        supabase
          .from("task_schedules")
          .select("*")
          .eq("user_id", user.id)
          .eq("day_of_week", todayDay)
          .eq("is_active", true),

        supabase
          .from("task_completions")
          .select("*")
          .eq("user_id", user.id)
          .gte("scheduled_for", `${todayDate}T00:00:00`)
          .lt("scheduled_for", `${todayDate}T23:59:59.999Z`),

        supabase
          .from("goals")
          .select("id,name,category,priority")
          .eq("user_id", user.id)
          .eq("status", "active"),
      ]);

      if (taskError) throw taskError;
      if (scheduleError) throw scheduleError;
      if (completionError) throw completionError;
      if (goalError) throw goalError;

      const schedules = (scheduleData ?? []) as Schedule[];
      const allTasks = (taskData ?? []) as Task[];
      const completions = (completionData ?? []) as Completion[];

      const taskMap = new Map(allTasks.map((task) => [task.id, task]));

      const completionMap = new Map<string, Completion>();

      for (const completion of completions) {
        completionMap.set(completion.task_id, completion);
      }

      const todayTasks: TodayTask[] = [];

      for (const schedule of schedules) {
        const task = taskMap.get(schedule.task_id);

        if (!task) continue;

        if (schedule.start_date && todayDate < schedule.start_date) {
          continue;
        }

        if (schedule.end_date && todayDate > schedule.end_date) {
          continue;
        }

        todayTasks.push({
          ...task,
          schedule,
          completion: completionMap.get(task.id) ?? null,
        });
      }

      todayTasks.sort((a, b) => {
        return a.schedule.start_time.localeCompare(
          b.schedule.start_time
        );
      });

      setTasks(todayTasks);
      setGoals((goalData ?? []) as Goal[]);
    } catch (error) {
      console.error("Failed to load today's tasks:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadToday();
  }, []);

  const goalMap = useMemo(() => {
    return new Map(goals.map((goal) => [goal.id, goal]));
  }, [goals]);

  const groupedTasks = useMemo(() => {
    return {
      must: tasks.filter((task) => task.priority === "must"),
      should: tasks.filter((task) => task.priority === "should"),
      free: tasks.filter((task) => task.priority === "free"),
    };
  }, [tasks]);

  const completedCount = tasks.filter(
    (task) => task.completion?.status === "completed"
  ).length;

  const skippedCount = tasks.filter(
    (task) => task.completion?.status === "skipped"
  ).length;

  const progressPercent =
    tasks.length === 0
      ? 0
      : Math.round((completedCount / tasks.length) * 100);

  async function completeTask(task: TodayTask) {
    setActionLoading(task.id);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const scheduledFor = getScheduledDateTime(
        todayDate,
        task.schedule.start_time
      );

      if (task.completion) {
        await supabase
          .from("task_completions")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            snooze_until: null,
          })
          .eq("id", task.completion.id);
      } else {
        await supabase.from("task_completions").insert({
          task_id: task.id,
          user_id: user.id,
          scheduled_for: scheduledFor,
          completed_at: new Date().toISOString(),
          status: "completed",
        });
      }

      await loadToday();
    } catch (error) {
      console.error("Failed to complete task:", error);
    } finally {
      setActionLoading(null);
    }
  }

  async function skipTask(task: TodayTask) {
    setActionLoading(task.id);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const scheduledFor = getScheduledDateTime(
        todayDate,
        task.schedule.start_time
      );

      if (task.completion) {
        await supabase
          .from("task_completions")
          .update({
            status: "skipped",
            completed_at: null,
            snooze_until: null,
          })
          .eq("id", task.completion.id);
      } else {
        await supabase.from("task_completions").insert({
          task_id: task.id,
          user_id: user.id,
          scheduled_for: scheduledFor,
          status: "skipped",
        });
      }

      await loadToday();
    } catch (error) {
      console.error("Failed to skip task:", error);
    } finally {
      setActionLoading(null);
    }
  }

  async function snoozeTask(task: TodayTask, minutes = 30) {
    setActionLoading(task.id);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const scheduledFor = getScheduledDateTime(
        todayDate,
        task.schedule.start_time
      );

      const snoozeUntil = new Date(
        Date.now() + minutes * 60 * 1000
      ).toISOString();

      if (task.completion) {
        await supabase
          .from("task_completions")
          .update({
            status: "snoozed",
            snooze_until: snoozeUntil,
          })
          .eq("id", task.completion.id);
      } else {
        await supabase.from("task_completions").insert({
          task_id: task.id,
          user_id: user.id,
          scheduled_for: scheduledFor,
          status: "snoozed",
          snooze_until: snoozeUntil,
        });
      }

      await loadToday();
    } catch (error) {
      console.error("Failed to snooze task:", error);
    } finally {
      setActionLoading(null);
    }
  }

  async function rescheduleTask(task: TodayTask) {
    setActionLoading(task.id);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const newTime = prompt(
        "Enter the new time in 24-hour format, for example 21:30"
      );

      if (!newTime) return;

      if (!/^\d{2}:\d{2}$/.test(newTime)) {
        alert("Please enter time in HH:MM format.");
        return;
      }

      const [hours, minutes] = newTime.split(":").map(Number);

      if (
        Number.isNaN(hours) ||
        Number.isNaN(minutes) ||
        hours > 23 ||
        minutes > 59
      ) {
        alert("Invalid time.");
        return;
      }

      const newScheduledFor = getScheduledDateTime(
        todayDate,
        newTime
      );

      if (task.completion) {
        await supabase
          .from("task_completions")
          .update({
            status: "rescheduled",
            scheduled_for: newScheduledFor,
            snooze_until: null,
          })
          .eq("id", task.completion.id);
      } else {
        await supabase.from("task_completions").insert({
          task_id: task.id,
          user_id: user.id,
          scheduled_for: newScheduledFor,
          status: "rescheduled",
        });
      }

      await loadToday();
    } catch (error) {
      console.error("Failed to reschedule task:", error);
    } finally {
      setActionLoading(null);
    }
  }

  function getFreeTimeSuggestion(minutes: number) {
    const available = tasks.filter((task) => {
      const status = task.completion?.status;

      if (status === "completed" || status === "skipped") {
        return false;
      }

      if (rejectedSuggestions.includes(task.id)) {
        return false;
      }

      return task.duration_minutes <= minutes;
    });

    const priorityOrder: Record<Priority, number> = {
      must: 0,
      should: 1,
      free: 2,
    };

    available.sort((a, b) => {
      const priorityDifference =
        priorityOrder[a.priority] - priorityOrder[b.priority];

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      return a.duration_minutes - b.duration_minutes;
    });

    return available[0] ?? null;
  }

  function rejectFreeSuggestion() {
    if (!freeSuggestion) return;

    setRejectedSuggestions((current) => [
      ...current,
      freeSuggestion.id,
    ]);

    setFreeSuggestion(
      getFreeTimeSuggestion(freeMinutes)
    );
  }

  function startFreeSuggestion() {
    if (!freeSuggestion) return;

    const element = document.getElementById(
      `task-${freeSuggestion.id}`
    );

    setShowFreeTime(false);

    setTimeout(() => {
      element?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 100);
  }

  function resetFreeTime() {
    setFreeMinutes(30);
    setFreeSuggestion(null);
    setRejectedSuggestions([]);
  }

  function openFreeTime(minutes: number) {
    setFreeMinutes(minutes);

    const suggestion = getFreeTimeSuggestion(minutes);

    setFreeSuggestion(suggestion);
    setShowFreeTime(true);
  }

  async function addTask() {
    if (!newTaskTitle.trim()) {
      alert("Please enter a task title.");
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: task, error: taskError } = await supabase
        .from("tasks")
        .insert({
          user_id: user.id,
          title: newTaskTitle.trim(),
          description: newTaskDescription.trim() || null,
          category: newTaskCategory,
          priority: newTaskPriority,
          duration_minutes: newTaskDuration,
          strict_mode: false,
          max_reminders_per_day: 1,
          allow_snooze: true,
          status: "active",
        })
        .select()
        .single();

      if (taskError) throw taskError;

      const { error: scheduleError } = await supabase
        .from("task_schedules")
        .insert({
          task_id: task.id,
          user_id: user.id,
          day_of_week: todayDay,
          start_time: newTaskTime,
          end_time: null,
          start_date: todayDate,
          end_date: null,
          repeat_type: "weekly",
          reminder_interval_minutes: 0,
          is_active: true,
        });

      if (scheduleError) throw scheduleError;

      setNewTaskTitle("");
      setNewTaskDescription("");
      setNewTaskCategory("personal");
      setNewTaskPriority("should");
      setNewTaskDuration(30);
      setNewTaskTime("20:00");
      setShowAddTask(false);

      await loadToday();
    } catch (error) {
      console.error("Failed to add task:", error);
      alert("Failed to add task.");
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function renderTaskCard(task: TodayTask) {
    const goal = task.goal_id
      ? goalMap.get(task.goal_id)
      : null;

    const status = task.completion?.status ?? "pending";

    const isCompleted = status === "completed";
    const isSkipped = status === "skipped";

    return (
      <div
        id={`task-${task.id}`}
        key={task.id}
        className={`rounded-2xl border p-4 transition ${
          isCompleted
            ? "border-emerald-500/30 bg-emerald-500/5"
            : isSkipped
            ? "border-zinc-800 bg-zinc-950/40 opacity-60"
            : "border-zinc-800 bg-zinc-900"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-white">
                {task.title}
              </h3>

              <span
                className={`rounded-full px-2 py-1 text-xs ${
                  task.priority === "must"
                    ? "bg-red-500/10 text-red-400"
                    : task.priority === "should"
                    ? "bg-yellow-500/10 text-yellow-400"
                    : "bg-blue-500/10 text-blue-400"
                }`}
              >
                {task.priority === "must"
                  ? "Must Do"
                  : task.priority === "should"
                  ? "Should Do"
                  : "Free"}
              </span>
            </div>

            {task.description && (
              <p className="mt-2 text-sm text-zinc-400">
                {task.description}
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500">
              <span>
                🕐 {formatTime(task.schedule.start_time)}
              </span>

              <span>
                ⏱ {task.duration_minutes} min
              </span>

              <span>
                {task.category}
              </span>

              {goal && <span>🎯 {goal.name}</span>}
            </div>
          </div>

          <div className="shrink-0">
            <span className="text-xs text-zinc-500">
              {getCompletionLabel(task.completion)}
            </span>
          </div>
        </div>

        {!isCompleted && !isSkipped && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              disabled={actionLoading === task.id}
              onClick={() => completeTask(task)}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              ✓ Complete
            </button>

            <button
              disabled={actionLoading === task.id}
              onClick={() => snoozeTask(task)}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
            >
              Snooze 30m
            </button>

            <button
              disabled={actionLoading === task.id}
              onClick={() => rescheduleTask(task)}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
            >
              Reschedule
            </button>

            <button
              disabled={actionLoading === task.id}
              onClick={() => skipTask(task)}
              className="rounded-lg border border-zinc-800 px-3 py-2 text-xs font-medium text-zinc-500 hover:bg-zinc-800 disabled:opacity-50"
            >
              Skip
            </button>
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-10 text-white">
        <div className="mx-auto max-w-5xl">
          <p className="text-zinc-400">
            Loading DisciplineTracker...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="flex flex-col gap-4 border-b border-zinc-800 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-zinc-500">
              DisciplineTracker
            </p>

            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
              Today
            </h1>

            <p className="mt-1 text-sm text-zinc-400">
              {formatDate(todayDate)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => router.push("/notifications")}
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
            >
              🔔 Reminders
            </button>

            <button
              onClick={() => router.push("/goals")}
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
            >
              🎯 Goals
            </button>

            <button
              onClick={() => router.push("/ccna")}
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800"
            >
              📚 CCNA
            </button>

            <button
              onClick={signOut}
              className="rounded-xl border border-zinc-800 px-4 py-2.5 text-sm text-zinc-500 transition hover:bg-zinc-900 hover:text-white"
            >
              Sign out
            </button>
          </div>
        </header>

        {/* Summary */}
        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs text-zinc-500">
              Progress
            </p>
            <p className="mt-2 text-2xl font-bold">
              {progressPercent}%
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs text-zinc-500">
              Completed
            </p>
            <p className="mt-2 text-2xl font-bold text-emerald-400">
              {completedCount}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs text-zinc-500">
              Skipped
            </p>
            <p className="mt-2 text-2xl font-bold text-zinc-400">
              {skippedCount}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs text-zinc-500">
              Tasks
            </p>
            <p className="mt-2 text-2xl font-bold">
              {tasks.length}
            </p>
          </div>
        </section>

        {/* Main actions */}
        <section className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() => setShowAddTask(true)}
            className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-indigo-500"
          >
            + Add Task
          </button>

          <button
            onClick={() => openFreeTime(15)}
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800"
          >
            I'm Free
          </button>

          <button
            onClick={() => router.push("/notifications")}
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800"
          >
            🔔 Reminders
          </button>
        </section>

        {/* Progress bar */}
        <section className="mt-6">
          <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all"
              style={{
                width: `${progressPercent}%`,
              }}
            />
          </div>
        </section>

        {/* Tasks */}
        <section className="mt-8 space-y-8">
          {(["must", "should", "free"] as Priority[]).map(
            (priority) => {
              const priorityTasks = groupedTasks[priority];

              if (priorityTasks.length === 0) {
                return null;
              }

              const title =
                priority === "must"
                  ? "Must Do"
                  : priority === "should"
                  ? "Should Do"
                  : "Free";

              return (
                <div key={priority}>
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">
                      {title}
                    </h2>

                    <span className="text-xs text-zinc-500">
                      {priorityTasks.length} task
                      {priorityTasks.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {priorityTasks.map(renderTaskCard)}
                  </div>
                </div>
              );
            }
          )}

          {tasks.length === 0 && (
            <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/50 p-8 text-center">
              <p className="text-zinc-300">
                No scheduled tasks for today.
              </p>

              <p className="mt-2 text-sm text-zinc-500">
                Use Add Task to create something for today.
              </p>
            </div>
          )}
        </section>

        {/* Add Task Modal */}
        {showAddTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                  Add Task
                </h2>

                <button
                  onClick={() => setShowAddTask(false)}
                  className="text-zinc-500 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-2 block text-sm text-zinc-400">
                    Task title
                  </label>

                  <input
                    value={newTaskTitle}
                    onChange={(event) =>
                      setNewTaskTitle(event.target.value)
                    }
                    placeholder="e.g. Communication practice"
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-zinc-400">
                    Description
                  </label>

                  <textarea
                    value={newTaskDescription}
                    onChange={(event) =>
                      setNewTaskDescription(event.target.value)
                    }
                    placeholder="Optional description"
                    rows={3}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-2 block text-sm text-zinc-400">
                      Category
                    </label>

                    <select
                      value={newTaskCategory}
                      onChange={(event) =>
                        setNewTaskCategory(
                          event.target.value as Task["category"]
                        )
                      }
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none"
                    >
                      <option value="fitness">Fitness</option>
                      <option value="learning">Learning</option>
                      <option value="career">Career</option>
                      <option value="work">Work</option>
                      <option value="family">Family</option>
                      <option value="friends">Friends</option>
                      <option value="hobby">Hobby</option>
                      <option value="personal">Personal</option>
                      <option value="free">Free</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm text-zinc-400">
                      Priority
                    </label>

                    <select
                      value={newTaskPriority}
                      onChange={(event) =>
                        setNewTaskPriority(
                          event.target.value as Priority
                        )
                      }
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none"
                    >
                      <option value="must">Must Do</option>
                      <option value="should">Should Do</option>
                      <option value="free">Free</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-2 block text-sm text-zinc-400">
                      Duration
                    </label>

                    <select
                      value={newTaskDuration}
                      onChange={(event) =>
                        setNewTaskDuration(
                          Number(event.target.value)
                        )
                      }
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none"
                    >
                      <option value={15}>15 min</option>
                      <option value={30}>30 min</option>
                      <option value={45}>45 min</option>
                      <option value={60}>60 min</option>
                      <option value={90}>90 min</option>
                      <option value={120}>120 min</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm text-zinc-400">
                      Time
                    </label>

                    <input
                      type="time"
                      value={newTaskTime}
                      onChange={(event) =>
                        setNewTaskTime(event.target.value)
                      }
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-white outline-none"
                    />
                  </div>
                </div>

                <button
                  onClick={addTask}
                  className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-500"
                >
                  Create Task
                </button>
              </div>
            </div>
          </div>
        )}

        {/* I'm Free Modal */}
        {showFreeTime && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                  I'm Free
                </h2>

                <button
                  onClick={() => {
                    setShowFreeTime(false);
                    resetFreeTime();
                  }}
                  className="text-zinc-500 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <p className="mt-2 text-sm text-zinc-400">
                How much free time do you have?
              </p>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {[15, 30, 60].map((minutes) => (
                  <button
                    key={minutes}
                    onClick={() => openFreeTime(minutes)}
                    className={`rounded-xl border px-3 py-3 text-sm ${
                      freeMinutes === minutes
                        ? "border-indigo-500 bg-indigo-500/10 text-indigo-300"
                        : "border-zinc-700 bg-zinc-950 text-zinc-300"
                    }`}
                  >
                    {minutes} min
                  </button>
                ))}
              </div>

              {freeSuggestion ? (
                <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                  <p className="text-xs text-zinc-500">
                    Suggested task
                  </p>

                  <h3 className="mt-2 font-semibold text-white">
                    {freeSuggestion.title}
                  </h3>

                  {freeSuggestion.description && (
                    <p className="mt-2 text-sm text-zinc-400">
                      {freeSuggestion.description}
                    </p>
                  )}

                  <p className="mt-3 text-xs text-zinc-500">
                    {freeSuggestion.duration_minutes} minutes ·{" "}
                    {freeSuggestion.priority === "must"
                      ? "Must Do"
                      : freeSuggestion.priority === "should"
                      ? "Should Do"
                      : "Free"}
                  </p>

                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={startFreeSuggestion}
                      className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-medium text-white hover:bg-indigo-500"
                    >
                      Start
                    </button>

                    <button
                      onClick={rejectFreeSuggestion}
                      className="rounded-xl border border-zinc-700 px-4 py-3 text-sm text-zinc-300 hover:bg-zinc-800"
                    >
                      Another
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-6 rounded-2xl border border-dashed border-zinc-800 p-5 text-center">
                  <p className="text-zinc-300">
                    Nothing suitable right now.
                  </p>

                  <p className="mt-2 text-sm text-zinc-500">
                    You can use this time for family, friends,
                    rest, or something spontaneous.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 border-t border-zinc-900 py-6 text-center">
          <p className="text-xs text-zinc-600">
            {userEmail}
          </p>
        </footer>
      </div>
    </main>
  );
}
