const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const { promises: fs } = require("node:fs");
const path = require("node:path");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const origin = process.env.CUT_TEST_ORIGIN || "http://127.0.0.1:3000";

async function json(url, init) {
  const response = await fetch(`${origin}${url}`, { ...init, signal: AbortSignal.timeout(90_000) });
  const data = await response.json();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${data.error || "falha na requisição"}`);
  return data;
}

async function waitForJob(jobId, expectedStage) {
  const limit = Date.now() + 240_000;
  while (Date.now() < limit) {
    const { job } = await json(`/api/cuts/jobs/${jobId}`);
    if (job.stage === expectedStage) return job;
    if (["failed", "cancelled"].includes(job.stage)) throw new Error(`Job ${job.stage}: ${job.error || job.message}`);
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`Tempo esgotado aguardando ${expectedStage}.`);
}

async function main() {
  const root = path.resolve("tmp");
  await fs.mkdir(root, { recursive: true });
  const directory = await fs.mkdtemp(path.join(root, "cuts-live-test-"));
  let jobId;
  try {
    const wav = path.join(directory, "narracao.wav");
    const video = path.join(directory, "teste.mp4");
    const speech = [
      "$voice=New-Object -ComObject SAPI.SpVoice",
      "$selected=$voice.GetVoices() | Where-Object { $_.GetDescription() -match 'Portuguese' } | Select-Object -First 1",
      "if ($selected) { $voice.Voice=$selected }",
      "$stream=New-Object -ComObject SAPI.SpFileStream",
      "$stream.Open($env:CUT_TEST_AUDIO,3,$false)",
      "$voice.AudioOutputStream=$stream",
      "[void]$voice.Speak('Hoje falaremos sobre como planejar um projeto. Primeiro, definimos o objetivo e organizamos as ideias. Depois, revisamos as decisões e apresentamos os próximos passos.')",
      "$stream.Close()",
    ].join("; ");
    await execFileAsync("powershell.exe", ["-NoProfile", "-Command", speech], { env: { ...process.env, CUT_TEST_AUDIO: wav } });
    await execFileAsync(require("ffmpeg-static"), [
      "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=blue:s=640x360:r=10",
      "-i", wav, "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", video,
    ]);

    const preferences = { mode: "discover", genre: "Educação", durationPreset: "custom", minDurationSec: 5, maxDurationSec: 20, desiredCount: 1 };
    const form = new FormData();
    form.set("file", new File([await fs.readFile(video)], "teste-sintetico.mp4", { type: "video/mp4" }));
    form.set("preferences", JSON.stringify(preferences));
    const created = await json("/api/cuts/jobs", { method: "POST", body: form });
    jobId = created.jobId;
    assert.ok(jobId);
    await json(`/api/cuts/jobs/${jobId}/analyze`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preferences }) });
    const analyzed = await waitForJob(jobId, "ready_for_review");
    assert.ok(analyzed.transcript?.segments?.length, "A transcrição não retornou segmentos.");
    assert.ok(analyzed.candidates?.length, "A análise não retornou candidatos.");
    await json(`/api/cuts/jobs/${jobId}/render`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clips: [{ candidateId: analyzed.candidates[0].id }], options: { aspectRatio: "9:16", captionPreset: "simple", reframeMode: "center" } }),
    });
    const completed = await waitForJob(jobId, "completed");
    const output = completed.outputs[0];
    assert.ok(output?.downloadUrl && output.srtDownloadUrl);
    const mp4 = await fetch(`${origin}${output.downloadUrl}`, { headers: { Range: "bytes=0-1023" } });
    assert.equal(mp4.status, 206);
    assert.equal(mp4.headers.get("content-type"), "video/mp4");
    const srt = await fetch(`${origin}${output.srtDownloadUrl}`);
    assert.equal(srt.status, 200);
    assert.match(await srt.text(), /\d{2}:\d{2}:\d{2},\d{3}/);
    console.log(`Teste real em ${origin}: upload, transcrição, análise, renderização MP4 e SRT concluídos.`);
  } finally {
    if (jobId) await fetch(`${origin}/api/cuts/jobs/${jobId}`, { method: "DELETE" }).catch(() => undefined);
    assert.ok(path.resolve(directory).startsWith(`${root}${path.sep}`));
    await fs.rm(directory, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : "Falha no teste."); process.exitCode = 1; });
