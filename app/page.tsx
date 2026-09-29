"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Priority = "must" | "should" | "free";

type Task = {
  id: string;
  goal_id: string | null;
  title: string;
  description: string | null;
  category: string;
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
};

type Schedule = {
  id: string;
  task_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string | null;
  start_date: string | null;
  end_date: string | null;
  repeat_type: string;
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

type TodayTask = {
  task: Task;
  schedule: Schedule;
  completion?: Completion;
};

const priorityOrder: Record<Priority, number> = {
  must: 1,
  should: 2,
  free: 3,
};

const priorityLabel: Record<Priority, string> = {
  must: "MUST DO",
  should: "SHOULD DO",
  free: "FREE",
};

const categoryLabel: Record<string, string> = {
  fitness: "Fitness",
  learning: "Learning",
  career: "Career",
  work: "Work",
  family: "Family",
  friends: "Friends",
  hobby: "Hobby",
  personal: "Personal",
  free: "Free",
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

/*
 * IMPORTANT:
 * Do not use locale-dependent formatting here.
 * This keeps server/client output consistent
 * and prevents hydration mismatches.
 */
function formatDate(dateString: string) {
  const [year, month, day] = dateString
    .split("-")
    .map(Number);

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
  const [hours, minutes] = time
    .split(":")
    .map(Number);

  const period = hours >= 12 ? "PM" : "AM";

  const displayHour =
    hours % 12 === 0 ? 12 : hours % 12;

  return `${displayHour}:${String(minutes).padStart(
    2,
    "0"
  )} ${period}`;
}

function getScheduledDateTime(
  dateString: string,
  timeString: string
) {
  const cleanTime = timeString.slice(0, 5);

  return new Date(
    `${dateString}T${cleanTime}:00`
  ).toISOString();
}

function getCompletionLabel(
  status?: CompletionStatus
) {
  switch (status) {
    case "completed":
      return "Completed";

    case "skipped":
      return "Skipped";

    case "snoozed":
      return "Snoozed";

    case "rescheduled":
      return "Rescheduled";

    default:
      return "";
  }
}

export default function HomePage() {
  const router = useRouter();

  const [todayTasks, setTodayTasks] = useState<TodayTask[]>(
    []
  );

  const [goals, setGoals] = useState<Goal[]>([]);

  const [loading, setLoading] = useState(true);

  const [actionLoading, setActionLoading] = useState<
    string | null
  >(null);

  const [message, setMessage] = useState("");

  /*
   * Add Task
   */
  const [showAddTask, setShowAddTask] = useState(false);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] =
    useState("");

  const [newTaskCategory, setNewTaskCategory] =
    useState("personal");

  const [newTaskPriority, setNewTaskPriority] =
    useState<Priority>("should");

  const [newTaskDuration, setNewTaskDuration] =
    useState("30");

  const [newTaskTime, setNewTaskTime] =
    useState("18:00");

  /*
   * Snooze
   */
  const [snoozeTaskId, setSnoozeTaskId] =
    useState<string | null>(null);

  /*
   * Reschedule
   */
  const [rescheduleTaskId, setRescheduleTaskId] =
    useState<string | null>(null);

  const [rescheduleDate, setRescheduleDate] =
    useState("");

  const [rescheduleTime, setRescheduleTime] =
    useState("");

  /*
   * I'M FREE
   */
  const [showFreeTime, setShowFreeTime] =
    useState(false);

  const [freeMinutes, setFreeMinutes] =
    useState<number | null>(null);

  const [freeSuggestion, setFreeSuggestion] =
    useState<TodayTask | null>(null);

  const [rejectedSuggestions, setRejectedSuggestions] =
    useState<string[]>([]);

  const todayDate = getTodayDateString();

  const todayDayOfWeek = getTodayDayOfWeek();

  /*
   * LOAD TODAY
   */
  const loadToday = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace("/login");
        return;
      }

      const userId = session.user.id;

      const [
        { data: tasksData, error: tasksError },
        { data: schedulesData, error: schedulesError },
        { data: completionsData, error: completionsError },
        { data: goalsData, error: goalsError },
      ] = await Promise.all([
        supabase
          .from("tasks")
          .select("*")
          .eq("user_id", userId)
          .eq("status", "active"),

        supabase
          .from("task_schedules")
          .select("*")
          .eq("user_id", userId)
          .eq("is_active", true),

        supabase
          .from("task_completions")
          .select("*")
          .eq("user_id", userId)
          .gte(
            "scheduled_for",
            `${todayDate}T00:00:00`
          )
          .lt(
            "scheduled_for",
            `${todayDate}T23:59:59.999Z`
          ),

        supabase
          .from("goals")
          .select("id, name, category")
          .eq("user_id", userId)
          .eq("status", "active"),
      ]);

      if (tasksError) throw tasksError;
      if (schedulesError) throw schedulesError;
      if (completionsError) throw completionsError;
      if (goalsError) throw goalsError;

      const tasks = (tasksData ?? []) as Task[];

      const schedules = (schedulesData ??
        []) as Schedule[];

      const completions = (completionsData ??
        []) as Completion[];

      setGoals((goalsData ?? []) as Goal[]);

      const taskMap = new Map(
        tasks.map((task) => [task.id, task])
      );

      const completionMap = new Map<
        string,
        Completion
      >();

      for (const completion of completions) {
        completionMap.set(
          completion.task_id,
          completion
        );
      }

      const todayItems: TodayTask[] = [];

      for (const schedule of schedules) {
        if (
          schedule.day_of_week !==
          todayDayOfWeek
        ) {
          continue;
        }

        const task = taskMap.get(schedule.task_id);

        if (!task) {
          continue;
        }

        if (
          schedule.start_date &&
          todayDate < schedule.start_date
        ) {
          continue;
        }

        if (
          schedule.end_date &&
          todayDate > schedule.end_date
        ) {
          continue;
        }

        todayItems.push({
          task,
          schedule,
          completion: completionMap.get(
            task.id
          ),
        });
      }

      todayItems.sort((a, b) => {
        const priorityDifference =
          priorityOrder[a.task.priority] -
          priorityOrder[b.task.priority];

        if (priorityDifference !== 0) {
          return priorityDifference;
        }

        return a.schedule.start_time.localeCompare(
          b.schedule.start_time
        );
      });

      setTodayTasks(todayItems);
    } catch (error) {
      console.error(
        "Load dashboard error:",
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load today's tasks."
      );
    } finally {
      setLoading(false);
    }
  }, [
    router,
    todayDate,
    todayDayOfWeek,
  ]);

  useEffect(() => {
    loadToday();
  }, [loadToday]);

  /*
   * PROGRESS
   */
  const completedCount = useMemo(() => {
    return todayTasks.filter(
      (item) =>
        item.completion?.status ===
        "completed"
    ).length;
  }, [todayTasks]);

  const actionableCount = useMemo(() => {
    return todayTasks.filter(
      (item) =>
        item.completion?.status !==
        "skipped"
    ).length;
  }, [todayTasks]);

  const progress = useMemo(() => {
    if (actionableCount === 0) {
      return 0;
    }

    return Math.round(
      (completedCount /
        actionableCount) *
        100
    );
  }, [
    completedCount,
    actionableCount,
  ]);

  /*
   * TASK GROUPS
   */
  const mustTasks = todayTasks.filter(
    (item) =>
      item.task.priority === "must"
  );

  const shouldTasks = todayTasks.filter(
    (item) =>
      item.task.priority === "should"
  );

  const freeTasks = todayTasks.filter(
    (item) =>
      item.task.priority === "free"
  );

  /*
   * GOAL NAME
   */
  const getGoalName = (
    goalId: string | null
  ) => {
    if (!goalId) {
      return null;
    }

    return (
      goals.find(
        (goal) => goal.id === goalId
      )?.name ?? null
    );
  };

  /*
   * COMPLETE TASK
   */
  const completeTask = async (
    item: TodayTask
  ) => {
    setActionLoading(item.task.id);
    setMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace("/login");
        return;
      }

      const scheduledFor =
        getScheduledDateTime(
          todayDate,
          item.schedule.start_time
        );

      const completedAt =
        new Date().toISOString();

      if (item.completion) {
        const { error } =
          await supabase
            .from("task_completions")
            .update({
              status: "completed",
              completed_at:
                completedAt,
              snooze_until: null,
              scheduled_for:
                scheduledFor,
            })
            .eq(
              "id",
              item.completion.id
            )
            .eq(
              "user_id",
              session.user.id
            );

        if (error) throw error;
      } else {
        const { error } =
          await supabase
            .from("task_completions")
            .insert({
              task_id: item.task.id,
              user_id:
                session.user.id,
              scheduled_for:
                scheduledFor,
              completed_at:
                completedAt,
              status: "completed",
              snooze_until: null,
            });

        if (error) throw error;
      }

      await loadToday();
    } catch (error) {
      console.error(
        "Complete task error:",
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to complete task."
      );
    } finally {
      setActionLoading(null);
    }
  };

  /*
   * SKIP TASK
   */
  const skipTask = async (
    item: TodayTask
  ) => {
    setActionLoading(item.task.id);
    setMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace("/login");
        return;
      }

      const scheduledFor =
        getScheduledDateTime(
          todayDate,
          item.schedule.start_time
        );

      if (item.completion) {
        const { error } =
          await supabase
            .from("task_completions")
            .update({
              status: "skipped",
              completed_at: null,
              snooze_until: null,
              scheduled_for:
                scheduledFor,
            })
            .eq(
              "id",
              item.completion.id
            )
            .eq(
              "user_id",
              session.user.id
            );

        if (error) throw error;
      } else {
        const { error } =
          await supabase
            .from("task_completions")
            .insert({
              task_id: item.task.id,
              user_id:
                session.user.id,
              scheduled_for:
                scheduledFor,
              completed_at: null,
              status: "skipped",
              snooze_until: null,
            });

        if (error) throw error;
      }

      await loadToday();
    } catch (error) {
      console.error(
        "Skip task error:",
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to skip task."
      );
    } finally {
      setActionLoading(null);
    }
  };

  /*
   * SNOOZE TASK
   */
  const snoozeTask = async (
    item: TodayTask,
    minutes: number
  ) => {
    setActionLoading(item.task.id);
    setMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace("/login");
        return;
      }

      const scheduledFor =
        getScheduledDateTime(
          todayDate,
          item.schedule.start_time
        );

      const snoozeUntil =
        new Date(
          Date.now() +
            minutes * 60 * 1000
        ).toISOString();

      if (item.completion) {
        const { error } =
          await supabase
            .from("task_completions")
            .update({
              status: "snoozed",
              completed_at: null,
              snooze_until:
                snoozeUntil,
              scheduled_for:
                scheduledFor,
            })
            .eq(
              "id",
              item.completion.id
            )
            .eq(
              "user_id",
              session.user.id
            );

        if (error) throw error;
      } else {
        const { error } =
          await supabase
            .from("task_completions")
            .insert({
              task_id: item.task.id,
              user_id:
                session.user.id,
              scheduled_for:
                scheduledFor,
              completed_at: null,
              status: "snoozed",
              snooze_until:
                snoozeUntil,
            });

        if (error) throw error;
      }

      setSnoozeTaskId(null);

      await loadToday();
    } catch (error) {
      console.error(
        "Snooze task error:",
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to snooze task."
      );
    } finally {
      setActionLoading(null);
    }
  };

  /*
   * RESCHEDULE TASK
   */
  const rescheduleTask = async (
    item: TodayTask
  ) => {
    if (
      !rescheduleDate ||
      !rescheduleTime
    ) {
      setMessage(
        "Please choose a date and time."
      );
      return;
    }

    setActionLoading(item.task.id);
    setMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace("/login");
        return;
      }

      const newScheduledFor =
        getScheduledDateTime(
          rescheduleDate,
          rescheduleTime
        );

      if (item.completion) {
        const { error } =
          await supabase
            .from("task_completions")
            .update({
              status: "rescheduled",
              scheduled_for:
                newScheduledFor,
              completed_at: null,
              snooze_until: null,
            })
            .eq(
              "id",
              item.completion.id
            )
            .eq(
              "user_id",
              session.user.id
            );

        if (error) throw error;
      } else {
        const { error } =
          await supabase
            .from("task_completions")
            .insert({
              task_id: item.task.id,
              user_id:
                session.user.id,
              scheduled_for:
                newScheduledFor,
              completed_at: null,
              status: "rescheduled",
              snooze_until: null,
            });

        if (error) throw error;
      }

      setRescheduleTaskId(null);
      setRescheduleDate("");
      setRescheduleTime("");

      await loadToday();
    } catch (error) {
      console.error(
        "Reschedule task error:",
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to reschedule task."
      );
    } finally {
      setActionLoading(null);
    }
  };

  /*
   * ADD TASK
   */
  const addTask = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (!newTaskTitle.trim()) {
      return;
    }

    setActionLoading("new-task");
    setMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        router.replace("/login");
        return;
      }

      const userId = session.user.id;

      const {
        data: taskData,
        error: taskError,
      } = await supabase
        .from("tasks")
        .insert({
          user_id: userId,
          title:
            newTaskTitle.trim(),
          description:
            newTaskDescription.trim() ||
            null,
          category:
            newTaskCategory,
          priority:
            newTaskPriority,
          duration_minutes:
            Number(newTaskDuration) ||
            30,
          strict_mode: false,
          max_reminders_per_day: 3,
          allow_snooze: true,
          status: "active",
        })
        .select("id")
        .single();

      if (taskError) {
        throw taskError;
      }

      const {
        error: scheduleError,
      } = await supabase
        .from("task_schedules")
        .insert({
          task_id: taskData.id,
          user_id: userId,
          day_of_week:
            todayDayOfWeek,
          start_time:
            newTaskTime,
          end_time: null,
          start_date:
            todayDate,
          end_date: null,
          repeat_type: "weekly",
          reminder_interval_minutes: 30,
          is_active: true,
        });

      if (scheduleError) {
        throw scheduleError;
      }

      setShowAddTask(false);

      setNewTaskTitle("");
      setNewTaskDescription("");
      setNewTaskCategory(
        "personal"
      );
      setNewTaskPriority(
        "should"
      );
      setNewTaskDuration("30");
      setNewTaskTime("18:00");

      await loadToday();
    } catch (error) {
      console.error(
        "Add task error:",
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to add task."
      );
    } finally {
      setActionLoading(null);
    }
  };

  /*
   * I'M FREE
   *
   * We only recommend existing tasks.
   * We do NOT modify the recurring schedule.
   */
  const getFreeTimeSuggestion = (
    minutes: number
  ) => {
    setFreeMinutes(minutes);

    const availableTasks =
      todayTasks.filter((item) => {
        const status =
          item.completion?.status;

        if (
          status === "completed" ||
          status === "skipped"
        ) {
          return false;
        }

        if (
          rejectedSuggestions.includes(
            item.task.id
          )
        ) {
          return false;
        }

        if (
          item.task.duration_minutes >
          minutes
        ) {
          return false;
        }

        return true;
      });

    if (
      availableTasks.length === 0
    ) {
      setFreeSuggestion(null);
      return;
    }

    const sortedTasks =
      [...availableTasks].sort(
        (a, b) => {
          const priorityDifference =
            priorityOrder[
              a.task.priority
            ] -
            priorityOrder[
              b.task.priority
            ];

          if (
            priorityDifference !== 0
          ) {
            return priorityDifference;
          }

          /*
           * Prefer the task that uses
           * the available time most efficiently.
           */
          const aDifference =
            Math.abs(
              minutes -
                a.task
                  .duration_minutes
            );

          const bDifference =
            Math.abs(
              minutes -
                b.task
                  .duration_minutes
            );

          return (
            aDifference -
            bDifference
          );
        }
      );

    setFreeSuggestion(
      sortedTasks[0]
    );
  };

  /*
   * NOT THIS
   */
  const rejectFreeSuggestion =
    () => {
      if (!freeSuggestion) {
        return;
      }

      const rejectedId =
        freeSuggestion.task.id;

      const updatedRejected = [
        ...rejectedSuggestions,
        rejectedId,
      ];

      setRejectedSuggestions(
        updatedRejected
      );

      setFreeSuggestion(null);

      /*
       * Find another suggestion
       * without changing the database.
       */
      if (freeMinutes !== null) {
        const availableTasks =
          todayTasks.filter(
            (item) => {
              const status =
                item.completion
                  ?.status;

              if (
                status ===
                  "completed" ||
                status ===
                  "skipped"
              ) {
                return false;
              }

              if (
                updatedRejected.includes(
                  item.task.id
                )
              ) {
                return false;
              }

              if (
                item.task
                  .duration_minutes >
                freeMinutes
              ) {
                return false;
              }

              return true;
            }
          );

        if (
          availableTasks.length ===
          0
        ) {
          setFreeSuggestion(null);
          return;
        }

        const sortedTasks =
          [...availableTasks].sort(
            (a, b) => {
              const priorityDifference =
                priorityOrder[
                  a.task.priority
                ] -
                priorityOrder[
                  b.task.priority
                ];

              if (
                priorityDifference !==
                0
              ) {
                return priorityDifference;
              }

              const aDifference =
                Math.abs(
                  freeMinutes -
                    a.task
                      .duration_minutes
                );

              const bDifference =
                Math.abs(
                  freeMinutes -
                    b.task
                      .duration_minutes
                );

              return (
                aDifference -
                bDifference
              );
            }
          );

        setFreeSuggestion(
          sortedTasks[0]
        );
      }
    };

  /*
   * START FREE SUGGESTION
   */
  const startFreeSuggestion =
    () => {
      if (!freeSuggestion) {
        return;
      }

      const taskId =
        freeSuggestion.task.id;

      setShowFreeTime(false);

      setTimeout(() => {
        const element =
          document.getElementById(
            `task-${taskId}`
          );

        element?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 100);
    };

  /*
   * RESET I'M FREE
   */
  const resetFreeTime = () => {
    setFreeMinutes(null);
    setFreeSuggestion(null);
    setRejectedSuggestions([]);
  };

  /*
   * SIGN OUT
   */
  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  /*
   * RENDER TASK
   */
  const renderTask = (
    item: TodayTask
  ) => {
    const completionStatus =
      item.completion?.status;

    const isCompleted =
      completionStatus ===
      "completed";

    const isSkipped =
      completionStatus ===
      "skipped";

    const isSnoozed =
      completionStatus ===
      "snoozed";

    const isRescheduled =
      completionStatus ===
      "rescheduled";

    const isActionLoading =
      actionLoading ===
      item.task.id;

    const goalName =
      getGoalName(
        item.task.goal_id
      );

    return (
      <div
        id={`task-${item.task.id}`}
        key={item.task.id}
        className={`rounded-3xl border p-4 transition ${
          isCompleted
            ? "border-zinc-800 bg-zinc-950/60 opacity-70"
            : isSkipped
            ? "border-zinc-900 bg-zinc-950/40 opacity-50"
            : "border-zinc-800 bg-zinc-900"
        }`}
      >
        <div className="flex gap-3">
          <div className="pt-1">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full border ${
                isCompleted
                  ? "border-white bg-white text-black"
                  : "border-zinc-700 bg-zinc-950"
              }`}
            >
              {isCompleted
                ? "✓"
                : ""}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3
                  className={`font-semibold ${
                    isCompleted
                      ? "text-zinc-500 line-through"
                      : "text-white"
                  }`}
                >
                  {item.task.title}
                </h3>

                <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-zinc-500">
                  <span>
                    {formatTime(
                      item.schedule
                        .start_time
                    )}
                  </span>

                  <span>
                    •
                  </span>

                  <span>
                    {
                      item.task
                        .duration_minutes
                    }{" "}
                    min
                  </span>

                  <span>
                    •
                  </span>

                  <span>
                    {categoryLabel[
                      item.task
                        .category
                    ] ??
                      item.task
                        .category}
                  </span>
                </div>
              </div>

              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide ${
                  item.task
                    .priority ===
                  "must"
                    ? "bg-white text-black"
                    : item.task
                        .priority ===
                      "should"
                    ? "bg-zinc-800 text-zinc-300"
                    : "bg-zinc-900 text-zinc-500"
                }`}
              >
                {
                  priorityLabel[
                    item.task
                      .priority
                  ]
                }
              </span>
            </div>

            {item.task
              .description && (
              <p className="mt-3 text-sm leading-5 text-zinc-400">
                {
                  item.task
                    .description
                }
              </p>
            )}

            {goalName && (
              <p className="mt-3 text-xs text-zinc-600">
                Goal: {goalName}
              </p>
            )}

            {completionStatus &&
              completionStatus !==
                "pending" && (
                <div className="mt-3">
                  <span className="text-xs text-zinc-500">
                    {getCompletionLabel(
                      completionStatus
                    )}

                    {isSnoozed &&
                      item
                        .completion
                        ?.snooze_until && (
                        <>
                          {" "}
                          until{" "}
                          {new Date(
                            item
                              .completion
                              .snooze_until
                          ).toLocaleTimeString(
                            "en-US",
                            {
                              hour: "numeric",
                              minute:
                                "2-digit",
                            }
                          )}
                        </>
                      )}

                    {isRescheduled &&
                      item
                        .completion
                        ?.scheduled_for && (
                        <>
                          {" "}
                          for{" "}
                          {new Date(
                            item
                              .completion
                              .scheduled_for
                          ).toLocaleString(
                            "en-US",
                            {
                              month:
                                "short",
                              day: "numeric",
                              hour: "numeric",
                              minute:
                                "2-digit",
                            }
                          )}
                        </>
                      )}
                  </span>
                </div>
              )}

            {!isCompleted &&
              !isSkipped && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      completeTask(
                        item
                      )
                    }
                    disabled={
                      isActionLoading
                    }
                    className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-50"
                  >
                    {isActionLoading
                      ? "Saving..."
                      : "✓ Complete"}
                  </button>

                  {item.task
                    .allow_snooze && (
                    <button
                      type="button"
                      onClick={() =>
                        setSnoozeTaskId(
                          snoozeTaskId ===
                            item
                              .task
                              .id
                            ? null
                            : item
                                .task
                                .id
                        )
                      }
                      disabled={
                        isActionLoading
                      }
                      className="rounded-xl bg-zinc-800 px-4 py-2.5 text-sm text-white transition hover:bg-zinc-700 disabled:opacity-50"
                    >
                      Snooze
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setRescheduleTaskId(
                        item.task.id
                      );

                      setRescheduleDate(
                        todayDate
                      );

                      setRescheduleTime(
                        item.schedule.start_time.slice(
                          0,
                          5
                        )
                      );
                    }}
                    disabled={
                      isActionLoading
                    }
                    className="rounded-xl bg-zinc-800 px-4 py-2.5 text-sm text-white transition hover:bg-zinc-700 disabled:opacity-50"
                  >
                    Reschedule
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      skipTask(
                        item
                      )
                    }
                    disabled={
                      isActionLoading
                    }
                    className="rounded-xl px-3 py-2.5 text-sm text-zinc-500 transition hover:text-white disabled:opacity-50"
                  >
                    Skip
                  </button>
                </div>
              )}

            {snoozeTaskId ===
              item.task.id && (
              <div className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Snooze for
                </p>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      snoozeTask(
                        item,
                        15
                      )
                    }
                    className="rounded-xl bg-zinc-800 px-3 py-2 text-sm text-white hover:bg-zinc-700"
                  >
                    15 min
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      snoozeTask(
                        item,
                        30
                      )
                    }
                    className="rounded-xl bg-zinc-800 px-3 py-2 text-sm text-white hover:bg-zinc-700"
                  >
                    30 min
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      snoozeTask(
                        item,
                        60
                      )
                    }
                    className="rounded-xl bg-zinc-800 px-3 py-2 text-sm text-white hover:bg-zinc-700"
                  >
                    60 min
                  </button>
                </div>
              </div>
            )}

            {rescheduleTaskId ===
              item.task.id && (
              <div className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
                <p className="mb-3 text-sm font-semibold text-white">
                  Reschedule task
                </p>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs text-zinc-500">
                      Date
                    </label>

                    <input
                      type="date"
                      value={
                        rescheduleDate
                      }
                      onChange={(
                        event
                      ) =>
                        setRescheduleDate(
                          event
                            .target
                            .value
                        )
                      }
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-sm text-white outline-none focus:border-zinc-600"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs text-zinc-500">
                      Time
                    </label>

                    <input
                      type="time"
                      value={
                        rescheduleTime
                      }
                      onChange={(
                        event
                      ) =>
                        setRescheduleTime(
                          event
                            .target
                            .value
                        )
                      }
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-3 text-sm text-white outline-none focus:border-zinc-600"
                    />
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      rescheduleTask(
                        item
                      )
                    }
                    disabled={
                      isActionLoading
                    }
                    className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
                  >
                    {isActionLoading
                      ? "Saving..."
                      : "Save"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRescheduleTaskId(
                        null
                      );

                      setRescheduleDate(
                        ""
                      );

                      setRescheduleTime(
                        ""
                      );
                    }}
                    className="rounded-xl bg-zinc-800 px-4 py-2.5 text-sm text-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  /*
   * RENDER SECTION
   */
  const renderSection = (
    title: string,
    tasks: TodayTask[],
    description: string
  ) => {
    if (tasks.length === 0) {
      return null;
    }

    return (
      <section className="mt-7">
        <div className="mb-3">
          <h2 className="text-lg font-semibold text-white">
            {title}
          </h2>

          <p className="mt-1 text-xs text-zinc-600">
            {description}
          </p>
        </div>

        <div className="space-y-3">
          {tasks.map(
            renderTask
          )}
        </div>
      </section>
    );
  };

  return (
    <main className="min-h-screen bg-[#0b0b0f] text-white">
      <div className="mx-auto min-h-screen max-w-2xl px-4 pb-28 pt-6 sm:px-6">
        {/* HEADER */}
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-500">
              DisciplineTracker
            </p>

            <h1 className="mt-1 text-2xl font-bold">
              Today
            </h1>

            <p className="mt-1 text-sm text-zinc-500">
              {formatDate(
                todayDate
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={signOut}
            className="rounded-xl bg-zinc-900 px-3 py-2 text-xs text-zinc-400 hover:text-white"
          >
            Sign out
          </button>
        </header>

        {/* PROGRESS */}
        <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">
                Today&apos;s progress
              </p>

              <p className="mt-2 text-4xl font-bold">
                {progress}%
              </p>
            </div>

            <p className="text-sm text-zinc-500">
              {completedCount}/
              {actionableCount}{" "}
              completed
            </p>
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-white transition-all duration-500"
              style={{
                width: `${progress}%`,
              }}
            />
          </div>
        </section>

        {/* I'M FREE */}
        <button
          type="button"
          onClick={() => {
            setShowFreeTime(true);
            resetFreeTime();
          }}
          className="mt-4 w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-5 py-4 text-left transition hover:border-zinc-700"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-white">
                I&apos;m Free
              </p>

              <p className="mt-1 text-xs text-zinc-500">
                Have some time? Let
                DisciplineTracker suggest
                something useful.
              </p>
            </div>

            <span className="text-xl text-zinc-500">
              →
            </span>
          </div>
        </button>

        {/* MESSAGE */}
        {message && (
          <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-300">
            {message}
          </div>
        )}

        {/* CONTENT */}
        {loading ? (
          <div className="mt-10 text-center text-sm text-zinc-500">
            Loading today&apos;s plan...
          </div>
        ) : todayTasks.length ===
          0 ? (
          <div className="mt-10 rounded-3xl border border-zinc-800 bg-zinc-900 p-6 text-center">
            <p className="text-lg font-semibold">
              Nothing scheduled today
            </p>

            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Enjoy the free time or add
              something you want to work
              on.
            </p>
          </div>
        ) : (
          <>
            {renderSection(
              "Must Do",
              mustTasks,
              "Important tasks for today."
            )}

            {renderSection(
              "Should Do",
              shouldTasks,
              "Useful tasks that support your goals."
            )}

            {renderSection(
              "Free",
              freeTasks,
              "Optional activities for your available time."
            )}
          </>
        )}

        {/* ADD TASK */}
        <button
          type="button"
          onClick={() =>
            setShowAddTask(true)
          }
          className="fixed bottom-6 left-1/2 z-20 -translate-x-1/2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-black shadow-2xl transition hover:bg-zinc-200"
        >
          + Add Task
        </button>

        {/* ADD TASK MODAL */}
        {showAddTask && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-zinc-800 bg-[#111116] p-5 sm:rounded-3xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    Add Task
                  </h2>

                  <p className="mt-1 text-xs text-zinc-500">
                    This task will be scheduled for
                    today.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowAddTask(false)
                  }
                  className="rounded-full bg-zinc-900 px-3 py-2 text-zinc-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form
                onSubmit={addTask}
                className="mt-6 space-y-4"
              >
                <div>
                  <label className="mb-2 block text-xs text-zinc-500">
                    Task title
                  </label>

                  <input
                    required
                    value={
                      newTaskTitle
                    }
                    onChange={(
                      event
                    ) =>
                      setNewTaskTitle(
                        event.target
                          .value
                      )
                    }
                    placeholder="e.g. Read CCNA notes"
                    className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-zinc-600"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs text-zinc-500">
                    Description
                  </label>

                  <textarea
                    value={
                      newTaskDescription
                    }
                    onChange={(
                      event
                    ) =>
                      setNewTaskDescription(
                        event.target
                          .value
                      )
                    }
                    placeholder="Optional"
                    rows={3}
                    className="w-full resize-none rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-zinc-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-2 block text-xs text-zinc-500">
                      Category
                    </label>

                    <select
                      value={
                        newTaskCategory
                      }
                      onChange={(
                        event
                      ) =>
                        setNewTaskCategory(
                          event.target
                            .value
                        )
                      }
                      className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-3.5 text-sm text-white outline-none"
                    >
                      <option value="fitness">
                        Fitness
                      </option>

                      <option value="learning">
                        Learning
                      </option>

                      <option value="career">
                        Career
                      </option>

                      <option value="hobby">
                        Hobby
                      </option>

                      <option value="personal">
                        Personal
                      </option>

                      <option value="family">
                        Family
                      </option>

                      <option value="friends">
                        Friends
                      </option>

                      <option value="free">
                        Free
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs text-zinc-500">
                      Priority
                    </label>

                    <select
                      value={
                        newTaskPriority
                      }
                      onChange={(
                        event
                      ) =>
                        setNewTaskPriority(
                          event.target
                            .value as Priority
                        )
                      }
                      className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-3.5 text-sm text-white outline-none"
                    >
                      <option value="must">
                        Must Do
                      </option>

                      <option value="should">
                        Should Do
                      </option>

                      <option value="free">
                        Free
                      </option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-2 block text-xs text-zinc-500">
                      Duration
                    </label>

                    <select
                      value={
                        newTaskDuration
                      }
                      onChange={(
                        event
                      ) =>
                        setNewTaskDuration(
                          event.target
                            .value
                        )
                      }
                      className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-3.5 text-sm text-white outline-none"
                    >
                      <option value="15">
                        15 min
                      </option>

                      <option value="30">
                        30 min
                      </option>

                      <option value="45">
                        45 min
                      </option>

                      <option value="60">
                        60 min
                      </option>

                      <option value="90">
                        90 min
                      </option>

                      <option value="120">
                        120 min
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs text-zinc-500">
                      Start time
                    </label>

                    <input
                      type="time"
                      value={
                        newTaskTime
                      }
                      onChange={(
                        event
                      ) =>
                        setNewTaskTime(
                          event.target
                            .value
                        )
                      }
                      className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-3.5 text-sm text-white outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={
                    actionLoading ===
                    "new-task"
                  }
                  className="w-full rounded-2xl bg-white px-4 py-4 font-semibold text-black disabled:opacity-50"
                >
                  {actionLoading ===
                  "new-task"
                    ? "Creating..."
                    : "Create Task"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* I'M FREE MODAL */}
        {showFreeTime && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
            <div className="w-full max-w-md rounded-t-3xl border border-zinc-800 bg-[#111116] p-5 sm:rounded-3xl">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold">
                    I&apos;m Free
                  </h2>

                  <p className="mt-1 text-sm text-zinc-500">
                    How much time do you
                    have?
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowFreeTime(
                      false
                    )
                  }
                  className="rounded-full bg-zinc-900 px-3 py-2 text-zinc-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {/* TIME SELECTION */}
              {!freeMinutes && (
                <div className="mt-6 grid grid-cols-3 gap-3">
                  {[15, 30, 60].map(
                    (minutes) => (
                      <button
                        key={
                          minutes
                        }
                        type="button"
                        onClick={() =>
                          getFreeTimeSuggestion(
                            minutes
                          )
                        }
                        className="rounded-2xl border border-zinc-800 bg-zinc-900 px-3 py-5 text-center transition hover:border-zinc-600"
                      >
                        <span className="block text-xl font-bold">
                          {
                            minutes
                          }
                        </span>

                        <span className="mt-1 block text-xs text-zinc-500">
                          minutes
                        </span>
                      </button>
                    )
                  )}
                </div>
              )}

              {/* SUGGESTION */}
              {freeMinutes &&
                freeSuggestion && (
                  <div className="mt-6">
                    <p className="text-xs uppercase tracking-wide text-zinc-600">
                      Suggested for{" "}
                      {
                        freeMinutes
                      }{" "}
                      minutes
                    </p>

                    <div className="mt-3 rounded-3xl border border-zinc-800 bg-zinc-900 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold">
                            {
                              freeSuggestion
                                .task
                                .title
                            }
                          </h3>

                          <p className="mt-2 text-sm text-zinc-500">
                            {
                              freeSuggestion
                                .task
                                .duration_minutes
                            }{" "}
                            min
                            {" • "}
                            {categoryLabel[
                              freeSuggestion
                                .task
                                .category
                            ] ??
                              freeSuggestion
                                .task
                                .category}
                          </p>
                        </div>

                        <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-[10px] font-bold text-zinc-400">
                          {
                            priorityLabel[
                              freeSuggestion
                                .task
                                .priority
                            ]
                          }
                        </span>
                      </div>

                      {freeSuggestion
                        .task
                        .description && (
                        <p className="mt-4 text-sm leading-6 text-zinc-400">
                          {
                            freeSuggestion
                              .task
                              .description
                          }
                        </p>
                      )}

                      <div className="mt-5 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={
                            startFreeSuggestion
                          }
                          className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black"
                        >
                          Start
                        </button>

                        <button
                          type="button"
                          onClick={
                            rejectFreeSuggestion
                          }
                          className="rounded-xl bg-zinc-800 px-4 py-3 text-sm text-white"
                        >
                          Not this
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        resetFreeTime()
                      }
                      className="mt-4 w-full rounded-xl py-3 text-sm text-zinc-500"
                    >
                      Choose different
                      time
                    </button>
                  </div>
                )}

              {/* NO SUGGESTION */}
              {freeMinutes &&
                !freeSuggestion && (
                  <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-center">
                    <p className="font-semibold">
                      Nothing suitable
                      right now
                    </p>

                    <p className="mt-2 text-sm leading-6 text-zinc-500">
                      You don&apos;t have an
                      available task that
                      fits into{" "}
                      {
                        freeMinutes
                      }{" "}
                      minutes.
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        resetFreeTime()
                      }
                      className="mt-4 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black"
                    >
                      Try another
                      duration
                    </button>
                  </div>
                )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}