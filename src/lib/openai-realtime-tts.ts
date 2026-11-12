import "server-only";

import WebSocket from "ws";

import { getServerEnv, requireOpenAIApiKey } from "@/lib/env";

export async function synthesizeSpeechWithOpenAI(prompt: string): Promise<Buffer> {
  const env = getServerEnv();
  const socket = new WebSocket(
    `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(env.openAiRealtimeTtsModel)}`,
    {
      headers: {
        Authorization: `Bearer ${requireOpenAIApiKey()}`,
        "OpenAI-Beta": "realtime=v1",
      },
    },
  );

  return new Promise((resolve, reject) => {
    const audio: Buffer[] = [];
    let settled = false;
    const timeout = setTimeout(() => finish(new Error("Tempo limite excedido ao gerar a voz.")), 180_000);

    function finish(error?: Error) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket.removeAllListeners();
      socket.terminate();
      if (error) reject(error);
      else resolve(Buffer.concat(audio));
    }

    socket.once("open", () => {
      socket.send(JSON.stringify({
        type: "session.update",
        session: {
          type: "realtime",
          output_modalities: ["audio"],
          audio: { output: { format: { type: "audio/pcm", rate: 24_000 }, voice: env.openAiTtsVoice } },
        },
      }));
    });

    socket.on("message", (data) => {
      let event: {
        type?: string;
        delta?: string;
        response?: { status?: string; status_details?: { error?: { message?: string } } };
        error?: { message?: string };
      };
      try {
        event = JSON.parse(data.toString()) as typeof event;
      } catch {
        finish(new Error("A OpenAI retornou um evento de voz inválido."));
        return;
      }

      if (event.type === "error") {
        finish(new Error(event.error?.message || "A OpenAI recusou a geração de voz."));
      } else if (event.type === "session.updated") {
        socket.send(JSON.stringify({
          type: "response.create",
          response: {
            conversation: "none",
            output_modalities: ["audio"],
            instructions: "Leia em português brasileiro, com voz natural e clara. Este áudio é uma narração gerada por inteligência artificial.",
            input: [{ type: "message", role: "user", content: [{ type: "input_text", text: prompt }] }],
          },
        }));
      } else if (event.type === "response.output_audio.delta" && event.delta) {
        audio.push(Buffer.from(event.delta, "base64"));
      } else if (event.type === "response.done") {
        if (event.response?.status === "failed") {
          finish(new Error(event.response.status_details?.error?.message || "A geração de voz falhou."));
        } else if (audio.length) {
          finish();
        } else {
          finish(new Error("A OpenAI concluiu sem retornar áudio."));
        }
      }
    });

    socket.once("error", (error) => finish(new Error(`Falha na conexão de voz OpenAI: ${error.message}`)));
    socket.once("close", (code) => {
      if (!settled) finish(new Error(`A conexão de voz OpenAI foi encerrada (código ${code}).`));
    });
  });
}
