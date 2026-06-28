export const TRANSCRIPTION_PROMPT = `Transcreva este audio em portugues brasileiro com maxima fidelidade.

Regras:

- Nao resuma.
- Nao invente.
- Nao corrija a fala a ponto de mudar o sentido.
- Preserve nomes proprios, empresas, lugares, valores, datas e horarios quando forem citados.
- Quando houver trecho incerto, marque como [trecho incerto].
- Quando houver trecho inaudivel, marque como [inaudivel].
- Separe em paragrafos curtos.
- Se parecer haver mais de uma pessoa falando, identifique como Pessoa 1, Pessoa 2, Pessoa 3.
- Nao traduza.
- Entregue apenas a transcricao completa.`;
