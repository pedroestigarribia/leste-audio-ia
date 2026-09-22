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
    geminiTranscribeModel: config.geminiTranscribeModel,
    geminiAudioUnderstandingModel: config.geminiAudioUnderstandingModel,
    geminiTextModel: config.textModel,
    geminiTtsModel: config.geminiTtsModel,
    geminiAudiobookTtsModel: config.geminiTtsAudiobookModel,
    geminiLiveModel: config.geminiLiveModel,
    textAiProvider: config.textAiProvider,
    deepseekModel: config.deepSeekModel,
    maxVideoUploadMb: config.maxVideoUploadMb,
    maxVideoDurationSec: config.maxVideoDurationSec,
  });
}
