"use client";

import { useEffect, useMemo, useState } from "react";

type Mode = "good" | "bad";
type MasterItem = { name: string; done: boolean };
type StepItem = { step: number; task: string; minutes: number };

type Plan = {
  daily_master_7: MasterItem[];
  todays_plan: {
    good_day: { total_minutes: number; steps: StepItem[] };
    bad_day_minimum: { total_minutes: number; steps: StepItem[] };
  };
};

type HistoryDay = {
  date: string;
  mode: Mode;
  daily_done: Record<string, boolean>;
  steps_done: Record<string, boolean>;
  last_generated_at?: string;
};

type SavedState = {
  mode: Mode;
  selected_date: string;
  daily_done: Record<string, boolean>;
  steps_done: Record<string, boolean>;
  last_reset_date?: string;
  last_generated_at?: string;
};

const CURRENT_KEY = "lifeos_state_v2_current";
const HISTORY_KEY = "lifeos_state_v2_history";
const MASTER_TOTAL = 7;
const DAILY_MASTER_ITEMS = [
  "Sleep window",
  "Move body",
  "Daily reset",
  "One focus block",
  "Eat protein",
  "No comparison",
  "Save something ($1 counts)",
];

const modeCopy: Record<Mode, { label: string; description: string }> = {
  good: {
    label: "Good Day",
    description: "For days when you can handle the full plan.",
  },
  bad: {
    label: "Bad Day Minimum",
    description: "For days when you only have enough energy for the basics.",
  },
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

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

function stepKey(mode: Mode, stepNumber: number) {
  return `${mode}:${stepNumber}`;
}

function addDays(dateKey: string, delta: number) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + delta);
  return date.toISOString().slice(0, 10);
}

function formatDate(dateKey: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date(`${dateKey}T00:00:00`));
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
    // Local storage can fail in private browsing or restricted browser settings.
  }
}

function monthPrefix(dateKey: string) {
  return dateKey.slice(0, 7);
}

function toCsvRow(values: (string | number)[]) {
  return values
    .map((value) => {
      const cell = String(value ?? "");
      if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
        return `"${cell.replaceAll('"', '""')}"`;
      }
      return cell;
    })
    .join(",");
}

function downloadTextFile(filename: string, content: string, mime = "text/csv") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function countDone(record: Record<string, boolean>) {
  return Object.values(record || {}).filter(Boolean).length;
}

function progressPercent(done: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((done / total) * 100);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong";
}

export default function Home() {
  const today = todayKey();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [saved, setSaved] = useState<SavedState>(defaultSavedState());
  const [history, setHistory] = useState<Record<string, HistoryDay>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("Ready when you are.");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CURRENT_KEY);
      const base = defaultSavedState();

      if (!raw) {
        setSaved(base);
        setHistory(loadHistory());
        return;
      }

      const parsed = JSON.parse(raw) as SavedState;
      const needsResetToday = parsed.last_reset_date !== today;
      const next: SavedState = {
        ...base,
        ...parsed,
        mode: parsed.mode ?? "good",
        selected_date: parsed.selected_date ?? today,
        last_reset_date: today,
        daily_done: needsResetToday ? {} : parsed.daily_done || {},
        steps_done: needsResetToday ? {} : parsed.steps_done || {},
      };

      setSaved(next);
      setHistory(loadHistory());
    } catch {
      setSaved(defaultSavedState());
      setHistory(loadHistory());
    }
  }, [today]);

  useEffect(() => {
    try {
      localStorage.setItem(CURRENT_KEY, JSON.stringify(saved));
    } catch {
      // Keep the UI usable even if localStorage is unavailable.
    }
  }, [saved]);

  useEffect(() => {
    if (saved.selected_date !== today) return;

    const nextHistory = {
      ...history,
      [today]: {
        date: today,
        mode: saved.mode,
        daily_done: saved.daily_done,
        steps_done: saved.steps_done,
        last_generated_at: saved.last_generated_at,
      },
    };

    setHistory(nextHistory);
    saveHistory(nextHistory);
    // history is intentionally omitted to avoid rewriting the snapshot twice per toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved.daily_done, saved.steps_done, saved.mode, saved.last_generated_at, saved.selected_date, today]);

  const last7Dates = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => addDays(today, -index));
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

  const activeMode = viewData?.mode ?? saved.mode;
  const activeModePlan = plan
    ? activeMode === "good"
      ? plan.todays_plan.good_day
      : plan.todays_plan.bad_day_minimum
    : null;
  const steps = activeModePlan?.steps ?? [];
  const totalMinutes = activeModePlan?.total_minutes ?? 0;
  const dailyCompletedCount = countDone(viewData?.daily_done ?? {});
  const rawStepsCompletedCount = countDone(viewData?.steps_done ?? {});
  const stepsCompletedCount = plan
    ? steps.filter((step) => viewData?.steps_done?.[stepKey(activeMode, step.step)]).length
    : rawStepsCompletedCount;
  const dailyProgress = progressPercent(dailyCompletedCount, MASTER_TOTAL);
  const stepProgress = progressPercent(stepsCompletedCount, steps.length);

  const masterItems = plan?.daily_master_7 ?? DAILY_MASTER_ITEMS.map((name) => ({ name, done: false }));
  const heroStatus = !viewingToday
    ? "Viewing saved day"
    : !plan
      ? "No plan generated yet"
      : dailyCompletedCount > 0 || stepsCompletedCount > 0
        ? "Plan in progress"
        : "Today is active";
  const modeStatus = activeMode === "good" ? "Full plan selected." : "Basics-only plan selected.";
  const planStatus = plan ? `${stepsCompletedCount} of ${steps.length} steps done.` : "Generate a plan to begin.";
  const currentDay: HistoryDay = {
    date: today,
    mode: saved.mode,
    daily_done: saved.daily_done,
    steps_done: saved.steps_done,
    last_generated_at: saved.last_generated_at,
  };

  async function generate() {
    if (!viewingToday) {
      setFeedback("Return to today to generate a plan.");
      return;
    }

    setLoading(true);
    setError("");
    setFeedback("Building today's plan.");

    try {
      const response = await fetch("/api/coach");
      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const data = (await response.json()) as Plan;
      const merged: Plan = {
        ...data,
        daily_master_7: data.daily_master_7.map((item) => ({
          ...item,
          done: viewData?.daily_done?.[item.name] ?? false,
        })),
      };

      setPlan(merged);
      setSaved((prev) => ({ ...prev, last_generated_at: new Date().toISOString() }));
      setFeedback("Saved to today.");
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
      setFeedback("Plan did not load. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function setMode(mode: Mode) {
    if (!viewingToday) return;
    setSaved((prev) => ({ ...prev, mode }));
    setFeedback(`${modeCopy[mode].label} selected. Progress saved.`);
  }

  function toggleDaily(name: string) {
    if (!viewingToday) return;

    setSaved((prev) => {
      const current = prev.daily_done[name] ?? false;
      const nextDailyDone = { ...prev.daily_done, [name]: !current };

      setPlan((currentPlan) => {
        if (!currentPlan) return currentPlan;
        return {
          ...currentPlan,
          daily_master_7: currentPlan.daily_master_7.map((item) =>
            item.name === name ? { ...item, done: !current } : item
          ),
        };
      });

      setFeedback(!current ? "Marked done. That counts." : "Updated. Progress saved.");
      return { ...prev, daily_done: nextDailyDone };
    });
  }

  function toggleStep(mode: Mode, stepNumber: number) {
    if (!viewingToday) return;

    const key = stepKey(mode, stepNumber);
    setSaved((prev) => {
      const current = prev.steps_done[key] ?? false;
      setFeedback(!current ? "Step complete. Progress saved." : "Updated. Progress saved.");
      return { ...prev, steps_done: { ...prev.steps_done, [key]: !current } };
    });
  }

  function resetForToday() {
    if (!viewingToday) return;

    setSaved((prev) => ({ ...prev, daily_done: {}, steps_done: {} }));
    setPlan((currentPlan) => {
      if (!currentPlan) return currentPlan;
      return {
        ...currentPlan,
        daily_master_7: currentPlan.daily_master_7.map((item) => ({ ...item, done: false })),
      };
    });
    setFeedback("Reset today only. Saved history stays intact.");
  }

  function selectDate(date: string) {
    setSaved((prev) => ({ ...prev, selected_date: date }));
    setFeedback(date === today ? "Today is editable." : "Viewing saved day.");
  }

  function downloadMonthCsv() {
    const month = monthPrefix(today);
    const storedHistory = loadHistory();
    const rows: string[] = [];
    rows.push(toCsvRow(["date", "mode", "daily_done_count", "steps_done_count", "generated_at"]));

    const monthDates = Object.keys(storedHistory)
      .filter((date) => date.startsWith(month))
      .sort();
    const dates = monthDates.includes(today) ? monthDates : [...monthDates, today].sort();

    for (const date of dates) {
      const day: HistoryDay | undefined =
        date === today
          ? {
              date: today,
              mode: saved.mode,
              daily_done: saved.daily_done,
              steps_done: saved.steps_done,
              last_generated_at: saved.last_generated_at,
            }
          : storedHistory[date];

      if (!day) continue;

      rows.push(
        toCsvRow([
          date,
          day.mode,
          countDone(day.daily_done),
          countDone(day.steps_done),
          day.last_generated_at ?? "",
        ])
      );
    }

    downloadTextFile(`life-os_${month}.csv`, rows.join("\n"), "text/csv");
    setFeedback("Month CSV downloaded.");
  }

  return (
    <main className="life-shell">
      <section className="hero-card">
        <div className="hero-copy">
          <p className="eyebrow">Daily execution dashboard</p>
          <h1>Life OS</h1>
          <p className="tagline">One button. One plan. No guessing.</p>
        </div>
        <div className="hero-panel" aria-label="Selected day">
          <div className="status-pill">{heroStatus}</div>
          <span>{viewingToday ? "Today" : "Viewing"}</span>
          <strong>{formatDate(saved.selected_date)}</strong>
          <small>Saved locally in this browser.</small>
          <div className="hero-metrics">
            <span>{dailyCompletedCount}/7 basics</span>
            <span>{plan ? `${stepsCompletedCount}/${steps.length} steps` : "Plan not generated"}</span>
          </div>
        </div>
      </section>

      <section className="summary-grid" aria-label="Today summary">
        <article className="summary-card">
          <span>Current mode</span>
          <strong>{modeCopy[activeMode].label}</strong>
          <p>{modeStatus}</p>
        </article>
        <article className="summary-card">
          <span>Daily Master 7</span>
          <strong>
            {dailyCompletedCount} of {MASTER_TOTAL}
          </strong>
          <p>{dailyCompletedCount} basics complete.</p>
        </article>
        <article className="summary-card">
          <span>Plan steps</span>
          <strong>
            {stepsCompletedCount} of {plan ? steps.length : 0}
          </strong>
          <p>{planStatus}</p>
        </article>
      </section>

      <section className="panel history-panel" aria-label="Progress history">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Progress history</p>
            <h2>Recent days</h2>
          </div>
          {!viewingToday && <p>Past days are read-only so your record stays accurate.</p>}
        </div>

        <div className="day-chip-row" aria-label="Recent day progress">
          {last7Dates.map((date) => {
            const day = date === today ? currentDay : history[date];
            const dayBasics = countDone(day?.daily_done ?? {});
            const daySteps = countDone(day?.steps_done ?? {});
            const selected = saved.selected_date === date;

            return (
              <button
                key={date}
                type="button"
                onClick={() => selectDate(date)}
                className={selected ? "day-chip selected" : "day-chip"}
                aria-label={`${date}: ${dayBasics} basics complete, ${daySteps} steps complete`}
              >
                <span>{date === today ? "Today" : formatDate(date).slice(0, 3)}</span>
                <strong>{date.slice(8)}</strong>
                <i className={dayBasics + daySteps > 0 ? "dot filled" : "dot"} />
              </button>
            );
          })}
        </div>

        <div className="history-controls">
          <button
            type="button"
            onClick={() => selectDate(today)}
            className={saved.selected_date === today ? "pill active" : "pill"}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => selectDate(addDays(today, -1))}
            className={saved.selected_date === addDays(today, -1) ? "pill active" : "pill"}
          >
            Yesterday
          </button>
          <label className="select-label">
            <span>Saved days</span>
            <select value={saved.selected_date} onChange={(event) => selectDate(event.target.value)}>
              {last7Dates.map((date) => (
                <option key={date} value={date}>
                  {date}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <div className="main-grid">
        <section className="panel plan-control-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Mode</p>
              <h2>Pick the plan for today.</h2>
            </div>
          </div>

          <div className="mode-grid" role="group" aria-label="Plan mode">
            {(["good", "bad"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setMode(mode)}
                disabled={!viewingToday}
                className={activeMode === mode ? "mode-card selected" : "mode-card"}
              >
                <strong>{modeCopy[mode].label}</strong>
                <span>{modeCopy[mode].description}</span>
              </button>
            ))}
          </div>

          <div className="action-row">
            <button type="button" onClick={generate} disabled={loading || !viewingToday} className="primary-button">
              {loading ? "Generating..." : "Generate today's plan"}
            </button>
            <button type="button" onClick={downloadMonthCsv} className="secondary-button">
              Download month CSV
            </button>
          </div>

          {error && <div className="error-box">{error}</div>}
          <p className="feedback-line" aria-live="polite">
            {feedback}
          </p>
        </section>

        <section className="panel reset-panel">
          <p className="eyebrow">Reset</p>
          <h2>Reset today only</h2>
          <p>Clears today&apos;s checkboxes. Your saved history stays intact.</p>
          <button type="button" onClick={resetForToday} disabled={!viewingToday} className="secondary-button">
            Reset today
          </button>
        </section>
      </div>

      <div className="content-grid">
        <section className="panel foundation-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Foundation</p>
              <h2>Daily Master 7</h2>
            </div>
            <p>Start with the basics.</p>
          </div>
          <p className="section-note">These are the pieces that keep the day steady.</p>
          <ProgressBar value={dailyProgress} label={`${dailyCompletedCount} of ${MASTER_TOTAL} basics complete`} />

          <ul className="check-list">
            {masterItems.map((item) => {
              const done = viewData?.daily_done[item.name] ?? false;
              return (
                <li key={item.name} className={done ? "check-row done" : "check-row"}>
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={() => toggleDaily(item.name)}
                    disabled={!viewingToday}
                    aria-label={item.name}
                  />
                  <span>{item.name}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="panel today-plan-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Today</p>
              <h2>Today&apos;s Plan</h2>
            </div>
            <p>{modeCopy[activeMode].label}</p>
          </div>

          {plan ? (
            <>
              <div className="plan-meta">
                <span>Total: {totalMinutes} minutes</span>
                <span>
                  {stepsCompletedCount} of {steps.length} steps done
                </span>
              </div>
              <ProgressBar value={stepProgress} label={`${stepProgress}% of plan steps complete`} />
              <ol className="step-list">
                {steps.map((step) => {
                  const key = stepKey(activeMode, step.step);
                  const done = viewData?.steps_done[key] ?? false;
                  return (
                    <li key={key} className={done ? "step-row done" : "step-row"}>
                      <input
                        type="checkbox"
                        checked={done}
                        onChange={() => toggleStep(activeMode, step.step)}
                        disabled={!viewingToday}
                        aria-label={`Step ${step.step}: ${step.task}`}
                      />
                      <div>
                        <span className="step-number">Step {step.step}</span>
                        <strong>{step.task}</strong>
                        <small>{step.minutes} min</small>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </>
          ) : (
            <div className="empty-state">No plan yet. Generate today&apos;s plan to start with the basics.</div>
          )}
        </section>
      </div>
    </main>
  );
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div className="progress-wrap" aria-label={label}>
      <div className="progress-meta">
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}
