import { NextRequest, NextResponse } from "next/server";
import { buildPlanFromBlueprint, defaultBlueprint } from "../../../lib/blueprint";

export async function GET() {
  return NextResponse.json(buildPlanFromBlueprint(defaultBlueprint));
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { blueprint?: unknown };
    return NextResponse.json(buildPlanFromBlueprint(body.blueprint));
  } catch {
    return NextResponse.json(buildPlanFromBlueprint(defaultBlueprint));
  }
}
