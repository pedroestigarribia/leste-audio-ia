const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const ffmpeg = require("ffmpeg-static");

const baseUrl = process.env.TEST_BASE_URL || "http://localhost:3000";

async function main() {
  if (typeof WebSocket !== "function") throw new Error("Este teste exige Node com WebSocket nativo.");
  const speech = await fetch(`${baseUrl}/api/speech`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Quero criar uma landing page para o Leste Valley. Não quero login. Use Next.js.", format: "mp3" }),
  });
  assert.equal(speech.status, 200, (await speech.clone().text()).slice(0, 250));
  assert.match(speech.headers.get("content-type") || "", /audio/);
  const mp3 = Buffer.from(await speech.arrayBuffer());
  assert.ok(mp3.length > 1000);
  console.log(`TTS OK: ${mp3.length} bytes de áudio de teste.`);

  const form = new FormData();
  form.append("file", new Blob([mp3], { type: "audio/mpeg" }), "teste-voz-leste.mp3");
  const fileResponse = await fetch(`${baseUrl}/api/transcribe`, { method: "POST", body: form });
  const filePayload = await fileResponse.json();
  assert.equal(fileResponse.status, 200, filePayload.error || "Falha na transcrição de arquivo");
  assert.ok((filePayload.transcription || "").trim().length > 10);
  console.log(`Transcrição de arquivo OK: ${filePayload.transcription.length} caracteres.`);

  const decoded = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-ar", "16000", "-ac", "1", "-f", "s16le", "pipe:1"], {
    input: mp3,
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
  assert.equal(decoded.status, 0, decoded.stderr?.toString().slice(0, 250));
  const pcm = decoded.stdout;
  assert.ok(pcm.length > 3200);

  const tokenResponse = await fetch(`${baseUrl}/api/live-transcribe-token`, { method: "POST" });
  const token = await tokenResponse.json();
  assert.equal(tokenResponse.status, 200, token.error || "Falha ao emitir token Live");

  const liveText = await new Promise((resolve, reject) => {
    const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(token.token)}`;
    const ws = new WebSocket(url);
    let offset = 0;
    let transcript = "";
    let interval;
    const timeout = setTimeout(() => finish(new Error("Timeout da transcrição Live")), 60_000);
    function finish(error) {
      clearTimeout(timeout);
      clearInterval(interval);
      ws.close();
      if (error) reject(error);
      else resolve(transcript);
    }
    ws.onopen = () => ws.send(JSON.stringify({
      setup: {
        model: `models/${token.model}`,
        generationConfig: { responseModalities: ["TEXT"] },
        inputAudioTranscription: token.config.inputAudioTranscription,
      },
    }));
    ws.onmessage = async (event) => {
      try {
        const raw = typeof event.data === "string" ? event.data : await event.data.text();
        const message = JSON.parse(raw);
        if (message.error) return finish(new Error(message.error.message || "Live recusou áudio"));
        if (message.serverContent?.inputTranscription?.text) {
          transcript += ` ${message.serverContent.inputTranscription.text}`;
        }
        if (message.setupComplete) {
          interval = setInterval(() => {
            if (offset < pcm.length) {
              const chunk = pcm.subarray(offset, offset + 3200);
              offset += chunk.length;
              ws.send(JSON.stringify({ realtimeInput: { audio: { data: chunk.toString("base64"), mimeType: "audio/pcm;rate=16000" } } }));
            } else {
              clearInterval(interval);
              ws.send(JSON.stringify({ realtimeInput: { audioStreamEnd: true } }));
              setTimeout(() => finish(transcript.trim() ? null : new Error("Live não retornou texto final")), 8000);
            }
          }, 100);
        }
      } catch (error) { finish(error); }
    };
    ws.onerror = () => finish(new Error("Falha de WebSocket Live"));
  });
  assert.ok(liveText.trim().length > 10);
  console.log(`Transcrição ao vivo OK: ${liveText.trim().length} caracteres.`);

  const existingIntentResponse = await fetch(`${baseUrl}/api/detect-intent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: liveText }),
  });
  const existingIntentPayload = await existingIntentResponse.json();
  assert.equal(existingIntentResponse.status, 200, existingIntentPayload.error || "Falha no interpretador de intenção existente");
  const existingIntent = JSON.parse(existingIntentPayload.result);
  assert.ok(existingIntent.intencao_principal);
  console.log("Integração com o interpretador de intenção existente OK.");

  const voiceStateResponse = await fetch(`${baseUrl}/api/voice-interpret`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      newText: liveText,
      previous: {
        intent: "", domain: "", artifact: "", requirements: [], exclusions: [],
        technologies: [], corrections: [], openQuestions: [], normalizedText: "",
        interpretation: "", output: "",
      },
      mode: "auto",
      fullRefresh: true,
    }),
  });
  const voiceStatePayload = await voiceStateResponse.json();
  assert.equal(voiceStateResponse.status, 200, voiceStatePayload.error || "Falha ao estruturar o entendimento da voz");
  assert.ok(voiceStatePayload.state?.normalizedText?.trim());
  assert.ok(voiceStatePayload.state?.output?.trim());
  console.log("Interpretação contextual da voz OK.");
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
