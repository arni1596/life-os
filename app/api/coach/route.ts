import { NextResponse } from "next/server";

function buildPlan() {
  return {
    daily_master_7: [
      { name: "Sleep window", done: false },
      { name: "Move body", done: false },
      { name: "Daily reset", done: false },
      { name: "One focus block", done: false },
      { name: "Eat protein", done: false },
      { name: "No comparison", done: false },
      { name: "Save something ($1 counts)", done: false }
    ],
    todays_plan: {
      good_day: {
        total_minutes: 90,
        steps: [
          { step: 1, task: "10-minute walk + water", minutes: 10 },
          { step: 2, task: "One Life OS improvement (UI or logic)", minutes: 40 },
          { step: 3, task: "Apply to 1 role or add 1 portfolio bullet", minutes: 40 }
        ]
      },
      bad_day_minimum: {
        total_minutes: 15,
        steps: [
          { step: 1, task: "Open Life OS and check 1 box", minutes: 5 },
          { step: 2, task: "Write 1 sentence: what I control today", minutes: 10 }
        ]
      }
    }
  };
}

// Browser visit = GET
export async function GET() {
  return NextResponse.json(buildPlan());
}

// Button/fetch = POST
export async function POST() {
  const plan = buildPlan();
  return NextResponse.json({ text: JSON.stringify(plan, null, 2) });
}
