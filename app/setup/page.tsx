"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { setupDefaultPlan } from "@/lib/defaultPlan";

export default function SetupPage() {
  const router = useRouter();

  const [checking, setChecking] =
    useState(true);

  const [settingUp, setSettingUp] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    checkSetup();
  }, []);

  const checkSetup = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    const { data: profile } =
      await supabase
        .from("profiles")
        .select("setup_complete")
        .eq("id", session.user.id)
        .maybeSingle();

    if (profile?.setup_complete) {
      router.replace("/");
      return;
    }

    setChecking(false);
  };

  const startSetup = async () => {
    try {
      setSettingUp(true);
      setError("");

      await setupDefaultPlan();

      router.replace("/");
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Could not create your plan."
      );

      setSettingUp(false);
    }
  };

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b0b0f] text-white">
        <p className="text-sm text-zinc-500">
          Checking your setup...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0b0b0f] px-5 text-white">
      <div className="mx-auto flex min-h-screen max-w-md items-center">
        <div className="w-full">

          <div className="mb-8">
            <p className="text-sm text-zinc-600">
              DisciplineTracker
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              Set up your 2026 plan
            </h1>

            <p className="mt-4 text-sm leading-6 text-zinc-500">
              We&apos;ll create your goals, weekly
              tasks and schedules so you can start
              immediately.
            </p>
          </div>

          <div className="space-y-3">

            <PlanItem
              icon="🤸"
              title="Handstand + Back Walkover"
              description="3 focused sessions each week"
            />

            <PlanItem
              icon="📚"
              title="CCNA Certification"
              description="Weekday study + Saturday mock test"
            />

            <PlanItem
              icon="💼"
              title="New Software Developer Job"
              description="Career development + applications"
            />

            <PlanItem
              icon="🚶"
              title="Walking + Swimming"
              description="Regular movement without overloading your week"
            />

            <PlanItem
              icon="🛹"
              title="Longboard + Skateboard"
              description="Weekday longboard + weekend skateboard"
            />

            <PlanItem
              icon="👨‍👩‍👧"
              title="Family + Friends"
              description="Protected social time"
            />

            <PlanItem
              icon="🕐"
              title="Protected Free Time"
              description="Your schedule will not fill every minute"
            />

          </div>

          {error && (
            <div className="mt-5 rounded-2xl border border-red-900/50 bg-red-950/30 p-4">
              <p className="text-sm leading-5 text-red-400">
                {error}
              </p>
            </div>
          )}

          <button
            onClick={startSetup}
            disabled={settingUp}
            className="mt-7 w-full rounded-2xl bg-white px-5 py-4 font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-50"
          >
            {settingUp
              ? "Creating your plan..."
              : "Set Up My Plan"}
          </button>

          <p className="mt-4 text-center text-xs leading-5 text-zinc-700">
            You can edit or delete any task later.
            This only creates your starting plan.
          </p>

        </div>
      </div>
    </main>
  );
}

function PlanItem({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-800 text-lg">
        {icon}
      </div>

      <div>
        <p className="text-sm font-medium">
          {title}
        </p>

        <p className="mt-1 text-xs leading-5 text-zinc-600">
          {description}
        </p>
      </div>
    </div>
  );
}