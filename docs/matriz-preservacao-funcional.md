# Matriz de preservacao funcional — Leste Audio IA

Esta matriz registra o comportamento observado antes da evolucao descrita no prompt Flow Leste. Ela guia a migracao; nao afirma que todos os fluxos foram testados de ponta a ponta.

## Estado inicial

- Stack: Next.js 15 App Router, TypeScript, React 19, Tailwind, Node.js >=20, OpenAI SDK, FFmpeg e IndexedDB.
- A arvore de trabalho ja estava suja antes desta auditoria. As mudancas existentes em audio em lote, recuperacao de sessao e continuidade foram mantidas; nada foi revertido.
- A configuracao efetiva reportada por `/api/health` e OpenAI para texto, audio e voz. Valores de `.env.local` nao foram lidos nem registrados.
- `npm run test:session`, `npm run test:openai-audio-prep`, `npm run typecheck` e `npm run lint` passam.
- `npm run test:voice` falha no baseline: o endpoint retorna `uploadOnly` no modo OpenAI, mas o teste espera os campos de uma sessao Live Gemini. A escuta progressiva nao esta implementada para OpenAI.

## Estado apos a migracao desta rodada

- OpenAI e o unico provedor selecionado pelo codigo ativo para texto, transcricao, voz, imagem e video; as implementacoes Gemini/DeepSeek foram mantidas como legado, sem fallback automatico.
- `Flow Leste · ditado inteligente` usa WebRTC Realtime com token efemero, atualizacao parcial/final, vocabulário/snippets em IndexedDB e fallback para o arquivo gravado em memoria.
- A rota de analise de arquivo usa transcricao OpenAI seguida de analise textual OpenAI. A interface usa diretamente a rota de transcricao existente para evitar uma segunda transcricao.
- A transcricao de arquivo, o resumo, a geracao de voz MP3 e a emissao do token Live foram testados contra a API OpenAI com conteudo sintetico curto. O handshake WebRTC e o microfone fisico nao foram exercitados.
- A transcricao temporal de YouTube/cortes usa `whisper-1` temporariamente; a OpenAI anunciou seu encerramento em 2027-02-26. Falantes e tonalidade acustica nao sao identificados; a analise YouTube descreve ate oito quadros amostrados, nao todo o video.
- Nenhum segredo foi lido, alterado ou incluido em arquivos; `.env.local` nao foi tocado.

## Recursos e contratos que devem permanecer

| Area | Comportamento observado e arquivos | Invariantes de compatibilidade | Verificacao de regressao |
|---|---|---|---|
| Upload e lote de audios | `UploadArea`, `AudioList`, `AudioCard`, `LesteAudioApp`, `/api/transcribe`, `openai-audio.ts`, `audio-convert.ts`; fila local suporta lotes grandes, pausa/retomada/cancelamento e reprocessamento | Nao perder arquivo/transcricao concluida; falha individual nao encerra lote; respeitar limites e temporarios | `test:session`, `test:openai-audio-prep`, `test:audio-recorder`; fixture de audio pequeno quando autorizada chamada real |
| Gravacao | `AudioRecorder.tsx` e `LiveVoicePanel.tsx`; captura local com MediaRecorder e transcreve progressivamente via OpenAI Realtime/WebRTC; falha Live preserva o arquivo em memoria para upload | Permissao explicita de microfone; texto parcial nao pode substituir texto final; audio completo deve sobreviver a falha de conexao | `test:voice` valida token; `test:voice:audio` valida TTS/transcricao/resumo/token; WebRTC no browser e hardware seguem pendentes |
| Interpretacao de voz | `/api/voice-interpret`, `voiceSession.ts`, `types/voice.ts`; modos atuais e estado semantico incremental | Transcricao literal e revisao permanecem separadas; preservar modos existentes e JSON validado | Teste de contrato da rota para cada modo e entrada invalida |
| Correcao textual | `TextCorrectorPanel.tsx`, `/api/text-correct`, `prompts/textCorrect.ts` | Preservar os modos e nao alterar significado; saida textual limpa | Teste dos modos, acentos, URLs, listas e texto de audio |
| Texto e analise geral | `/api/analyze-all`, `analyze-context`, `ask-files`, `summarize`, `organize`, `detect-intent`, `audio-content`, `/api/text-correct`; `text-ai.ts` delega a OpenAI | Preservar formas de request/response e resultados; falha OpenAI nao apaga transcricao nem envia texto a outro fornecedor | `test:voice:audio` cobre resumo real; typecheck/build cobrem interfaces; nem todas as rotas tiveram chamada real individual |
| PDF, DOCX e projetos editoriais | `/api/pdf-extract`, `/api/pdf-process`, `EditorialWorkflowPanel`, `PdfPanel`, `PdfAudiobookPanel`, `LocalProjectsPanel`, IndexedDB | Preservar formato dos snapshots e projetos locais existentes; nao salvar midia original | Testes de leitura e exportacao DOCX/TXT; fixture de snapshot v1 |
| Voz Milena e audiobook | `/api/speech`, `MilenaVozPanel`, `PdfAudiobookPanel`, `openai-realtime-tts.ts`, `speech-mp3.ts`; OpenAI Realtime produz PCM e MP3/WAV por blocos | Manter revisao, controles, downloads, capitulos e fila; voz `marin` e sintetica, nao clonada; estimativa antiga de preco Gemini foi removida | `test:voice:audio` passou em geracao MP3 real e decodificacao FFmpeg; audiobook completo longo nao foi gerado |
| Imagens | `/api/image-extract`, `lib/image.ts`; Responses API OpenAI no servidor | Manter MIME/extensoes, extracao e texto copiavel | Endpoint testado contra a OpenAI com PNG sintetico; nao testado OCR de texto real |
| YouTube, Instagram e URLs | `VideoLinkInput`, `transcribe-url`, `youtube-info`, `youtube-analyze`, `lib/video/source-url.ts`, `youtube-download.ts`; yt-dlp/FFmpeg adquirem mídia, OpenAI transcreve/analisa | Preservar URLs permitidas, bloqueio de fontes privadas, limites, cortes e limpeza; OpenAI nao baixa mídia das redes | Teste de URL pública e downloader nao foi executado nesta rodada |
| Cortes inteligentes | `SmartClipsPanel`, `/api/cuts/jobs/**`, `lib/video/transcript.ts`, FFmpeg; Whisper gera timestamps e OpenAI cura candidatos | Manter contrato temporal, analise/render/download e expiracao; participantes/tonalidade/cenas nao sao gerados pela transcricao migrada | Testes reais de job/render ainda pendentes; `whisper-1` sera descontinuado em 2027-02-26 |
| Continuidade e exportacao | `ContinuityPanel`, `/api/organize-sequence`, `/api/session-narrative`, `continuity-batches.ts`, `narrative-export.ts`, DOCX/TXT | Preservar IDs/fontes, ordem revisavel, transcricao integral separada da narrativa; nao inventar conexoes | `test:continuity-batches`, `test:session-recovery`, testes de DOCX |
| Privacidade e armazenamento | `local-project-store.ts`, `SessionRecovery.tsx`; IndexedDB guarda snapshots/texto, nao audio original. Temporarios ficam em `tmp/` no backend | Nao persistir audio silenciosamente; limpeza em `finally`; manter leitura de projetos v1 | `test:session-recovery`, verificacao de limpeza e restauracao |
| Seguranca de endpoints | Route Handlers validam varios limites; apenas Live token tem rate limit em memoria e checagem simples de Origin. Nao foi encontrada autenticacao global do app | Segredo apenas no servidor; custo limitado; protecao remota deve ser avaliada sem quebrar localhost | Testes 400/403/413/429, CORS/Origin e abuso em ambiente local |

## Mapa dos provedores ativos encontrados

- Abstracao textual: `src/lib/text-ai.ts` seleciona DeepSeek, Gemini ou OpenAI.
- Adaptadores Gemini/DeepSeek permanecem nos arquivos legados (`gemini*.ts`, `deepseek.ts`), mas `readEnv()` fixa a selecao de trafego ativo em OpenAI.
- OpenAI ativo: `openai-audio.ts`, `openai-text.ts`, `openai-realtime-tts.ts`, `image.ts`, `video/transcript.ts`, `/api/audio-analyze`, `/api/image-extract`, `/api/live-transcribe-token`, `/api/transcribe`, `/api/transcribe-url` e `/api/youtube-analyze`.
- `/api/youtube-analyze` conserva nomes antigos de campos e eventos SSE (`gemini`, `deepseek`) como contrato interno de compatibilidade; mensagens exibidas indicam OpenAI.
- `.env.example` agora apresenta apenas variaveis OpenAI ativas; parser ainda aceita nomes legados sem escolher esses provedores.

## Escopo evolutivo e limites

1. O ditado ao vivo, vocabulario e snippets locais foram integrados no painel existente; falta validar o handshake WebRTC e a qualidade com microfone real no navegador.
2. Migracao de texto, audio de arquivo, imagem, YouTube e cortes foi conectada a OpenAI, mantendo contratos externos/legados. Ainda faltam chamadas de regressao dedicadas por rota e render de corte real.
3. Nao criar extensao de navegador nem aplicativo Windows nesta etapa: sao integracoes independentes e opcionais; o ditado web funciona dentro do Leste Audio IA.
4. Historico remoto, autenticacao, comandos de edicao por voz e reconexao automatica nao foram adicionados. Em falha Live, o arquivo gravado e processado por upload para evitar lacunas.
5. Testes simulados comprovam controle de fluxo, nao qualidade de audio real. Chamadas OpenAI reais devem usar fixtures sinteticas curtas e numero limitado de requests.

## Documentacao oficial consultada

- [Transcricao em tempo real](https://developers.openai.com/api/docs/guides/realtime-transcription): `gpt-live-transcribe`, eventos delta/final, 24 kHz PCM e ausencia de diarizacao/timestamps.
- [Criacao de client secrets](https://developers.openai.com/api/reference/resources/realtime/subresources/client_secrets/methods/create): segredo efemero e configuracao da sessao de transcricao.
- [WebRTC Realtime](https://developers.openai.com/api/docs/guides/realtime-webrtc): transporte recomendado no browser e credenciais efemeras.
- [Transcricao de arquivos](https://developers.openai.com/api/docs/guides/speech-to-text): `gpt-transcribe`, limite de 25 MB por request e formatos aceitos.
- [Text-to-speech](https://developers.openai.com/api/docs/guides/text-to-speech): fluxo TTS atual e cronograma de descontinuacao divulgado pela OpenAI.
