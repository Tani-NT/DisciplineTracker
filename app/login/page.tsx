"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        router.replace("/setup");
      }
    };

    checkSession();
  }, [router]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    setLoading(true);
    setMessage("");

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }

      if (data.session) {
        router.replace("/setup");
      } else {
        setMessage(
          "Account created. Check your email to confirm your account, then sign in."
        );
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }

      router.replace("/setup");
    }

    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-[#0b0b0f] px-5 text-white">
      <div className="mx-auto flex min-h-screen max-w-md items-center">
        <div className="w-full">
          <div className="mb-10">
            <p className="text-sm text-zinc-500">DisciplineTracker</p>

            <h1 className="mt-2 text-3xl font-bold">
              {isSignUp ? "Create your account" : "Welcome back"}
            </h1>

            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Build consistency without trying to fill every minute of your
              day.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm text-zinc-400">
                Email
              </label>

              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-4
                           text-white outline-none placeholder:text-zinc-600
                           focus:border-zinc-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-400">
                Password
              </label>

              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-4
                           text-white outline-none placeholder:text-zinc-600
                           focus:border-zinc-500"
              />
            </div>

            {message && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-300">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-white px-4 py-4 font-semibold text-black
                         transition hover:bg-zinc-200 disabled:opacity-50"
            >
              {loading
                ? "Please wait..."
                : isSignUp
                ? "Create Account"
                : "Sign In"}
            </button>
          </form>

          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setMessage("");
            }}
            className="mt-6 w-full text-center text-sm text-zinc-500"
          >
            {isSignUp
              ? "Already have an account? Sign in"
              : "Don't have an account? Create one"}
          </button>
        </div>
      </div>
    </main>
  );
}