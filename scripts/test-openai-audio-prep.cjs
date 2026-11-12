const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const { promises: fs } = require("node:fs");
const path = require("node:path");
const { promisify } = require("node:util");
const ffmpegStatic = require("ffmpeg-static");
const ffprobeStatic = require("@derhuerst/ffprobe-static");

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(process.cwd());
const tempRoot = path.resolve(projectRoot, "tmp");

async function main() {
  assert.ok(tempRoot.startsWith(`${projectRoot}${path.sep}`), "Test temp path must stay inside the project.");
  await fs.mkdir(tempRoot, { recursive: true });
  const testDir = await fs.mkdtemp(path.join(tempRoot, "openai-audio-test-"));

  try {
    const inputPath = path.join(testDir, "synthetic.wav");
    const outputPattern = path.join(testDir, "part-%05d.mp3");
    const ffmpeg = ffmpegStatic || process.env.FFMPEG_BIN || "ffmpeg";
    const ffprobe = ffprobeStatic || process.env.FFPROBE_BIN || "ffprobe";

    await execFileAsync(ffmpeg, [
      "-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=channel_layout=mono:sample_rate=16000",
      "-t", "605", "-c:a", "pcm_s16le", inputPath,
    ]);
    await execFileAsync(ffmpeg, [
      "-v", "error", "-y", "-i", inputPath, "-map", "0:a:0", "-vn", "-ac", "1", "-ar", "16000",
      "-c:a", "libmp3lame", "-b:a", "32k", "-f", "segment", "-segment_time", "600",
      "-reset_timestamps", "1", "-segment_format", "mp3", outputPattern,
    ]);

    const parts = (await fs.readdir(testDir)).filter((name) => /^part-\d{5}\.mp3$/.test(name)).sort();
    assert.equal(parts.length, 2, "605 seconds of media must become two ordered parts.");

    const durations = await Promise.all(parts.map(async (name) => {
      const { stdout } = await execFileAsync(ffprobe, [
        "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path.join(testDir, name),
      ]);
      const stat = await fs.stat(path.join(testDir, name));
      assert.ok(stat.size < 25 * 1024 * 1024, "Each part must stay under the API file limit.");
      return Number(stdout.trim());
    }));

    assert.ok(Math.abs(durations.reduce((sum, value) => sum + value, 0) - 605) < 1);
    process.stdout.write(`FFmpeg OK: ${parts.length} parts cover ${durations.reduce((sum, value) => sum + value, 0).toFixed(2)} seconds.\n`);
  } finally {
    const resolved = path.resolve(testDir);
    assert.ok(resolved.startsWith(`${tempRoot}${path.sep}`), "Refusing to remove a path outside tmp/.");
    await fs.rm(resolved, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
