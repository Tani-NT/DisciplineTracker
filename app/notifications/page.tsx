"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

function urlBase64ToUint8Array(
  base64String: string
) {
  const padding = "=".repeat(
    (4 - (base64String.length % 4)) % 4
  );

  const base64 =
    (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");

  const rawData = window.atob(base64);

  return Uint8Array.from(
    [...rawData].map((char) =>
      char.charCodeAt(0)
    )
  );
}

export default function NotificationsPage() {
  const [status, setStatus] =
    useState("Not enabled");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  async function enableNotifications() {
    setLoading(true);
    setError("");

    try {
      if (!("serviceWorker" in navigator)) {
        throw new Error(
          "This browser does not support service workers."
        );
      }

      if (!("PushManager" in window)) {
        throw new Error(
          "Push notifications are not supported by this browser."
        );
      }

      if (!("Notification" in window)) {
        throw new Error(
          "Notifications are not supported by this browser."
        );
      }

      const {
        data: {
          user,
        },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "Please sign in before enabling reminders."
        );
      }

      const permission =
        await Notification.requestPermission();

      if (permission !== "granted") {
        setStatus(
          "Notification permission was not granted."
        );

        return;
      }

      const registration =
        await navigator.serviceWorker.register(
          "/sw.js"
        );

      await navigator.serviceWorker.ready;

      const existingSubscription =
        await registration.pushManager.getSubscription();

      let subscription =
        existingSubscription;

      if (!subscription) {
        const publicKey =
          process.env
            .NEXT_PUBLIC_VAPID_PUBLIC_KEY;

        if (!publicKey) {
          throw new Error(
            "VAPID public key is missing."
          );
        }

        subscription =
          await registration.pushManager.subscribe(
            {
              userVisibleOnly: true,
              applicationServerKey:
                urlBase64ToUint8Array(
                  publicKey
                ),
            }
          );
      }

      const json =
        subscription.toJSON();

      if (
        !json.endpoint ||
        !json.keys?.p256dh ||
        !json.keys?.auth
      ) {
        throw new Error(
          "The browser did not return a valid push subscription."
        );
      }

      const {
        error: saveError,
      } = await supabase
        .from("push_subscriptions")
        .upsert(
          {
            user_id: user.id,
            endpoint: json.endpoint,
            p256dh: json.keys.p256dh,
            auth: json.keys.auth,
            expiration_time:
              json.expirationTime || null,
            user_agent:
              navigator.userAgent,
            is_active: true,
            updated_at:
              new Date().toISOString(),
          },
          {
            onConflict:
              "user_id,endpoint",
          }
        );

      if (saveError) {
        throw saveError;
      }

      setStatus(
        "Reminders are enabled 🔔"
      );
    } catch (err) {
      console.error(
        "Notification setup failed:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to enable notifications."
      );

      setStatus("Setup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#09090b] px-4 py-8 text-white">
      <div className="mx-auto max-w-xl">
        <a
          href="/"
          className="text-sm text-zinc-500 hover:text-zinc-300"
        >
          ← Dashboard
        </a>

        <div className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-800 text-2xl">
            🔔
          </div>

          <h1 className="mt-5 text-2xl font-bold">
            Task Reminders
          </h1>

          <p className="mt-2 text-sm leading-6 text-zinc-500">
            DisciplineTracker can remind you when your
            scheduled activities are due.
          </p>

          <div className="mt-6 rounded-2xl bg-zinc-950 p-4">
            <p className="text-xs uppercase tracking-wider text-zinc-600">
              Status
            </p>

            <p className="mt-2 font-medium">
              {status}
            </p>
          </div>

          {error && (
            <div className="mt-4 rounded-2xl border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            onClick={enableNotifications}
            disabled={loading}
            className="mt-6 w-full rounded-2xl bg-white px-5 py-4 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Enabling..."
              : "Enable Reminders"}
          </button>

          <p className="mt-4 text-center text-xs leading-5 text-zinc-600">
            On iPhone, install DisciplineTracker on
            your Home Screen first, then enable
            notifications.
          </p>
        </div>
      </div>
    </main>
  );
}