export const TRANSCRIPTION_PROMPT = `Transcreva este áudio em português brasileiro com máxima fidelidade.

Regras:

- Não resuma.
- Não invente.
- Não corrija a fala a ponto de mudar o sentido.
- Preserve nomes próprios, empresas, lugares, valores, datas e horários quando forem citados.
- Quando houver trecho incerto, marque como [trecho incerto].
- Quando houver trecho inaudível, marque como [inaudível].
- Separe em parágrafos curtos.
- Se parecer haver mais de uma pessoa falando, identifique como Pessoa 1, Pessoa 2, Pessoa 3.
- Não traduza.
- Entregue apenas a transcrição completa.`;
