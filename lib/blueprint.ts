export type PlanMode = "good" | "bad";

export type BlueprintStep = {
  title: string;
  minutes: number;
};

export type Blueprint = {
  dailyMaster: string[];
  goodDaySteps: BlueprintStep[];
  badDayMinimumSteps: BlueprintStep[];
};

export type MasterItem = {
  name: string;
  done: boolean;
};

export type PlanStep = {
  step: number;
  task: string;
  minutes: number;
};

export type GeneratedPlan = {
  daily_master_7: MasterItem[];
  todays_plan: {
    good_day: { total_minutes: number; steps: PlanStep[] };
    bad_day_minimum: { total_minutes: number; steps: PlanStep[] };
  };
};

export const defaultBlueprint: Blueprint = {
  dailyMaster: [
    "Sleep window",
    "Move body",
    "Reset space",
    "One focus block",
    "Eat something steady",
    "Limit comparison",
    "Save or plan one small thing",
  ],
  goodDaySteps: [
    { title: "10-minute walk + water", minutes: 10 },
    { title: "One focused work block", minutes: 40 },
    { title: "One life, admin, or career step", minutes: 30 },
  ],
  badDayMinimumSteps: [
    { title: "Drink water", minutes: 5 },
    { title: "Reset one small area", minutes: 5 },
    { title: "Do one 10-minute task", minutes: 10 },
  ],
};

export const BLUEPRINT = `
LIFE OS DAILY BLUEPRINT

DAILY MASTER 7
1) Sleep window
2) Move body
3) Reset space
4) One focus block
5) Eat something steady
6) Limit comparison
7) Save or plan one small thing

GOOD DAY PLAN
1) 10-minute walk + water
2) One focused work block
3) One life, admin, or career step

BAD DAY MINIMUM
1) Drink water
2) Reset one small area
3) Do one 10-minute task
`.trim();

function cloneBlueprint(blueprint: Blueprint): Blueprint {
  return {
    dailyMaster: [...blueprint.dailyMaster],
    goodDaySteps: blueprint.goodDaySteps.map((step) => ({ ...step })),
    badDayMinimumSteps: blueprint.badDayMinimumSteps.map((step) => ({ ...step })),
  };
}

function normalizeTitle(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function normalizeMinutes(value: unknown, fallback: number) {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return Math.min(480, Math.max(0, Math.round(numberValue)));
}

function normalizeMasterItems(value: unknown) {
  const source = Array.isArray(value) ? value : [];
  return defaultBlueprint.dailyMaster.map((fallback, index) => normalizeTitle(source[index], fallback));
}

function normalizeSteps(value: unknown, defaults: BlueprintStep[]) {
  const source = Array.isArray(value) ? value : [];
  return defaults.map((fallback, index) => {
    const candidate = source[index] as Partial<BlueprintStep> | undefined;
    return {
      title: normalizeTitle(candidate?.title, fallback.title),
      minutes: normalizeMinutes(candidate?.minutes, fallback.minutes),
    };
  });
}

export function sanitizeBlueprint(value: unknown): Blueprint {
  if (!value || typeof value !== "object") return cloneBlueprint(defaultBlueprint);

  const candidate = value as Partial<Blueprint>;
  return {
    dailyMaster: normalizeMasterItems(candidate.dailyMaster),
    goodDaySteps: normalizeSteps(candidate.goodDaySteps, defaultBlueprint.goodDaySteps),
    badDayMinimumSteps: normalizeSteps(candidate.badDayMinimumSteps, defaultBlueprint.badDayMinimumSteps),
  };
}

function toPlanSteps(steps: BlueprintStep[]) {
  return steps.map((step, index) => ({
    step: index + 1,
    task: step.title,
    minutes: step.minutes,
  }));
}

function sumMinutes(steps: BlueprintStep[]) {
  return steps.reduce((total, step) => total + step.minutes, 0);
}

export function buildPlanFromBlueprint(value: unknown): GeneratedPlan {
  const blueprint = sanitizeBlueprint(value);
  const goodDaySteps = toPlanSteps(blueprint.goodDaySteps);
  const badDayMinimumSteps = toPlanSteps(blueprint.badDayMinimumSteps);

  return {
    daily_master_7: blueprint.dailyMaster.map((name) => ({ name, done: false })),
    todays_plan: {
      good_day: {
        total_minutes: sumMinutes(blueprint.goodDaySteps),
        steps: goodDaySteps,
      },
      bad_day_minimum: {
        total_minutes: sumMinutes(blueprint.badDayMinimumSteps),
        steps: badDayMinimumSteps,
      },
    },
  };
}
