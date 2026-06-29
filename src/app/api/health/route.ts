import { NextResponse } from "next/server";

import { getAppConfig } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const config = getAppConfig();

  return NextResponse.json({
    ok: true,
    app: config.appName,
    geminiModel: config.geminiModel,
    geminiTtsModel: config.geminiTtsModel,
    deepseekModel: config.deepSeekModel,
  });
}
