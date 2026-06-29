import { existsSync } from "fs";
import path from "path";

import LesteAudioApp from "@/components/LesteAudioApp";
import { getAppConfig } from "@/lib/env";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function HomePage() {
  const config = getAppConfig();
  const hasLogo = existsSync(path.join(process.cwd(), "public", "logo.png"));

  return (
    <LesteAudioApp
      hasLogo={hasLogo}
      config={{
        appName: config.appName,
        maxParallelTranscriptions: config.maxParallelTranscriptions,
        maxFileSizeMb: config.maxFileSizeMb,
      }}
    />
  );
}
