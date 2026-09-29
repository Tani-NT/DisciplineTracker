"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Goal = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  priority: "must" | "should" | "free";
  target_date: string | null;
  status: string;
  progress_percent: number | null;
};

type Task = {
  id: string;
  title: string;
  goal_id: string | null;
  duration_minutes: number;
  status: string;
};

type Completion = {
  id: string;
  task_id: string;
  scheduled_for: string;
  status: string;
  completed_at: string | null;
};

type GoalStats = {
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  weeklyTarget: number;
  linkedTasks: Task[];
};

const categoryLabels: Record<string, string> = {
  fitness: "Fitness",
  learning: "Learning",
  career: "Career",
  hobby: "Hobby",
  personal: "Personal",
};

const priorityLabels: Record<string, string> = {
  must: "Must Do",
  should: "Should Do",
  free: "Free",
};

const categoryIcons: Record<string, string> = {
  fitness: "🏋️",
  learning: "📚",
  career: "💼",
  hobby: "🛹",
  personal: "❤️",
};

function getTodayDateString() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getWeekStart(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);

  const date = new Date(year, month - 1, day);
  const dayOfWeek = date.getDay();

  date.setDate(date.getDate() - dayOfWeek);

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function getWeekEnd(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);

  const date = new Date(year, month - 1, day);
  const dayOfWeek = date.getDay();

  date.setDate(date.getDate() + (6 - dayOfWeek));

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function formatTargetDate(dateString: string | null) {
  if (!dateString) {
    return "No target date";
  }

  const [year, month, day] = dateString.split("-").map(Number);

  const date = new Date(year, month - 1, day);

  const monthName = date.toLocaleDateString("en-US", {
    month: "short",
  });

  return `${monthName} ${day}, ${year}`;
}

function getDaysRemaining(dateString: string | null) {
  if (!dateString) {
    return null;
  }

  const today = new Date();
  const target = new Date(`${dateString}T00:00:00`);

  today.setHours(0, 0, 0, 0);

  const difference =
    target.getTime() - today.getTime();

  return Math.ceil(
    difference / (1000 * 60 * 60 * 24)
  );
}

function getProgressColor(category: string) {
  switch (category) {
    case "fitness":
      return "from-emerald-400 to-green-500";

    case "learning":
      return "from-blue-400 to-indigo-500";

    case "career":
      return "from-purple-400 to-violet-500";

    case "hobby":
      return "from-orange-400 to-amber-500";

    case "personal":
      return "from-pink-400 to-rose-500";

    default:
      return "from-cyan-400 to-blue-500";
  }
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadGoals() {
    setLoading(true);
    setError("");

    try {
      const today = getTodayDateString();
      const weekStart = getWeekStart(today);
      const weekEnd = getWeekEnd(today);

      const weekStartTimestamp =
        `${weekStart}T00:00:00`;

      const weekEndTimestamp =
        `${weekEnd}T23:59:59.999`;

      const [
        goalsResult,
        tasksResult,
        completionsResult,
      ] = await Promise.all([
        supabase
          .from("goals")
          .select(
            `
              id,
              name,
              description,
              category,
              priority,
              target_date,
              status,
              progress_percent
            `
          )
          .eq("status", "active")
          .order("created_at", {
            ascending: true,
          }),

        supabase
          .from("tasks")
          .select(
            `
              id,
              title,
              goal_id,
              duration_minutes,
              status
            `
          )
          .eq("status", "active"),

        supabase
          .from("task_completions")
          .select(
            `
              id,
              task_id,
              scheduled_for,
              status,
              completed_at
            `
          )
          .gte(
            "scheduled_for",
            weekStartTimestamp
          )
          .lte(
            "scheduled_for",
            weekEndTimestamp
          ),
      ]);

      if (goalsResult.error) {
        throw goalsResult.error;
      }

      if (tasksResult.error) {
        throw tasksResult.error;
      }

      if (completionsResult.error) {
        throw completionsResult.error;
      }

      setGoals(
        (goalsResult.data || []) as Goal[]
      );

      setTasks(
        (tasksResult.data || []) as Task[]
      );

      setCompletions(
        (completionsResult.data || []) as Completion[]
      );
    } catch (err) {
      console.error("Failed to load goals:", err);

      setError(
        "Unable to load your goals. Please refresh and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGoals();
  }, []);

  const goalStats = useMemo(() => {
    const stats: Record<string, GoalStats> = {};

    for (const goal of goals) {
      const linkedTasks = tasks.filter(
        (task) => task.goal_id === goal.id
      );

      const linkedTaskIds = new Set(
        linkedTasks.map((task) => task.id)
      );

      const goalCompletions =
        completions.filter(
          (completion) =>
            linkedTaskIds.has(completion.task_id)
        );

      const completedTasks =
        goalCompletions.filter(
          (completion) =>
            completion.status === "completed"
        ).length;

      /*
       * We count each completed occurrence.
       * Therefore, if Handstand is scheduled 3 times
       * this week and all 3 are completed, the goal gets
       * 3 completed sessions.
       */
      const totalTasks =
        linkedTasks.length > 0
          ? goalCompletions.length
          : 0;

      const completionRate =
        totalTasks > 0
          ? Math.round(
              (completedTasks / totalTasks) * 100
            )
          : 0;

      stats[goal.id] = {
        totalTasks,
        completedTasks,
        completionRate,
        weeklyTarget: totalTasks,
        linkedTasks,
      };
    }

    return stats;
  }, [goals, tasks, completions]);

  const overallStats = useMemo(() => {
    let totalScheduled = 0;
    let totalCompleted = 0;

    for (const goal of goals) {
      const stats = goalStats[goal.id];

      if (!stats) {
        continue;
      }

      totalScheduled += stats.totalTasks;
      totalCompleted += stats.completedTasks;
    }

    return {
      totalScheduled,
      totalCompleted,
      completionRate:
        totalScheduled > 0
          ? Math.round(
              (totalCompleted / totalScheduled) * 100
            )
          : 0,
    };
  }, [goals, goalStats]);

  function getGoalDescription(goal: Goal) {
    if (goal.description) {
      return goal.description;
    }

    const stats = goalStats[goal.id];

    if (!stats || stats.linkedTasks.length === 0) {
      return "No tasks linked to this goal yet.";
    }

    const taskNames = stats.linkedTasks
      .map((task) => task.title)
      .join(" • ");

    return taskNames;
  }

  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <a
                href="/"
                className="text-sm text-zinc-500 transition hover:text-zinc-300"
              >
                ← Dashboard
              </a>
            </div>

            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Goals
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
              Your progress is based on the activities you
              actually complete, not just a manually entered
              percentage.
            </p>
          </div>

          {!loading && !error && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 px-5 py-4">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                This week
              </p>

              <div className="mt-1 flex items-end gap-2">
                <span className="text-2xl font-bold">
                  {overallStats.completionRate}%
                </span>

                <span className="pb-1 text-sm text-zinc-500">
                  completed
                </span>
              </div>

              <p className="mt-1 text-xs text-zinc-500">
                {overallStats.totalCompleted} of{" "}
                {overallStats.totalScheduled} scheduled
                activities
              </p>
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <div
                key={item}
                className="h-64 animate-pulse rounded-3xl border border-zinc-800 bg-zinc-900"
              />
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-3xl border border-red-900/50 bg-red-950/20 p-6">
            <p className="font-medium text-red-300">
              {error}
            </p>

            <button
              onClick={loadGoals}
              className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-200"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading &&
          !error &&
          goals.length === 0 && (
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-10 text-center">
              <div className="text-4xl">🎯</div>

              <h2 className="mt-4 text-xl font-semibold">
                No active goals yet
              </h2>

              <p className="mt-2 text-sm text-zinc-500">
                Complete your setup first to create your
                default goals.
              </p>

              <a
                href="/setup"
                className="mt-5 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
              >
                Go to Setup
              </a>
            </div>
          )}

        {/* Goal cards */}
        {!loading &&
          !error &&
          goals.length > 0 && (
            <div className="grid gap-5 md:grid-cols-2">
              {goals.map((goal) => {
                const stats = goalStats[goal.id];

                const progress =
                  stats?.completionRate ?? 0;

                const daysRemaining =
                  getDaysRemaining(goal.target_date);

                const progressColor =
                  getProgressColor(
                    goal.category
                  );

                return (
                  <section
                    key={goal.id}
                    className="group overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/70 transition hover:border-zinc-700 hover:bg-zinc-900"
                  >
                    {/* Progress accent */}
                    <div className="h-1 w-full bg-zinc-800">
                      <div
                        className={`h-full bg-gradient-to-r ${progressColor} transition-all duration-700`}
                        style={{
                          width: `${progress}%`,
                        }}
                      />
                    </div>

                    <div className="p-5 sm:p-6">
                      {/* Top row */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-zinc-800 text-xl">
                            {categoryIcons[
                              goal.category
                            ] || "🎯"}
                          </div>

                          <div className="min-w-0">
                            <h2 className="truncate text-lg font-semibold">
                              {goal.name}
                            </h2>

                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-[11px] font-medium text-zinc-300">
                                {categoryLabels[
                                  goal.category
                                ] ||
                                  goal.category}
                              </span>

                              <span
                                className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                                  goal.priority ===
                                  "must"
                                    ? "bg-red-500/10 text-red-300"
                                    : goal.priority ===
                                        "should"
                                      ? "bg-amber-500/10 text-amber-300"
                                      : "bg-zinc-800 text-zinc-400"
                                }`}
                              >
                                {priorityLabels[
                                  goal.priority
                                ] ||
                                  goal.priority}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <div className="text-2xl font-bold">
                            {progress}%
                          </div>

                          <div className="text-[11px] text-zinc-500">
                            this week
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="mt-5 min-h-10 text-sm leading-5 text-zinc-500">
                        {getGoalDescription(goal)}
                      </p>

                      {/* Progress bar */}
                      <div className="mt-5">
                        <div className="mb-2 flex items-center justify-between text-xs">
                          <span className="text-zinc-500">
                            Weekly progress
                          </span>

                          <span className="font-medium text-zinc-300">
                            {stats?.completedTasks ??
                              0}{" "}
                            /{" "}
                            {stats?.totalTasks ?? 0}
                          </span>
                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${progressColor} transition-all duration-700`}
                            style={{
                              width: `${progress}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="mt-5 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-zinc-950/70 p-3">
                          <p className="text-[11px] uppercase tracking-wide text-zinc-600">
                            Completed
                          </p>

                          <p className="mt-1 text-lg font-semibold">
                            {stats?.completedTasks ??
                              0}
                          </p>

                          <p className="text-xs text-zinc-600">
                            activities
                          </p>
                        </div>

                        <div className="rounded-2xl bg-zinc-950/70 p-3">
                          <p className="text-[11px] uppercase tracking-wide text-zinc-600">
                            Target
                          </p>

                          <p className="mt-1 text-lg font-semibold">
                            {goal.target_date
                              ? formatTargetDate(
                                  goal.target_date
                                )
                              : "—"}
                          </p>

                          <p className="text-xs text-zinc-600">
                            {daysRemaining !==
                            null
                              ? daysRemaining > 0
                                ? `${daysRemaining} days left`
                                : daysRemaining ===
                                    0
                                  ? "Today"
                                  : "Past target"
                              : "No deadline"}
                          </p>
                        </div>
                      </div>

                      {/* Linked tasks */}
                      {stats &&
                        stats.linkedTasks.length >
                          0 && (
                          <div className="mt-5 border-t border-zinc-800 pt-5">
                            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-600">
                              Activities
                            </p>

                            <div className="flex flex-wrap gap-2">
                              {stats.linkedTasks.map(
                                (task) => (
                                  <span
                                    key={task.id}
                                    className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-400"
                                  >
                                    {task.title}
                                  </span>
                                )
                              )}
                            </div>
                          </div>
                        )}
                    </div>
                  </section>
                );
              })}
            </div>
          )}

        {/* Explanation */}
        {!loading &&
          !error &&
          goals.length > 0 && (
            <div className="mt-6 rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-5">
              <div className="flex gap-3">
                <div className="text-lg">💡</div>

                <div>
                  <h3 className="text-sm font-semibold text-zinc-300">
                    How progress works
                  </h3>

                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    Goal progress currently reflects your
                    completed activities for the current
                    week. For example, completing 2 of 3
                    Handstand sessions gives that goal 67%
                    weekly progress. Later, we can add
                    dedicated progress for CCNA mock-test
                    scores, job applications, interviews,
                    and your actual handstand/back-walkover
                    milestones.
                  </p>
                </div>
              </div>
            </div>
          )}
      </div>
    </main>
  );
}