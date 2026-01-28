"use client";

import { useEffect, useMemo, useState } from "react";

type MasterItem = { name: string; done: boolean };
type StepItem = { step: number; task: string; minutes: number };

type Plan = {
  daily_master_7: MasterItem[];
  todays_plan: {
    good_day: { total_minutes: number; steps: StepItem[] };
    bad_day_minimum: { total_minutes: number; steps: StepItem[] };
  };
};

const CURRENT_KEY = "lifeos_state_v2_current";
const HISTORY_KEY = "lifeos_state_v2_history";

type HistoryDay = {
  date: string; // YYYY-MM-DD
  mode: "good" | "bad";
  daily_done: Record<string, boolean>;
  steps_done: Record<string, boolean>;
  last_generated_at?: string;
};

type SavedState = {
  mode: "good" | "bad";
  selected_date: string; // which day you are viewing
  daily_done: Record<string, boolean>;
  steps_done: Record<string, boolean>;
  last_reset_date?: string; // YYYY-MM-DD
  last_generated_at?: string;
};

function defaultSavedState(): SavedState {
  const today = todayKey();
  return {
    mode: "good",
    selected_date: today,
    daily_done: {},
    steps_done: {},
    last_reset_date: today,
  };
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function stepKey(mode: "good" | "bad", stepNumber: number) {
  return `${mode}:${stepNumber}`;
}

function addDays(dateKey: string, delta: number) {
  const d = new Date(dateKey + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function loadHistory(): Record<string, HistoryDay> {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, HistoryDay>;
  } catch {
    return {};
  }
}

function saveHistory(history: Record<string, HistoryDay>) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // ignore
  }
}

/* =========================
   CSV EXPORT HELPERS (NEW)
========================= */

function monthPrefix(dateKey: string) {
  // "2026-01-27" -> "2026-01"
  return dateKey.slice(0, 7);
}

function toCsvRow(values: (string | number)[]) {
  return values
    .map((v) => {
      const s = String(v ?? "");
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replaceAll('"', '""')}"`;
      }
      return s;
    })
    .join(",");
}

function downloadTextFile(filename: string, content: string, mime = "text/csv") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [saved, setSaved] = useState<SavedState>(defaultSavedState());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  const today = todayKey();

  // Load current + auto-reset for "today"
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CURRENT_KEY);
      const base = defaultSavedState();

      if (!raw) {
        setSaved(base);
        return;
      }

      const parsed = JSON.parse(raw) as SavedState;

      // Auto-reset only affects TODAY
      const needsResetToday = parsed.last_reset_date !== today;

      const next: SavedState = {
        ...base,
        ...parsed,
        mode: parsed?.mode ?? "good",
        selected_date: parsed?.selected_date ?? today,
        last_reset_date: today,
        daily_done: needsResetToday ? {} : (parsed.daily_done || {}),
        steps_done: needsResetToday ? {} : (parsed.steps_done || {}),
      };

      setSaved(next);

      // If reset happened and plan is visible, clear UI daily checkboxes
      if (needsResetToday) {
        setPlan((p) => {
          if (!p) return p;
          return {
            ...p,
            daily_master_7: p.daily_master_7.map((it) => ({ ...it, done: false })),
          };
        });
      }
    } catch {
      setSaved(defaultSavedState());
    }
  }, [today]);

  // Persist CURRENT state whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(CURRENT_KEY, JSON.stringify(saved));
    } catch {
      // ignore
    }
  }, [saved]);

  // Write TODAY snapshot into history when today's data changes
  useEffect(() => {
    if (saved.selected_date !== today) return; // only snapshot today
    const history = loadHistory();
    history[today] = {
      date: today,
      mode: saved.mode,
      daily_done: saved.daily_done,
      steps_done: saved.steps_done,
      last_generated_at: saved.last_generated_at,
    };
    saveHistory(history);
  }, [
    saved.daily_done,
    saved.steps_done,
    saved.mode,
    saved.last_generated_at,
    saved.selected_date,
    today,
  ]);

  const history = useMemo(
    () => loadHistory(),
    [saved.daily_done, saved.steps_done, saved.mode, saved.last_generated_at, saved.selected_date, today]
  );

  const last7Dates = useMemo(() => {
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) dates.push(addDays(today, -i));
    return dates;
  }, [today]);

  const viewingToday = saved.selected_date === today;

  const viewData: HistoryDay | null = useMemo(() => {
    if (viewingToday) {
      return {
        date: today,
        mode: saved.mode,
        daily_done: saved.daily_done,
        steps_done: saved.steps_done,
        last_generated_at: saved.last_generated_at,
      };
    }
    return history[saved.selected_date] ?? null;
  }, [history, saved, viewingToday, today]);

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const resp = await fetch("/api/coach"); // GET
      if (!resp.ok) throw new Error(`API error: ${resp.status}`);

      const data = (await resp.json()) as Plan;

      const merged: Plan = {
        ...data,
        daily_master_7: data.daily_master_7.map((item) => ({
          ...item,
          done: viewData?.daily_done?.[item.name] ?? false,
        })),
      };

      setPlan(merged);

      if (viewingToday) {
        setSaved((prev) => ({ ...prev, last_generated_at: new Date().toISOString() }));
      }
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function setMode(mode: "good" | "bad") {
    if (!viewingToday) return;
    setSaved((prev) => ({ ...prev, mode }));
  }

  function toggleDaily(name: string) {
    if (!viewingToday) return;
    setSaved((prev) => {
      const current = prev.daily_done[name] ?? false;
      const nextDailyDone = { ...prev.daily_done, [name]: !current };

      setPlan((p) => {
        if (!p) return p;
        return {
          ...p,
          daily_master_7: p.daily_master_7.map((it) =>
            it.name === name ? { ...it, done: !current } : it
          ),
        };
      });

      return { ...prev, daily_done: nextDailyDone };
    });
  }

  function toggleStep(which: "good" | "bad", stepNumber: number) {
    if (!viewingToday) return;
    const key = stepKey(which, stepNumber);
    setSaved((prev) => {
      const current = prev.steps_done[key] ?? false;
      return { ...prev, steps_done: { ...prev.steps_done, [key]: !current } };
    });
  }

  function resetForToday() {
    if (!viewingToday) return;
    setSaved((prev) => ({ ...prev, daily_done: {}, steps_done: {} }));
    setPlan((p) => {
      if (!p) return p;
      return {
        ...p,
        daily_master_7: p.daily_master_7.map((it) => ({ ...it, done: false })),
      };
    });
  }

  // ===== CSV EXPORT (NEW) =====
  function downloadMonthCsv() {
    const month = monthPrefix(today); // e.g., "2026-01"
    const hist = loadHistory();

    const rows: string[] = [];
    rows.push(toCsvRow(["date", "mode", "daily_done_count", "steps_done_count", "generated_at"]));

    // all stored history dates for current month
    const monthDates = Object.keys(hist)
      .filter((d) => d.startsWith(month))
      .sort();

    // ensure today included even if not yet in history (rare, but safe)
    const dates = monthDates.includes(today) ? monthDates : [...monthDates, today].sort();

    for (const d of dates) {
      const day: HistoryDay | undefined =
        d === today
          ? {
              date: today,
              mode: saved.mode,
              daily_done: saved.daily_done,
              steps_done: saved.steps_done,
              last_generated_at: saved.last_generated_at,
            }
          : hist[d];

      if (!day) continue;

      const dailyCount = Object.values(day.daily_done || {}).filter(Boolean).length;
      const stepsCount = Object.values(day.steps_done || {}).filter(Boolean).length;
      const generatedAt = day.last_generated_at ?? "";

      rows.push(toCsvRow([d, day.mode, dailyCount, stepsCount, generatedAt]));
    }

    const csv = rows.join("\n");
    downloadTextFile(`life-os_${month}.csv`, csv, "text/csv");
  }

  const steps = useMemo(() => {
    if (!plan) return [];
    if (saved.mode === "good") return plan.todays_plan.good_day.steps;
    return plan.todays_plan.bad_day_minimum.steps;
  }, [plan, saved.mode]);

  const totalMinutes = useMemo(() => {
    if (!plan) return 0;
    return saved.mode === "good"
      ? plan.todays_plan.good_day.total_minutes
      : plan.todays_plan.bad_day_minimum.total_minutes;
  }, [plan, saved.mode]);

  function selectDate(date: string) {
    setSaved((prev) => ({ ...prev, selected_date: date }));
  }

  const yesterday = addDays(today, -1);

  const dailyCompletedCount = useMemo(() => {
    const d = viewData?.daily_done || {};
    return Object.values(d).filter(Boolean).length;
  }, [viewData]);

  const stepsCompletedCount = useMemo(() => {
    const s = viewData?.steps_done || {};
    return Object.values(s).filter(Boolean).length;
  }, [viewData]);

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold">Life OS</h1>
      <p className="text-gray-600 mt-1">One button. One plan. No guessing.</p>

      {/* History selector */}
      <section className="mt-6 p-4 rounded border">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">View:</span>

          <button
            onClick={() => selectDate(today)}
            className={`px-3 py-2 rounded border ${saved.selected_date === today ? "bg-gray-200" : ""}`}
          >
            Today
          </button>

          <button
            onClick={() => selectDate(yesterday)}
            className={`px-3 py-2 rounded border ${saved.selected_date === yesterday ? "bg-gray-200" : ""}`}
          >
            Yesterday
          </button>

          <select
            value={saved.selected_date}
            onChange={(e) => selectDate(e.target.value)}
            className="px-3 py-2 rounded border"
            title="Last 7 days"
          >
            {last7Dates.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <span className="text-sm text-gray-600">
            {viewingToday ? "(editable)" : "(read-only history)"}
          </span>
        </div>

        <div className="mt-3 text-sm text-gray-700">
          <div>
            <b>Daily done:</b> {dailyCompletedCount}/7
          </div>
          <div>
            <b>Steps done:</b> {stepsCompletedCount}
          </div>
        </div>
      </section>

      <div className="mt-6 flex flex-wrap gap-3 items-center">
        <button
          onClick={generate}
          disabled={loading}
          className="px-4 py-2 rounded bg-black text-white disabled:opacity-60"
        >
          {loading ? "Generating..." : "Generate Today Plan"}
        </button>

        <div className="flex gap-2">
          <button
            onClick={() => setMode("good")}
            className={`px-3 py-2 rounded border ${saved.mode === "good" ? "bg-gray-200" : ""}`}
            disabled={!viewingToday}
            title={viewingToday ? "Switch mode" : "History is read-only"}
          >
            Good Day
          </button>
          <button
            onClick={() => setMode("bad")}
            className={`px-3 py-2 rounded border ${saved.mode === "bad" ? "bg-gray-200" : ""}`}
            disabled={!viewingToday}
            title={viewingToday ? "Switch mode" : "History is read-only"}
          >
            Bad Day Minimum
          </button>
        </div>

        <button
          onClick={resetForToday}
          className="px-3 py-2 rounded border"
          title="Clears today’s checkboxes"
          disabled={!viewingToday}
        >
          Reset checkboxes
        </button>

        <button
          onClick={downloadMonthCsv}
          className="px-3 py-2 rounded border"
          title="Download this month as a CSV file"
        >
          Download Month CSV
        </button>
      </div>

      {error && (
        <div className="mt-4 p-3 rounded border border-red-400 text-red-700 bg-red-50">
          {error}
        </div>
      )}

      {!plan && (
        <div className="mt-6 p-4 rounded border text-gray-700">
          Click <b>Generate Today Plan</b> to load your plan. Then check items as you finish them.
          Today auto-saves. History is read-only.
        </div>
      )}

      {plan && viewData && (
        <div className="mt-6 grid gap-6">
          <section className="p-4 rounded border">
            <h2 className="font-semibold text-lg">Daily Master 7</h2>
            <ul className="mt-3 grid gap-2">
              {plan.daily_master_7.map((item) => (
                <li key={item.name} className="flex gap-2 items-center">
                  <input
                    type="checkbox"
                    checked={viewData.daily_done[item.name] ?? false}
                    onChange={() => toggleDaily(item.name)}
                    disabled={!viewingToday}
                  />
                  <span className={(viewData.daily_done[item.name] ?? false) ? "line-through text-gray-500" : ""}>
                    {item.name}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-500 mt-3">
              {viewingToday ? "Saved locally on this computer." : "History view (read-only)."}
            </p>
          </section>

          <section className="p-4 rounded border">
            <h2 className="font-semibold text-lg">
              Today’s Plan ({saved.mode === "good" ? "Good Day" : "Bad Day Minimum"})
            </h2>
            <p className="text-gray-600 mt-1">Total: {totalMinutes} minutes</p>

            <ul className="mt-3 grid gap-2">
              {steps.map((s) => {
                const key = stepKey(saved.mode, s.step);
                const done = viewData.steps_done[key] ?? false;

                return (
                  <li key={key} className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={done}
                      onChange={() => toggleStep(saved.mode, s.step)}
                      disabled={!viewingToday}
                    />
                    <div>
                      <div className={done ? "line-through text-gray-500" : "font-medium"}>
                        {s.task}
                      </div>
                      <div className="text-gray-600 text-sm">({s.minutes} min)</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}
    </main>
  );
}
