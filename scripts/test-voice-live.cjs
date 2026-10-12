const assert = require("node:assert/strict");

const baseUrl = process.env.TEST_BASE_URL || "http://localhost:3000";

async function main() {
  const health = await fetch(`${baseUrl}/api/health`).then((response) => response.json());
  assert.equal(health.ok, true);
  assert.equal(health.geminiLiveTranscribeModel, "gemini-3.5-transcribe-live");

  const invalid = await fetch(`${baseUrl}/api/voice-interpret`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newText: "", mode: "invalid" }),
  });
  assert.equal(invalid.status, 400);

  const forbidden = await fetch(`${baseUrl}/api/live-transcribe-token`, {
    method: "POST",
    headers: { Origin: "https://example.invalid" },
  });
  assert.equal(forbidden.status, 403);

  const response = await fetch(`${baseUrl}/api/live-transcribe-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vocabulary: ["Mulheres do Leste"] }),
  });
  const payload = await response.json();
  assert.equal(response.status, 200, payload.error || "Falha ao emitir token temporário");
  assert.equal(payload.ok, true);
  assert.match(payload.token, /^auth_tokens\//);
  assert.equal(payload.model, health.geminiLiveTranscribeModel);
  assert.ok(payload.config.inputAudioTranscription.customVocabulary.includes("Mulheres do Leste"));

  if (typeof WebSocket !== "function") {
    console.log("HTTP OK. WebSocket não disponível nesta versão do Node; teste manual pendente.");
    return;
  }

  await new Promise((resolve, reject) => {
    const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token=${encodeURIComponent(payload.token)}`;
    const ws = new WebSocket(url);
    const timeout = setTimeout(() => { ws.close(); reject(new Error("Timeout no setup Live")); }, 15_000);
    ws.onopen = () => ws.send(JSON.stringify({
      setup: {
        model: `models/${payload.model}`,
        generationConfig: { responseModalities: ["TEXT"] },
        inputAudioTranscription: payload.config.inputAudioTranscription,
      },
    }));
    ws.onmessage = async (event) => {
      const raw = typeof event.data === "string" ? event.data : await event.data.text();
      const message = JSON.parse(raw);
      if (message.setupComplete) {
        clearTimeout(timeout);
        ws.close();
        resolve();
      } else if (message.error) {
        clearTimeout(timeout);
        ws.close();
        reject(new Error(message.error.message || "Live recusou setup"));
      }
    };
    ws.onerror = () => { clearTimeout(timeout); reject(new Error("Falha de conexão WebSocket Live")); };
    ws.onclose = (event) => {
      if (event.code !== 1000 && event.code !== 1005) {
        clearTimeout(timeout);
        reject(new Error(`Live fechou antes do setup: ${event.code} ${event.reason}`));
      }
    };
  });

  console.log("HTTP, token temporário e handshake WebSocket Live OK.");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
