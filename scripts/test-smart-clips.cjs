const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const { promises: fs } = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

function loadTypeScript(relativePath, overrides = {}) {
  const source = require("node:fs").readFileSync(relativePath, "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  const localRequire = (name) => {
    if (name === "server-only") return {};
    if (name in overrides) return overrides[name];
    return require(name);
  };
  new Function("module", "exports", "require", js)(loaded, loaded.exports, localRequire);
  return loaded.exports;
}

async function main() {
  const projectRoot = path.resolve(process.cwd());
  const tempRoot = path.join(projectRoot, "tmp");
  await fs.mkdir(tempRoot, { recursive: true });
  const tempDir = await fs.mkdtemp(path.join(tempRoot, "smart-clips-test-"));

  try {
    const reframeMath = loadTypeScript("src/lib/video/reframe-math.ts");
    const { writeSrt } = loadTypeScript("src/lib/video/render.ts", {
      "@/lib/video/tools": { escapeSubtitlePath: (value) => value, runFfmpeg: async () => undefined },
      "@/lib/video/reframe-math": reframeMath,
    });
    const candidate = { startTime: 10, endTime: 12 };
    const segment = {
      id: "seg-1",
      start: 10,
      end: 12,
      text: "Olá mundo.",
      words: [
        { word: "Olá", start: 10, end: 10.8 },
        { word: "mundo.", start: 10.8, end: 12 },
      ],
    };
    const dynamicPath = path.join(tempDir, "dynamic.srt");
    await writeSrt([segment], candidate, dynamicPath, "dynamic");
    const dynamicSrt = await fs.readFile(dynamicPath, "utf8");
    assert.match(dynamicSrt, /00:00:00,000 --> 00:00:00,800\nOlá/);
    assert.match(dynamicSrt, /00:00:00,800 --> 00:00:02,000\nmundo\./);

    const simplePath = path.join(tempDir, "simple.srt");
    await writeSrt([segment], candidate, simplePath, "simple");
    const simpleSrt = await fs.readFile(simplePath, "utf8");
    assert.match(simpleSrt, /00:00:00,000 --> 00:00:02,000\nOlá mundo\./);

    const { mapTranscriptChunk } = loadTypeScript("src/lib/video/transcript-utils.ts");
    const mapped = mapTranscriptChunk({
      idPrefix: "part-2",
      offsetSeconds: 600,
      durationSec: 605,
      segments: [{ id: "seg-1", start: 0.5, end: 1.5, text: "Olá mundo" }],
      words: [
        { word: "Olá", start: 0.5, end: 0.9 },
        { word: "mundo", start: 0.9, end: 1.5 },
      ],
    });
    assert.equal(mapped[0].start, 600.5);
    assert.equal(mapped[0].end, 601.5);
    assert.deepEqual(mapped[0].words.map(({ start, end }) => [start, end]), [[600.5, 600.9], [600.9, 601.5]]);

    const clamped = mapTranscriptChunk({
      idPrefix: "part-3",
      offsetSeconds: 604,
      durationSec: 605,
      segments: [{ id: "seg-1", start: 0, end: 4, text: "fim" }],
      words: [{ word: "fim", start: 0, end: 4 }],
    });
    assert.equal(clamped[0].end, 605);
    assert.equal(clamped[0].words[0].end, 605);

    const env = { getServerEnv: () => ({ maxActiveCutJobs: 1, maxVideoUploadMb: 125, cutOutputTtlMinutes: 60, processTimeoutMs: 15_000 }) };
    const jobsDir = path.join(tempDir, "jobs");
    const getJobDir = (jobId) => path.join(jobsDir, jobId);
    let lastJobNumber = 0;
    const paths = {
      createJobId: () => `cut-test-job-${++lastJobNumber}`,
      ensureJobDir: async (jobId) => { await fs.mkdir(getJobDir(jobId), { recursive: true }); return getJobDir(jobId); },
      fileExists: async (filePath) => fs.access(filePath).then(() => true, () => false),
      getCutsRoot: () => jobsDir,
      getJobDir,
      safeDeletePath: async (jobDir) => {
        assert.equal(path.dirname(jobDir), jobsDir);
        await fs.rm(jobDir, { recursive: true, force: true });
      },
    };
    const youtube = loadTypeScript("src/lib/youtube.ts");
    const sourceUrls = loadTypeScript("src/lib/video/source-url.ts", { "@/lib/youtube": youtube });
    let delayWrite = false;
    let notifyWrite;
    let allowWrite;
    const writeStarted = new Promise((resolve) => { notifyWrite = resolve; });
    const writeAllowed = new Promise((resolve) => { allowWrite = resolve; });
    const controlledFs = {
      promises: {
        ...fs,
        writeFile: async (filePath, content, ...args) => {
          if (delayWrite && path.basename(filePath).startsWith("state.json")) {
            await fs.writeFile(filePath, "{", ...args);
            notifyWrite();
            await writeAllowed;
          }
          return fs.writeFile(filePath, content, ...args);
        },
      },
    };
    const atomicStore = loadTypeScript("src/lib/video/job-store.ts", {
      "node:fs": controlledFs,
      "@/lib/env": env,
      "@/lib/video/paths": { ...paths, createJobId: () => "cut-atomic-test-123" },
    });
    const atomicJob = await atomicStore.createVideoJob({ sourceType: "upload", sourceName: "test.mp4" });
    delayWrite = true;
    const updating = atomicStore.updateVideoJob(atomicJob.jobId, { stage: "validating" });
    await writeStarted;
    const duringWrite = await atomicStore.getStoredJob(atomicJob.jobId);
    allowWrite();
    await updating;
    assert.equal(duringWrite?.stage, "created", "Concurrent reads must see the old complete state, not a partial JSON file.");
    await paths.safeDeletePath(getJobDir(atomicJob.jobId));
    const jobStore = loadTypeScript("src/lib/video/job-store.ts", {
      "@/lib/env": env,
      "@/lib/video/paths": paths,
    });
    const videoUpload = loadTypeScript("src/lib/video/upload.ts", {
      "@/lib/video/paths": paths,
      "@/lib/temp-files": loadTypeScript("src/lib/temp-files.ts", {
        "@/lib/audio": loadTypeScript("src/lib/audio.ts"),
        "@/lib/env": env,
      }),
    });
    const preferences = loadTypeScript("src/lib/video/preferences.ts");
    const cutsRoute = loadTypeScript("src/app/api/cuts/jobs/route.ts", {
      "@/lib/env": env,
      "@/lib/video/job-store": jobStore,
      "@/lib/video/preferences": preferences,
      "@/lib/video/upload": videoUpload,
      "@/lib/video/source-url": sourceUrls,
    });
    const youtubeUrl = "https://www.youtube.com/watch?v=abcdefghijk";
    const legacy = await jobStore.createVideoJob({ sourceType: "youtube", sourceName: youtubeUrl, sourceUrl: youtubeUrl });
    await jobStore.updateVideoJob(legacy.jobId, {
      stage: "acquiring", pendingAction: "analyze",
      error: "Command failed: /home/synthetic-user/nodejs/node_modules/yt-dlp; fallback: Status code: 429",
    });
    const active = await jobStore.createVideoJob({ sourceType: "upload", sourceName: "active.mp4" });
    const youtubeResponse = await cutsRoute.POST(new Request("http://localhost/api/cuts/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceType: "youtube", url: youtubeUrl }),
    }));
    assert.equal(youtubeResponse.status, 422, "A link-only request must explain the missing file even when the queue is full.");
    assert.match((await youtubeResponse.json()).error, /MP4/);
    assert.equal(lastJobNumber, 2, "A YouTube reference must never start a download-only job.");
    await jobStore.updateVideoJob(active.jobId, { stage: "cancelled" });
    assert.equal(await jobStore.countActiveVideoJobs(), 0, "A stranded link-only job must not block uploads.");

    const legacyPublic = jobStore.toPublicJob(await jobStore.getStoredJob(legacy.jobId));
    assert.equal(legacyPublic.stage, "failed");
    assert.equal(legacyPublic.recoverableAction, undefined);
    assert.match(legacyPublic.error, /MP4/);
    assert.doesNotMatch(legacyPublic.error, /Command failed|\/home\/|node_modules/);
    let legacyQueued = false;
    const analyzeRoute = loadTypeScript("src/app/api/cuts/jobs/[jobId]/analyze/route.ts", {
      "@/lib/video/job-store": { ...jobStore, enqueueVideoJob: () => { legacyQueued = true; } },
      "@/lib/video/paths": { ...paths, assertSafeJobId: () => undefined },
      "@/lib/video/pipeline": { processVideoJob: () => undefined },
      "@/lib/video/preferences": preferences,
    });
    const retryResponse = await analyzeRoute.POST(new Request("http://localhost/api/cuts/jobs/legacy/analyze", {
      method: "POST",
    }), { params: Promise.resolve({ jobId: legacy.jobId }) });
    assert.equal(retryResponse.status, 422);
    assert.equal(legacyQueued, false);
    assert.equal(jobStore.getStaleJobAction("rendering", "render", true), "render");
    assert.equal(jobStore.getStaleJobAction("transcribing", undefined, true), "analyze");
    assert.equal(jobStore.getStaleJobAction("rendering", undefined, true), undefined);
    const failedFfmpeg = Object.assign(new Error("Command failed: /home/private/video.mp4"), {
      code: 1,
      stderr: "Failed to configure output pad: Resource temporarily unavailable. /home/private/video.mp4",
    });
    const videoTools = loadTypeScript("src/lib/video/tools.ts", {
      "ffmpeg-static": "/example/ffmpeg",
      "@derhuerst/ffprobe-static": "/example/ffprobe",
      "@/lib/env": env,
      "@/lib/run-command": { runCommand: async () => { throw failedFfmpeg; } },
    });
    await assert.rejects(videoTools.runFfmpeg([]), (error) => {
      assert.match(error.message, /recursos/i);
      assert.doesNotMatch(error.message, /\/home\/private|video\.mp4/);
      return true;
    });
    const publicJob = jobStore.toPublicJob({
      jobId: "cut-test-job-12345678",
      stage: "failed",
      progress: 20,
      message: "interrompido",
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sourceType: "upload",
      sourceName: "test.mp4",
      sourcePath: "private-source-path",
      pendingAction: "render",
      pendingRender: { clips: [], options: {} },
      candidates: [],
      outputs: [{ id: "output-1234567890", candidateId: "c1", title: "corte", fileName: "corte.mp4", filePath: "private-output-path", srtPath: "private-srt-path", renderKey: "private-render-key", downloadUrl: "/file", createdAt: "", expiresAt: "" }],
    });
    assert.equal(publicJob.recoverableAction, "render");
    assert.equal("pendingRender" in publicJob, false);
    assert.equal("filePath" in publicJob.outputs[0], false);
    assert.equal("renderKey" in publicJob.outputs[0], false);

    const resumeSelection = { candidateId: "candidate-resume", startTime: 4, endTime: 12, title: "Trecho aprovado" };
    const resumeOptions = { aspectRatio: "9:16", captionPreset: "dynamic", reframeMode: "subject" };
    let resumeJob = {
      jobId: "cut-test-job-12345678",
      stage: "failed",
      pendingAction: "render",
      pendingRender: { clips: [resumeSelection], options: resumeOptions },
      candidates: [],
      outputs: [],
    };
    let resumeTask;
    let resumedArguments;
    const renderRoute = loadTypeScript("src/app/api/cuts/jobs/[jobId]/render/route.ts", {
      "@/lib/video/job-store": {
        enqueueVideoJob: (_jobId, task) => { resumeTask = task; },
        getStoredJob: async () => resumeJob,
        toPublicJob: (value) => value,
        updateVideoJob: async (_jobId, patch) => { resumeJob = { ...resumeJob, ...patch }; return resumeJob; },
      },
      "@/lib/video/paths": { assertSafeJobId: () => undefined },
      "@/lib/video/render-job": {
        renderSelectedVideoClips: async (...args) => { resumedArguments = args; },
      },
    });
    const resumeResponse = await renderRoute.POST(new Request("http://localhost/api/cuts/jobs/cut-test-job-12345678/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resume: true }),
    }), { params: Promise.resolve({ jobId: resumeJob.jobId }) });
    assert.equal(resumeResponse.status, 202);
    await resumeTask(new AbortController().signal);
    assert.deepEqual(resumedArguments[1], [resumeSelection]);
    assert.deepEqual(resumedArguments[2], resumeOptions);

    const { buildCropPositionExpression, selectReframeSampleTimes } = loadTypeScript("src/lib/video/reframe-math.ts");
    const samples = selectReframeSampleTimes(10, 20, [10, 12, 14, 16, 18, 20], 4);
    assert.equal(samples.length, 4);
    assert.equal(samples[0], 10);
    assert.equal(samples.at(-1), 20);
    assert.ok(samples.every((time, index) => index === 0 || time > samples[index - 1]));
    const expression = buildCropPositionExpression([
      { time: 0, centerX: 0.1, centerY: 0.5 },
      { time: 2, centerX: 0.9, centerY: 0.5 },
    ], "x", 405, 1280, 2);
    assert.match(expression, /max\(0,min\(875,/);
    assert.match(expression, /if\(lt\(t,2\)/);
    assert.doesNotMatch(expression, /NaN|Infinity|undefined/);

    const ffmpeg = require("ffmpeg-static") || process.env.FFMPEG_BIN || "ffmpeg";
    const ffprobe = require("@derhuerst/ffprobe-static") || process.env.FFPROBE_BIN || "ffprobe";
    const inputVideo = path.join(tempDir, "synthetic-wide.mp4");
    const centeredVideo = path.join(tempDir, "centered.mp4");
    const reframedVideo = path.join(tempDir, "reframed.mp4");
    await execFileAsync(ffmpeg, [
      "-hide_banner", "-loglevel", "error", "-y",
      "-f", "lavfi", "-i", "color=c=black:s=1280x720:r=15:d=2",
      "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=2",
      "-vf", "drawbox=x=50:y=150:w=350:h=420:color=red:t=fill,drawbox=x=880:y=150:w=350:h=420:color=blue:t=fill",
      "-shortest", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", inputVideo,
    ]);
    const videoBytes = await fs.readFile(inputVideo);
    const uploadForm = new FormData();
    uploadForm.set("file", new File([videoBytes], "Video autorizado.mp4", { type: "video/mp4" }));
    uploadForm.set("sourceUrl", "https://www.instagram.com/reel/Test123/");
    const invalidReference = await cutsRoute.POST(new Request("http://localhost/api/cuts/jobs", { method: "POST", body: uploadForm }));
    assert.equal(invalidReference.status, 400);
    assert.equal(await paths.fileExists(getJobDir(`cut-test-job-${lastJobNumber}`)), false);
    uploadForm.set("sourceUrl", "https://youtu.be/abcdefghijk?si=test");
    const uploadResponse = await cutsRoute.POST(new Request("http://localhost/api/cuts/jobs", { method: "POST", body: uploadForm }));
    assert.equal(uploadResponse.status, 201);
    const uploaded = (await uploadResponse.json()).job;
    assert.equal(uploaded.sourceType, "upload");
    assert.equal(uploaded.sourceUrl, youtubeUrl);
    assert.equal("sourcePath" in uploaded, false);
    const storedUpload = await jobStore.getStoredJob(uploaded.jobId);
    assert.deepEqual(await fs.readFile(storedUpload.sourcePath), videoBytes);

    const renderModule = loadTypeScript("src/lib/video/render.ts", {
      "@/lib/video/tools": {
        escapeSubtitlePath: (value) => value,
        runFfmpeg: (args) => execFileAsync(ffmpeg, args),
      },
      "@/lib/video/reframe-math": reframeMath,
    });
    const renderOptions = { aspectRatio: "9:16", captionPreset: "none", reframeMode: "subject" };
    await renderModule.renderVideoClip({
      sourcePath: storedUpload.sourcePath,
      outputPath: centeredVideo,
      candidate: { startTime: 0, endTime: 2 },
      options: renderOptions,
    });
    await renderModule.renderVideoClip({
      sourcePath: storedUpload.sourcePath,
      outputPath: reframedVideo,
      candidate: { startTime: 0, endTime: 2 },
      options: renderOptions,
      reframe: {
        sourceWidth: 1280,
        sourceHeight: 720,
        durationSec: 2,
        keyframes: [
          { time: 0, centerX: 0.2, centerY: 0.5, confidence: 0.9 },
          { time: 2, centerX: 0.8, centerY: 0.5, confidence: 0.9 },
        ],
      },
    });
    const centerHash = await execFileAsync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-i", centeredVideo, "-frames:v", "1", "-f", "md5", "-"]);
    const reframeHash = await execFileAsync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-i", reframedVideo, "-frames:v", "1", "-f", "md5", "-"]);
    assert.notEqual(centerHash.stdout.trim(), reframeHash.stdout.trim(), "The selected target must change the rendered crop.");
    const probe = await execFileAsync(ffprobe, ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", reframedVideo]);
    const videoStream = JSON.parse(probe.stdout).streams[0];
    assert.equal(videoStream.width, 1080);
    assert.equal(videoStream.height, 1920);

    process.stdout.write("Cortes inteligentes: link sem arquivo, job legado, upload de MP4 com referência, legendas, retomada e renderização verificados.\n");
  } finally {
    const resolved = path.resolve(tempDir);
    assert.ok(resolved.startsWith(`${tempRoot}${path.sep}`), "Refusing to remove a path outside tmp/.");
    await fs.rm(resolved, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
