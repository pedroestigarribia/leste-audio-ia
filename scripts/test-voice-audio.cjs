const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const ffmpeg = require("ffmpeg-static");

const baseUrl = process.env.TEST_BASE_URL || "http://localhost:3000";
const sampleText = "Teste do Leste Audio IA. A reunião de demonstração ficou para sexta-feira às dez horas.";

async function main() {
  const speech = await fetch(`${baseUrl}/api/speech`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: sampleText, format: "mp3" }),
  });
  assert.equal(speech.status, 200, (await speech.clone().text()).slice(0, 250));
  assert.match(speech.headers.get("content-type") || "", /audio\/mpeg/);
  const mp3 = Buffer.from(await speech.arrayBuffer());
  assert.ok(mp3.length > 1000, "A voz da Milena retornou MP3 vazio.");

  const decoded = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-ar", "24000", "-ac", "1", "-f", "s16le", "pipe:1"], {
    input: mp3,
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
  assert.equal(decoded.status, 0, decoded.stderr?.toString().slice(0, 250));
  assert.ok(decoded.stdout.length > 4800, "FFmpeg não decodificou o MP3 para áudio PCM utilizável.");
  console.log(`Milena/TTS MP3 e decodificação FFmpeg OK (${mp3.length} bytes).`);

  const form = new FormData();
  form.append("file", new Blob([mp3], { type: "audio/mpeg" }), "teste-voz-leste.mp3");
  const transcriptionResponse = await fetch(`${baseUrl}/api/transcribe`, { method: "POST", body: form });
  const transcription = await transcriptionResponse.json();
  assert.equal(transcriptionResponse.status, 200, transcription.error || "Falha na transcrição OpenAI.");
  assert.ok((transcription.transcription || "").trim().length > 10);
  assert.match(transcription.meta?.model || "", /^gpt-transcribe/);
  console.log(`Transcrição OpenAI do MP3 gerado OK (${transcription.transcription.length} caracteres).`);

  const summaryResponse = await fetch(`${baseUrl}/api/summarize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: transcription.transcription, mode: "single" }),
  });
  const summary = await summaryResponse.json();
  assert.equal(summaryResponse.status, 200, summary.error || "Falha no resumo OpenAI.");
  assert.ok(summary.result?.trim());
  assert.match(summary.model || "", /^gpt-/);
  console.log("Resumo OpenAI OK.");

  const analysisForm = new FormData();
  analysisForm.append("file", new Blob([mp3], { type: "audio/mpeg" }), "teste-analise-leste.mp3");
  const analysisResponse = await fetch(`${baseUrl}/api/audio-analyze`, { method: "POST", body: analysisForm });
  const analysis = await analysisResponse.json();
  assert.equal(analysisResponse.status, 200, analysis.error || "Falha na rota compatível de análise de áudio.");
  assert.ok(analysis.result && typeof analysis.result === "object");
  assert.match(analysis.model || "", /^gpt-/);
  console.log("Análise compatível de áudio OpenAI OK.");

  const imageForm = new FormData();
  const generatedPng = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=white:s=64x64:d=0.1", "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "pipe:1"], {
    maxBuffer: 1024 * 1024,
    windowsHide: true,
  });
  assert.equal(generatedPng.status, 0, generatedPng.stderr?.toString().slice(0, 250));
  imageForm.append("file", new Blob([generatedPng.stdout], { type: "image/png" }), "teste-openai.png");
  const imageResponse = await fetch(`${baseUrl}/api/image-extract`, { method: "POST", body: imageForm });
  const image = await imageResponse.json();
  assert.equal(imageResponse.status, 200, image.error || "Falha na leitura multimodal de imagem OpenAI.");
  assert.ok(image.text?.trim());
  console.log("Entrada multimodal de imagem OpenAI OK.");

  const tokenResponse = await fetch(`${baseUrl}/api/live-transcribe-token`, { method: "POST" });
  const token = await tokenResponse.json();
  assert.equal(tokenResponse.status, 200, token.error || "Falha ao emitir token Live.");
  assert.equal(token.provider, "openai");
  assert.match(token.token || "", /^ek_/);
  assert.match(token.model || "", /^gpt-live-transcribe/);
  console.log("Token efêmero da sessão Realtime OpenAI OK; conexão WebRTC de navegador não foi exercitada neste teste Node.");
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
