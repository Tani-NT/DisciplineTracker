import { supabase } from "@/lib/supabase";

type GoalDefinition = {
  key: string;
  name: string;
  description: string;
  category: "fitness" | "learning" | "career" | "hobby" | "personal";
  priority: "must" | "should" | "free";
};

type TaskDefinition = {
  key: string;
  goalKey: string;
  title: string;
  description: string;
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
  priority: "must" | "should" | "free";
  duration: number;
  strict: boolean;
  maxReminders: number;
  reminderInterval: number;
  allowSnooze: boolean;
};

type ScheduleDefinition = {
  taskKey: string;
  days: number[];
  startTime: string;
};

const goals: GoalDefinition[] = [
  {
    key: "handstand",
    name: "Handstand + Back Walkover",
    description:
      "Build a safe progression toward a handstand hold and back walkover.",
    category: "fitness",
    priority: "must",
  },
  {
    key: "ccna",
    name: "CCNA Certification",
    description:
      "Prepare consistently for the CCNA exam and build confidence through mock tests.",
    category: "learning",
    priority: "must",
  },
  {
    key: "career",
    name: "New Software Developer Job",
    description:
      "Find a new software development role before leaving the current job.",
    category: "career",
    priority: "must",
  },
  {
    key: "walkingSwimming",
    name: "Walking + Swimming",
    description:
      "Maintain regular walking and swimming without overloading the week.",
    category: "fitness",
    priority: "should",
  },
  {
    key: "boards",
    name: "Longboard + Skateboard",
    description:
      "Practice longboarding on weekdays and skateboarding mainly on weekends.",
    category: "hobby",
    priority: "should",
  },
  {
    key: "relationships",
    name: "Family + Friends",
    description:
      "Protect genuine time for family and friends.",
    category: "personal",
    priority: "should",
  },
];

const tasks: TaskDefinition[] = [
  {
    key: "handstandTraining",
    goalKey: "handstand",
    title: "Handstand Training",
    description:
      "Practice handstand progression, balance and controlled holds.",
    category: "fitness",
    priority: "must",
    duration: 30,
    strict: true,
    maxReminders: 3,
    reminderInterval: 30,
    allowSnooze: true,
  },
  {
    key: "backWalkover",
    goalKey: "handstand",
    title: "Back Walkover Mobility",
    description:
      "Work on mobility, bridges and controlled progression.",
    category: "fitness",
    priority: "must",
    duration: 30,
    strict: true,
    maxReminders: 3,
    reminderInterval: 30,
    allowSnooze: true,
  },
  {
    key: "ccnaStudy",
    goalKey: "ccna",
    title: "CCNA Focused Study",
    description:
      "Complete one focused CCNA study session.",
    category: "learning",
    priority: "must",
    duration: 60,
    strict: true,
    maxReminders: 3,
    reminderInterval: 30,
    allowSnooze: true,
  },
  {
    key: "ccnaMock",
    goalKey: "ccna",
    title: "CCNA Mock Test",
    description:
      "Take a timed CCNA mock test and record the score.",
    category: "learning",
    priority: "must",
    duration: 90,
    strict: true,
    maxReminders: 2,
    reminderInterval: 30,
    allowSnooze: true,
  },
  {
    key: "careerDevelopment",
    goalKey: "career",
    title: "Career Development",
    description:
      "Improve resume, portfolio, interview skills or technical skills.",
    category: "career",
    priority: "should",
    duration: 45,
    strict: true,
    maxReminders: 2,
    reminderInterval: 30,
    allowSnooze: true,
  },
  {
    key: "jobApplications",
    goalKey: "career",
    title: "Job Applications",
    description:
      "Apply to relevant software development positions.",
    category: "career",
    priority: "should",
    duration: 30,
    strict: true,
    maxReminders: 2,
    reminderInterval: 30,
    allowSnooze: true,
  },
  {
    key: "walking",
    goalKey: "walkingSwimming",
    title: "Walking",
    description:
      "Go for a relaxed walk and get some movement.",
    category: "fitness",
    priority: "should",
    duration: 30,
    strict: false,
    maxReminders: 1,
    reminderInterval: 30,
    allowSnooze: true,
  },
  {
    key: "swimming",
    goalKey: "walkingSwimming",
    title: "Swimming",
    description:
      "Swimming session at a comfortable pace.",
    category: "fitness",
    priority: "should",
    duration: 45,
    strict: false,
    maxReminders: 1,
    reminderInterval: 30,
    allowSnooze: true,
  },
  {
    key: "longboard",
    goalKey: "boards",
    title: "Longboard Practice",
    description:
      "Practice longboarding during the weekday.",
    category: "hobby",
    priority: "should",
    duration: 45,
    strict: false,
    maxReminders: 1,
    reminderInterval: 30,
    allowSnooze: true,
  },
  {
    key: "skateboard",
    goalKey: "boards",
    title: "Skateboard Practice",
    description:
      "Weekend skateboard practice.",
    category: "hobby",
    priority: "should",
    duration: 60,
    strict: false,
    maxReminders: 1,
    reminderInterval: 30,
    allowSnooze: true,
  },
  {
    key: "familyFriends",
    goalKey: "relationships",
    title: "Family / Friends",
    description:
      "Protected time for family or friends.",
    category: "family",
    priority: "free",
    duration: 60,
    strict: false,
    maxReminders: 1,
    reminderInterval: 60,
    allowSnooze: true,
  },
  {
    key: "protectedFreeTime",
    goalKey: "relationships",
    title: "Protected Free Time",
    description:
      "Do whatever you want. This time is intentionally unscheduled.",
    category: "free",
    priority: "free",
    duration: 60,
    strict: false,
    maxReminders: 1,
    reminderInterval: 60,
    allowSnooze: true,
  },
];

const schedules: ScheduleDefinition[] = [
  // Monday = 1
  {
    taskKey: "handstandTraining",
    days: [1, 3, 5],
    startTime: "07:30",
  },

  // Tuesday, Thursday, Sunday
  {
    taskKey: "backWalkover",
    days: [2, 4, 0],
    startTime: "07:30",
  },

  // Monday-Friday
  {
    taskKey: "ccnaStudy",
    days: [1, 2, 3, 4, 5],
    startTime: "09:00",
  },

  // Saturday
  {
    taskKey: "ccnaMock",
    days: [6],
    startTime: "09:00",
  },

  // Monday / Friday
  {
    taskKey: "careerDevelopment",
    days: [1, 5],
    startTime: "10:15",
  },

  // Tuesday / Thursday
  {
    taskKey: "jobApplications",
    days: [2, 4],
    startTime: "10:15",
  },

  // Tuesday / Thursday
  {
    taskKey: "walking",
    days: [2, 4],
    startTime: "18:45",
  },

  // Wednesday / Sunday
  {
    taskKey: "swimming",
    days: [3, 0],
    startTime: "18:45",
  },

  // Monday / Thursday
  {
    taskKey: "longboard",
    days: [1, 4],
    startTime: "18:45",
  },

  // Saturday
  {
    taskKey: "skateboard",
    days: [6],
    startTime: "15:00",
  },

  // Wednesday / Saturday
  {
    taskKey: "familyFriends",
    days: [3, 6],
    startTime: "19:30",
  },

  // Friday / Sunday
  {
    taskKey: "protectedFreeTime",
    days: [5, 0],
    startTime: "20:30",
  },
];

export async function setupDefaultPlan() {
  /*
   * Get the logged-in user.
   */

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  if (!session) {
    throw new Error("You must be signed in.");
  }

  const userId = session.user.id;

  /*
   * Check whether setup has already completed.
   */

  const { data: profile } = await supabase
    .from("profiles")
    .select("setup_complete")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.setup_complete) {
    return {
      alreadySetup: true,
    };
  }

  /*
   * Create/update the user's profile.
   */

  const emailName =
    session.user.email?.split("@")[0] ??
    "User";

  const { error: profileError } =
    await supabase.from("profiles").upsert(
      {
        id: userId,
        display_name: emailName,
        timezone: "Asia/Kolkata",
        wake_time: "07:00",
        sleep_time: "23:00",
        setup_complete: false,
      },
      {
        onConflict: "id",
      }
    );

  if (profileError) {
    throw new Error(
      `Profile setup failed: ${profileError.message}`
    );
  }

  /*
   * Create goals.
   */

  const goalRows = goals.map((goal) => ({
    user_id: userId,
    name: goal.name,
    description: goal.description,
    category: goal.category,
    priority: goal.priority,
    target_date: "2026-12-31",
    status: "active",
    progress_percent: 0,
  }));

  const {
    data: createdGoals,
    error: goalError,
  } = await supabase
    .from("goals")
    .insert(goalRows)
    .select("id,name");

  if (goalError) {
    throw new Error(
      `Goal setup failed: ${goalError.message}`
    );
  }

  if (!createdGoals) {
    throw new Error(
      "Goals were not created."
    );
  }

  /*
   * Map goal names back to our internal keys.
   */

  const goalIdByKey: Record<
    string,
    string
  > = {};

  for (const goal of goals) {
    const created = createdGoals.find(
      (item) =>
        item.name === goal.name
    );

    if (!created) {
      throw new Error(
        `Could not find created goal: ${goal.name}`
      );
    }

    goalIdByKey[goal.key] =
      created.id;
  }

  /*
   * Create tasks.
   */

  const taskRows = tasks.map((task) => ({
    user_id: userId,
    goal_id:
      goalIdByKey[task.goalKey] ?? null,
    title: task.title,
    description: task.description,
    category: task.category,
    priority: task.priority,
    duration_minutes: task.duration,
    strict_mode: task.strict,
    max_reminders_per_day:
      task.maxReminders,
    allow_snooze:
      task.allowSnooze,
    status: "active",
  }));

  const {
    data: createdTasks,
    error: taskError,
  } = await supabase
    .from("tasks")
    .insert(taskRows)
    .select("id,title");

  if (taskError) {
    throw new Error(
      `Task setup failed: ${taskError.message}`
    );
  }

  if (!createdTasks) {
    throw new Error(
      "Tasks were not created."
    );
  }

  /*
   * Map task names back to internal keys.
   */

  const taskIdByKey: Record<
    string,
    string
  > = {};

  for (const task of tasks) {
    const created = createdTasks.find(
      (item) =>
        item.title === task.title
    );

    if (!created) {
      throw new Error(
        `Could not find created task: ${task.title}`
      );
    }

    taskIdByKey[task.key] =
      created.id;
  }

  /*
   * Create weekly schedules.
   */

  const scheduleRows = schedules.flatMap(
    (schedule) =>
      schedule.days.map((day) => {
        const taskDefinition =
          tasks.find(
            (task) =>
              task.key ===
              schedule.taskKey
          );

        return {
          task_id:
            taskIdByKey[
              schedule.taskKey
            ],
          user_id: userId,
          day_of_week: day,
          start_time:
            `${schedule.startTime}:00`,
          end_time: null,
          start_date: null,
          end_date: null,
          repeat_type: "weekly",
          reminder_interval_minutes:
            taskDefinition?.reminderInterval ??
            30,
          is_active: true,
        };
      })
  );

  const {
    error: scheduleError,
  } = await supabase
    .from("task_schedules")
    .insert(scheduleRows);

  if (scheduleError) {
    throw new Error(
      `Schedule setup failed: ${scheduleError.message}`
    );
  }

  /*
   * Mark setup as complete.
   */

  const { error: completeError } =
    await supabase
      .from("profiles")
      .update({
        setup_complete: true,
      })
      .eq("id", userId);

  if (completeError) {
    throw new Error(
      `Could not finish setup: ${completeError.message}`
    );
  }

  return {
    alreadySetup: false,
  };
}