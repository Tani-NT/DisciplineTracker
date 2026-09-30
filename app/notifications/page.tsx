"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);

  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);

  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function isIOSHomeScreenApp() {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches;

  const iosStandalone =
    "standalone" in window &&
    Boolean(
      (window.navigator as Navigator & {
        standalone?: boolean;
      }).standalone
    );

  return standalone || iosStandalone;
}

export default function NotificationsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [enabling, setEnabling] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] =
    useState<NotificationPermission | null>(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    checkNotificationStatus();
  }, []);

  async function checkNotificationStatus() {
    try {
      if (typeof window === "undefined") return;

      if (!("serviceWorker" in navigator)) {
        setError(
          "Service workers are not supported by this browser."
        );
        return;
      }

      if (typeof Notification === "undefined") {
        setError(
          "Notifications are not available. Open DisciplineTracker from the Home Screen app."
        );
        return;
      }

      setPermission(Notification.permission);

      const registration =
        await navigator.serviceWorker.getRegistration("/");

      if (!registration) {
        setLoading(false);
        return;
      }

      await navigator.serviceWorker.ready;

      const pushManager = registration.pushManager;

      if (!pushManager) {
        setError(
          "Push notifications are not available for this app."
        );
        return;
      }

      const subscription =
        await pushManager.getSubscription();

      if (subscription) {
        setEnabled(true);
      }
    } catch (err) {
      console.error(
        "Failed to check notification status:",
        err
      );
    } finally {
      setLoading(false);
    }
  }

  async function enableNotifications() {
    setEnabling(true);
    setError("");
    setMessage("");

    try {
      if (typeof window === "undefined") {
        throw new Error("Browser environment is required.");
      }

      /*
       * iPhone Web Push works for Home Screen web apps.
       */
      if (!isIOSHomeScreenApp()) {
        throw new Error(
          "Please open DisciplineTracker from the iPhone Home Screen app. Web Push on iPhone requires the installed Home Screen app."
        );
      }

      if (!window.isSecureContext) {
        throw new Error(
          "Notifications require a secure HTTPS connection."
        );
      }

      if (!("serviceWorker" in navigator)) {
        throw new Error(
          "Service workers are not supported."
        );
      }

      if (typeof Notification === "undefined") {
        throw new Error(
          "Notifications are not supported on this device."
        );
      }

      /*
       * Get the currently signed-in user.
       */
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        router.push("/login");
        return;
      }

      /*
       * Register the service worker.
       */
      const registration =
        await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

      /*
       * Wait until the service worker is ready.
       */
      const readyRegistration =
        await navigator.serviceWorker.ready;

      console.log(
        "Service worker registered:",
        registration
      );

      /*
       * PushManager belongs to the ServiceWorkerRegistration.
       */
      const pushManager =
        readyRegistration.pushManager;

      if (!pushManager) {
        throw new Error(
          "Push notifications are not available in this Home Screen app."
        );
      }

      /*
       * Ask iOS for notification permission.
       *
       * This happens directly because the user clicked
       * the Enable Reminders button.
       */
      let notificationPermission =
        Notification.permission;

      if (notificationPermission === "default") {
        notificationPermission =
          await Notification.requestPermission();
      }

      setPermission(notificationPermission);

      if (notificationPermission !== "granted") {
        if (notificationPermission === "denied") {
          throw new Error(
            "Notifications are blocked. Enable notifications for DisciplineTracker in iPhone Settings → Notifications."
          );
        }

        throw new Error(
          "Notification permission was not granted."
        );
      }

      /*
       * Get an existing subscription if one already exists.
       */
      let subscription =
        await pushManager.getSubscription();

      /*
       * Create a new subscription if necessary.
       */
      if (!subscription) {
        const vapidPublicKey =
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

        if (!vapidPublicKey) {
          throw new Error(
            "VAPID public key is missing. Add NEXT_PUBLIC_VAPID_PUBLIC_KEY to your environment variables and restart the app."
          );
        }

        const applicationServerKey =
          urlBase64ToUint8Array(vapidPublicKey);

        subscription =
          await pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey,
          });
      }

      /*
       * Extract the subscription encryption keys.
       */
      const p256dhKey =
        subscription.getKey("p256dh");

      const authKey =
        subscription.getKey("auth");

      if (!p256dhKey || !authKey) {
        throw new Error(
          "The push subscription is missing required encryption keys."
        );
      }

      const p256dh = btoa(
        String.fromCharCode(
          ...new Uint8Array(p256dhKey)
        )
      );

      const auth = btoa(
        String.fromCharCode(
          ...new Uint8Array(authKey)
        )
      );

      /*
       * Save the subscription in Supabase.
       */
      const { error: saveError } = await supabase
        .from("push_subscriptions")
        .upsert(
          {
            user_id: user.id,
            endpoint: subscription.endpoint,
            p256dh,
            auth,
            expiration_time:
              subscription.expirationTime ?? null,
            user_agent: navigator.userAgent,
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,endpoint",
          }
        );

      if (saveError) {
        throw saveError;
      }

      setEnabled(true);

      setMessage(
        "Reminders are enabled. DisciplineTracker can now send task notifications to this iPhone."
      );
    } catch (err) {
      console.error(
        "Failed to enable notifications:",
        err
      );

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(
          "Failed to enable reminders. Please try again."
        );
      }
    } finally {
      setEnabling(false);
    }
  }

  async function disableNotifications() {
    setEnabling(true);
    setError("");
    setMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const registration =
        await navigator.serviceWorker.getRegistration("/");

      if (registration) {
        const subscription =
          await registration.pushManager.getSubscription();

        if (subscription) {
          const endpoint = subscription.endpoint;

          await subscription.unsubscribe();

          await supabase
            .from("push_subscriptions")
            .update({
              is_active: false,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", user.id)
            .eq("endpoint", endpoint);
        }
      }

      setEnabled(false);

      setMessage(
        "Reminders have been disabled on this device."
      );
    } catch (err) {
      console.error(
        "Failed to disable notifications:",
        err
      );

      setError(
        "Failed to disable reminders. Please try again."
      );
    } finally {
      setEnabling(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-xl px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            ← Back
          </button>

          <div>
            <p className="text-xs text-zinc-500">
              DisciplineTracker
            </p>

            <h1 className="text-2xl font-bold">
              Reminders
            </h1>
          </div>
        </div>

        {/* Main card */}
        <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 text-3xl">
            🔔
          </div>

          <h2 className="mt-6 text-xl font-semibold">
            Task Reminders
          </h2>

          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Get a notification on your iPhone when
            your scheduled DisciplineTracker tasks are
            ready.
          </p>

          {/* Status */}
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-400">
                Status
              </span>

              {loading ? (
                <span className="text-sm text-zinc-500">
                  Checking...
                </span>
              ) : enabled ? (
                <span className="text-sm font-medium text-emerald-400">
                  ● Enabled
                </span>
              ) : (
                <span className="text-sm font-medium text-zinc-500">
                  ● Disabled
                </span>
              )}
            </div>

            {permission && (
              <div className="mt-2 text-xs text-zinc-600">
                Notification permission: {permission}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
              <p className="text-sm leading-6 text-red-300">
                {error}
              </p>
            </div>
          )}

          {/* Success */}
          {message && (
            <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="text-sm leading-6 text-emerald-300">
                {message}
              </p>
            </div>
          )}

          {/* Enable / Disable */}
          <div className="mt-6">
            {!enabled ? (
              <button
                onClick={enableNotifications}
                disabled={enabling || loading}
                className="w-full rounded-2xl bg-indigo-600 px-5 py-4 font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {enabling
                  ? "Enabling Reminders..."
                  : "🔔 Enable Reminders"}
              </button>
            ) : (
              <button
                onClick={disableNotifications}
                disabled={enabling}
                className="w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-5 py-4 font-semibold text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-50"
              >
                {enabling
                  ? "Disabling..."
                  : "Disable Reminders"}
              </button>
            )}
          </div>
        </section>

        {/* iPhone instructions */}
        <section className="mt-6 rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6">
          <h2 className="font-semibold">
            iPhone setup
          </h2>

          <ol className="mt-4 space-y-4 text-sm text-zinc-400">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs text-zinc-300">
                1
              </span>

              <span>
                Open DisciplineTracker in Safari.
              </span>
            </li>

            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs text-zinc-300">
                2
              </span>

              <span>
                Use Safari's Share menu and choose
                <strong className="text-zinc-200">
                  {" "}
                  Add to Home Screen
                </strong>
                .
              </span>
            </li>

            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs text-zinc-300">
                3
              </span>

              <span>
                Open DisciplineTracker using the new
                Home Screen icon.
              </span>
            </li>

            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs text-zinc-300">
                4
              </span>

              <span>
                Tap{" "}
                <strong className="text-zinc-200">
                  🔔 Reminders
                </strong>{" "}
                and then{" "}
                <strong className="text-zinc-200">
                  Enable Reminders
                </strong>
                .
              </span>
            </li>

            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs text-zinc-300">
                5
              </span>

              <span>
                When iPhone asks for notification
                permission, choose{" "}
                <strong className="text-zinc-200">
                  Allow
                </strong>
                .
              </span>
            </li>
          </ol>
        </section>
      </div>
    </main>
  );
}
