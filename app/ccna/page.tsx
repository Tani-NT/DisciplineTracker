"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type MockTest = {
  id: string;
  test_name: string;
  test_date: string;
  total_questions: number;
  correct_answers: number;
  score_percent: number;
  notes: string | null;
};

type TopicScore = {
  id: string;
  mock_test_id: string | null;
  topic: string;
  score_percent: number;
};

const TOPICS = [
  "Network Fundamentals",
  "Network Access",
  "IP Connectivity",
  "IP Services",
  "Security Fundamentals",
  "Automation & Programmability",
];

function formatDate(dateString: string) {
  const [year, month, day] = dateString
    .split("-")
    .map(Number);

  const date = new Date(year, month - 1, day);

  const monthName = date.toLocaleDateString(
    "en-US",
    {
      month: "short",
    }
  );

  return `${monthName} ${day}, ${year}`;
}

function getScoreLabel(score: number) {
  if (score >= 80) return "Strong";
  if (score >= 70) return "Good";
  if (score >= 60) return "Needs Work";
  return "Focus Needed";
}

function getScoreClass(score: number) {
  if (score >= 80) {
    return "bg-emerald-500/10 text-emerald-300";
  }

  if (score >= 70) {
    return "bg-blue-500/10 text-blue-300";
  }

  if (score >= 60) {
    return "bg-amber-500/10 text-amber-300";
  }

  return "bg-red-500/10 text-red-300";
}

export default function CCNAPage() {
  const [tests, setTests] = useState<MockTest[]>([]);
  const [topicScores, setTopicScores] = useState<
    TopicScore[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showTestModal, setShowTestModal] =
    useState(false);

  const [testName, setTestName] = useState("");
  const [testDate, setTestDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [totalQuestions, setTotalQuestions] =
    useState("100");
  const [correctAnswers, setCorrectAnswers] =
    useState("");
  const [notes, setNotes] = useState("");

  const [topicForm, setTopicForm] = useState<
    Record<string, string>
  >({});

  async function loadCCNAData() {
    setLoading(true);
    setError("");

    try {
      const [
        testsResult,
        topicScoresResult,
      ] = await Promise.all([
        supabase
          .from("ccna_mock_tests")
          .select(
            `
              id,
              test_name,
              test_date,
              total_questions,
              correct_answers,
              score_percent,
              notes
            `
          )
          .order("test_date", {
            ascending: false,
          }),

        supabase
          .from("ccna_topic_scores")
          .select(
            `
              id,
              mock_test_id,
              topic,
              score_percent
            `
          ),
      ]);

      if (testsResult.error) {
        throw testsResult.error;
      }

      if (topicScoresResult.error) {
        throw topicScoresResult.error;
      }

      setTests(
        (testsResult.data || []) as MockTest[]
      );

      setTopicScores(
        (topicScoresResult.data ||
          []) as TopicScore[]
      );
    } catch (err) {
      console.error(
        "Failed to load CCNA data:",
        err
      );

      setError(
        "Unable to load your CCNA progress."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCCNAData();
  }, []);

  const overallScore = useMemo(() => {
    if (tests.length === 0) {
      return 0;
    }

    const total = tests.reduce(
      (sum, test) =>
        sum + Number(test.score_percent),
      0
    );

    return Math.round(total / tests.length);
  }, [tests]);

  const latestTest = tests[0];

  const topicAverages = useMemo(() => {
    const result: Record<
      string,
      {
        average: number;
        attempts: number;
      }
    > = {};

    for (const topic of TOPICS) {
      const scores = topicScores.filter(
        (item) => item.topic === topic
      );

      if (scores.length === 0) {
        result[topic] = {
          average: 0,
          attempts: 0,
        };

        continue;
      }

      const total = scores.reduce(
        (sum, item) =>
          sum + Number(item.score_percent),
        0
      );

      result[topic] = {
        average: Math.round(
          total / scores.length
        ),
        attempts: scores.length,
      };
    }

    return result;
  }, [topicScores]);

  const weakestTopic = useMemo(() => {
    const available = TOPICS
      .map((topic) => ({
        topic,
        average:
          topicAverages[topic]?.average || 0,
        attempts:
          topicAverages[topic]?.attempts || 0,
      }))
      .filter((item) => item.attempts > 0)
      .sort(
        (a, b) => a.average - b.average
      );

    return available[0] || null;
  }, [topicAverages]);

  function resetTestForm() {
    setTestName("");
    setTestDate(
      new Date().toISOString().split("T")[0]
    );
    setTotalQuestions("100");
    setCorrectAnswers("");
    setNotes("");
    setTopicForm({});
  }

  function calculateScore() {
    const total = Number(totalQuestions);
    const correct = Number(correctAnswers);

    if (
      !total ||
      total <= 0 ||
      correct < 0 ||
      correct > total
    ) {
      return 0;
    }

    return Math.round(
      (correct / total) * 100
    );
  }

  async function saveMockTest() {
    const total = Number(totalQuestions);
    const correct = Number(correctAnswers);

    if (
      !testName.trim() ||
      !testDate ||
      !total ||
      correct < 0 ||
      correct > total
    ) {
      setError(
        "Please enter a valid test name, date, question count, and score."
      );

      return;
    }

    setSaving(true);
    setError("");

    try {
      const scorePercent =
        Math.round(
          (correct / total) * 10000
        ) / 100;

      const {
        data: insertedTest,
        error: insertError,
      } = await supabase
        .from("ccna_mock_tests")
        .insert({
          test_name: testName.trim(),
          test_date: testDate,
          total_questions: total,
          correct_answers: correct,
          score_percent: scorePercent,
          notes: notes.trim() || null,
        })
        .select(
          `
            id,
            test_name,
            test_date,
            total_questions,
            correct_answers,
            score_percent,
            notes
          `
        )
        .single();

      if (insertError) {
        throw insertError;
      }

      if (!insertedTest) {
        throw new Error(
          "Mock test was not created."
        );
      }

      const topicRows = TOPICS
        .filter(
          (topic) =>
            topicForm[topic] !== undefined &&
            topicForm[topic] !== ""
        )
        .map((topic) => ({
          mock_test_id: insertedTest.id,
          topic,
          score_percent: Number(
            topicForm[topic]
          ),
        }))
        .filter(
          (item) =>
            !Number.isNaN(
              item.score_percent
            ) &&
            item.score_percent >= 0 &&
            item.score_percent <= 100
        );

      if (topicRows.length > 0) {
        const {
          error: topicError,
        } = await supabase
          .from("ccna_topic_scores")
          .insert(topicRows);

        if (topicError) {
          throw topicError;
        }
      }

      setTests((current) => [
        insertedTest as MockTest,
        ...current,
      ]);

      setShowTestModal(false);
      resetTestForm();

      await loadCCNAData();
    } catch (err) {
      console.error(
        "Failed to save mock test:",
        err
      );

      setError(
        "Unable to save the mock test. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  const calculatedScore =
    calculateScore();

  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <a
              href="/goals"
              className="text-sm text-zinc-500 transition hover:text-zinc-300"
            >
              ← Goals
            </a>

            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              CCNA Progress
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
              Track your mock-test performance and
              identify the networking topics that need
              more practice.
            </p>
          </div>

          <button
            onClick={() =>
              setShowTestModal(true)
            }
            className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
          >
            + Add Mock Test
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-900/50 bg-red-950/20 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid gap-5 md:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-36 animate-pulse rounded-3xl border border-zinc-800 bg-zinc-900"
              />
            ))}
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
                <p className="text-xs uppercase tracking-wider text-zinc-600">
                  Average Score
                </p>

                <div className="mt-2 flex items-end gap-2">
                  <span className="text-4xl font-bold">
                    {overallScore}%
                  </span>

                  <span
                    className={`mb-1 rounded-full px-2 py-1 text-[10px] font-medium ${getScoreClass(
                      overallScore
                    )}`}
                  >
                    {getScoreLabel(
                      overallScore
                    )}
                  </span>
                </div>
              </div>

              <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
                <p className="text-xs uppercase tracking-wider text-zinc-600">
                  Mock Tests
                </p>

                <p className="mt-2 text-4xl font-bold">
                  {tests.length}
                </p>

                <p className="mt-1 text-xs text-zinc-600">
                  completed tests
                </p>
              </div>

              <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5">
                <p className="text-xs uppercase tracking-wider text-zinc-600">
                  Latest Score
                </p>

                <p className="mt-2 text-4xl font-bold">
                  {latestTest
                    ? `${Number(
                        latestTest.score_percent
                      )}%`
                    : "—"}
                </p>

                <p className="mt-1 text-xs text-zinc-600">
                  {latestTest
                    ? formatDate(
                        latestTest.test_date
                      )
                    : "No mock test yet"}
                </p>
              </div>
            </div>

            {/* Weakest topic */}
            {weakestTopic && (
              <div className="mt-5 rounded-3xl border border-amber-900/40 bg-amber-950/10 p-5">
                <div className="flex items-start gap-3">
                  <div className="text-xl">
                    🎯
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-amber-500">
                      Focus Topic
                    </p>

                    <h2 className="mt-1 text-lg font-semibold">
                      {weakestTopic.topic}
                    </h2>

                    <p className="mt-1 text-sm text-zinc-500">
                      Current average:{" "}
                      {weakestTopic.average}%
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Topics */}
            <section className="mt-8">
              <div className="mb-4">
                <h2 className="text-xl font-semibold">
                  Topic Progress
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Your average score for each CCNA domain.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {TOPICS.map((topic) => {
                  const average =
                    topicAverages[topic]
                      ?.average || 0;

                  const attempts =
                    topicAverages[topic]
                      ?.attempts || 0;

                  return (
                    <div
                      key={topic}
                      className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h3 className="font-medium">
                            {topic}
                          </h3>

                          <p className="mt-1 text-xs text-zinc-600">
                            {attempts === 0
                              ? "No attempts yet"
                              : `${attempts} ${
                                  attempts ===
                                  1
                                    ? "attempt"
                                    : "attempts"
                                }`}
                          </p>
                        </div>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${getScoreClass(
                            average
                          )}`}
                        >
                          {attempts > 0
                            ? `${average}%`
                            : "—"}
                        </span>
                      </div>

                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className={`h-full rounded-full transition-all ${
                            average >= 80
                              ? "bg-emerald-500"
                              : average >=
                                  70
                                ? "bg-blue-500"
                                : average >=
                                    60
                                  ? "bg-amber-500"
                                  : "bg-red-500"
                          }`}
                          style={{
                            width: `${average}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Mock test history */}
            <section className="mt-8">
              <div className="mb-4">
                <h2 className="text-xl font-semibold">
                  Mock Test History
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Keep every test so you can see whether
                  your scores are improving.
                </p>
              </div>

              {tests.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/40 p-8 text-center">
                  <div className="text-3xl">
                    📝
                  </div>

                  <h3 className="mt-3 font-semibold">
                    No mock tests yet
                  </h3>

                  <p className="mt-1 text-sm text-zinc-500">
                    Add your first CCNA mock test after
                    taking it.
                  </p>

                  <button
                    onClick={() =>
                      setShowTestModal(true)
                    }
                    className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black"
                  >
                    Add First Test
                  </button>
                </div>
              ) : (
                <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/70">
                  <div className="hidden grid-cols-[1fr_130px_120px_120px] border-b border-zinc-800 px-5 py-3 text-xs uppercase tracking-wider text-zinc-600 sm:grid">
                    <span>Test</span>
                    <span>Date</span>
                    <span>Score</span>
                    <span>Result</span>
                  </div>

                  <div>
                    {tests.map((test) => (
                      <div
                        key={test.id}
                        className="grid gap-2 border-b border-zinc-800 px-5 py-4 last:border-b-0 sm:grid-cols-[1fr_130px_120px_120px] sm:items-center"
                      >
                        <div>
                          <p className="font-medium">
                            {test.test_name}
                          </p>

                          <p className="mt-1 text-xs text-zinc-600">
                            {test.correct_answers}{" "}
                            /{" "}
                            {test.total_questions}{" "}
                            correct
                          </p>
                        </div>

                        <div className="text-sm text-zinc-500">
                          {formatDate(
                            test.test_date
                          )}
                        </div>

                        <div className="text-lg font-semibold">
                          {Number(
                            test.score_percent
                          )}
                          %
                        </div>

                        <div>
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getScoreClass(
                              Number(
                                test.score_percent
                              )
                            )}`}
                          >
                            {getScoreLabel(
                              Number(
                                test.score_percent
                              )
                            )}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </>
        )}

        {/* Add Mock Test Modal */}
        {showTestModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-zinc-800 bg-[#111113] shadow-2xl">
              <div className="sticky top-0 flex items-center justify-between border-b border-zinc-800 bg-[#111113] px-5 py-4">
                <div>
                  <h2 className="text-lg font-semibold">
                    Add Mock Test
                  </h2>

                  <p className="mt-1 text-xs text-zinc-600">
                    Record your result and optionally add
                    topic scores.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setShowTestModal(false);
                    resetTestForm();
                  }}
                  className="rounded-xl px-3 py-2 text-zinc-500 hover:bg-zinc-800 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-5 p-5">
                {/* Test details */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-xs font-medium text-zinc-400">
                      Test Name
                    </label>

                    <input
                      value={testName}
                      onChange={(event) =>
                        setTestName(
                          event.target.value
                        )
                      }
                      placeholder="CCNA Mock Test #1"
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm outline-none transition placeholder:text-zinc-700 focus:border-zinc-600"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-medium text-zinc-400">
                      Test Date
                    </label>

                    <input
                      type="date"
                      value={testDate}
                      onChange={(event) =>
                        setTestDate(
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-zinc-600"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-medium text-zinc-400">
                      Total Questions
                    </label>

                    <input
                      type="number"
                      min="1"
                      value={totalQuestions}
                      onChange={(event) =>
                        setTotalQuestions(
                          event.target.value
                        )
                      }
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm outline-none focus:border-zinc-600"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-medium text-zinc-400">
                      Correct Answers
                    </label>

                    <input
                      type="number"
                      min="0"
                      value={correctAnswers}
                      onChange={(event) =>
                        setCorrectAnswers(
                          event.target.value
                        )
                      }
                      placeholder="72"
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm outline-none placeholder:text-zinc-700 focus:border-zinc-600"
                    />
                  </div>

                  <div className="flex items-end">
                    <div className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
                      <p className="text-xs text-zinc-600">
                        Calculated Score
                      </p>

                      <p className="mt-1 text-2xl font-bold">
                        {calculatedScore}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* Topic scores */}
                <div>
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold">
                      Topic Scores
                    </h3>

                    <p className="mt-1 text-xs text-zinc-600">
                      Optional. Enter the percentage for
                      each domain if your mock test provides
                      domain-level results.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {TOPICS.map((topic) => (
                      <div
                        key={topic}
                        className="flex items-center gap-3"
                      >
                        <label className="min-w-0 flex-1 text-sm text-zinc-400">
                          {topic}
                        </label>

                        <div className="relative w-24">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={
                              topicForm[topic] ??
                              ""
                            }
                            onChange={(event) =>
                              setTopicForm(
                                (current) => ({
                                  ...current,
                                  [topic]:
                                    event.target
                                      .value,
                                })
                              )
                            }
                            placeholder="—"
                            className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 pr-7 text-sm outline-none placeholder:text-zinc-700 focus:border-zinc-600"
                          />

                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-700">
                            %
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="mb-2 block text-xs font-medium text-zinc-400">
                    Notes
                  </label>

                  <textarea
                    value={notes}
                    onChange={(event) =>
                      setNotes(event.target.value)
                    }
                    rows={3}
                    placeholder="Topics I struggled with..."
                    className="w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm outline-none placeholder:text-zinc-700 focus:border-zinc-600"
                  />
                </div>
              </div>

              <div className="flex gap-3 border-t border-zinc-800 p-5">
                <button
                  onClick={() => {
                    setShowTestModal(false);
                    resetTestForm();
                  }}
                  className="flex-1 rounded-xl border border-zinc-800 px-4 py-3 text-sm font-medium text-zinc-400 transition hover:bg-zinc-900 hover:text-white"
                >
                  Cancel
                </button>

                <button
                  onClick={saveMockTest}
                  disabled={saving}
                  className="flex-1 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : "Save Mock Test"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}