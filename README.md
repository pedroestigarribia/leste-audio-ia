# Leste Audio IA

Web app local em Next.js para upload, transcrição, resumo, organização, interpretação, cópia e leitura com voz de áudios do WhatsApp, textos, PDFs e imagens.

## Objetivo

Rodar primeiro em `localhost`, processar múltiplos áudios enviados manualmente pelo usuário e manter as chaves de API apenas no backend.

## Stack

- Next.js com App Router
- TypeScript
- Tailwind CSS
- Route Handlers do Next.js
- Node.js runtime
- Gemini API para transcrição
- Gemini API para transcrição, resumo, organização e análise geral
- DeepSeek API opcional para processamento textual alternativo
- Gemini API para leitura com voz da Milena e geração de texto a partir de imagem
- `ffmpeg-static` com fallback para FFmpeg do sistema
- exportação TXT e DOCX em texto puro

## Estrutura principal

```text
src/
  app/
    api/
      health/route.ts
      transcribe/route.ts
      summarize/route.ts
      organize/route.ts
      analyze-all/route.ts
      export-txt/route.ts
      image-extract/route.ts
      pdf-extract/route.ts
      pdf-process/route.ts
      speech/route.ts
    globals.css
    layout.tsx
    page.tsx
  components/
    ActionButton.tsx
    AppHeader.tsx
    AudioCard.tsx
    AudioList.tsx
    EmptyState.tsx
    ErrorBox.tsx
    LesteAudioApp.tsx
    ProgressBar.tsx
    ResultPanel.tsx
    TextImageVoicePanel.tsx
    SmartClipsPanel.tsx
    UploadArea.tsx
  lib/
    audio.ts
    clipboard.ts
    deepseek.ts
    export-docx.ts
    env.ts
    export-txt.ts
    format.ts
    gemini.ts
    gemini-text.ts
    gemini-tts.ts
    text-ai.ts
    image.ts
    multipart.ts
    pdf.ts
    plain-text.ts
    queue.ts
    temp-files.ts
    video/
      curator.ts
      job-store.ts
      pipeline.ts
      preferences.ts
      probe.ts
      render-job.ts
      render.ts
      scenes.ts
      tools.ts
      upload.ts
      youtube-source.ts
  prompts/
    analyzeAll.ts
    organize.ts
    summarize.ts
    transcription.ts
  types/
    audio.ts
```

## Como instalar

Requisito:

- Node.js `>= 20`

Passos:

```bash
npm install
```

## Como criar o `.env.local`

1. Copie o arquivo de exemplo:

```bash
cp .env.example .env.local
```

2. Preencha as chaves:

```env
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.7-flash
GEMINI_TRANSCRIBE_MODEL=gemini-3.5-transcribe
GEMINI_AUDIO_UNDERSTANDING_MODEL=gemini-3.8-flash
GEMINI_TEXT_MODEL=gemini-3.8-flash
GEMINI_TTS_MODEL=gemini-3.1-flash-tts-preview
GEMINI_TTS_AUDIOBOOK_MODEL=gemini-2.5-pro-preview-tts
GEMINI_LIVE_MODEL=gemini-3.1-flash-live-preview
GEMINI_TTS_VOICE=Kore
TEXT_AI_PROVIDER=gemini

DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-pro

MAX_PARALLEL_TRANSCRIPTIONS=3
MAX_FILE_SIZE_MB=125
MAX_VIDEO_UPLOAD_MB=125
MAX_VIDEO_DURATION_SEC=7200
MAX_ACTIVE_CUT_JOBS=2
MAX_ANALYSIS_CONCURRENCY=1
MAX_RENDER_CONCURRENCY=1
CUT_OUTPUT_TTL_MINUTES=60
PROCESS_TIMEOUT_MS=900000
YTDLP_BIN=yt-dlp
FFMPEG_BIN=
FFPROBE_BIN=
TEMP_UPLOAD_DIR=./tmp/uploads

APP_NAME=Leste Audio IA
```

Se faltar `GEMINI_API_KEY`, as rotas de transcrição e leitura em voz retornam erro claro.

Se `TEXT_AI_PROVIDER=deepseek`, as rotas de texto usam a DeepSeek e exigem
`DEEPSEEK_API_KEY`. O padrão é `TEXT_AI_PROVIDER=gemini`, que usa somente
`GEMINI_API_KEY` para as tarefas textuais.

A interface não cai por causa disso. Ela mostra a mensagem:

`Configure a chave da API no arquivo .env.local`

## Como obter e configurar a Gemini API key

1. Gere uma chave no painel da Gemini API / Google AI Studio.
2. Cole a chave em `GEMINI_API_KEY`.
3. Use `GEMINI_TRANSCRIBE_MODEL=gemini-3.5-transcribe` para a transcrição dedicada, com modo inteligente em português brasileiro.
4. Use `GEMINI_AUDIO_UNDERSTANDING_MODEL=gemini-3.8-flash` para entendimento multimodal de áudio e vídeo.
5. Use `GEMINI_TEXT_MODEL=gemini-3.8-flash` para resumo, organização, interpretação, prompts, PDF e demais tarefas textuais.
6. Use `GEMINI_TTS_MODEL=gemini-3.1-flash-tts-preview` para leituras comuns da Milena.
7. Use `GEMINI_TTS_AUDIOBOOK_MODEL=gemini-2.5-pro-preview-tts` para audiobook e narrações longas.
8. `GEMINI_LIVE_MODEL=gemini-3.1-flash-live-preview` fica reservado para uma futura interface Live com WebSocket/WebRTC.
9. `GEMINI_TTS_VOICE=Kore` seleciona a voz predefinida usada pela Milena.

## Como obter e configurar a DeepSeek API key

1. Gere uma chave no painel da DeepSeek.
2. Cole a chave em `DEEPSEEK_API_KEY`.
3. Mantenha:
   - `DEEPSEEK_BASE_URL=https://api.deepseek.com`
   - `DEEPSEEK_MODEL=deepseek-v4-pro`

## Modelos usados

- `GEMINI_TRANSCRIBE_MODEL=gemini-3.5-transcribe` para transcrição dedicada
- `GEMINI_AUDIO_UNDERSTANDING_MODEL=gemini-3.8-flash` para entendimento de áudio e vídeo
- `GEMINI_TEXT_MODEL=gemini-3.8-flash` para texto e multimodalidade textual
- `GEMINI_MODEL=gemini-3.7-flash` como contingência para a rota legada de transcrição
- `GEMINI_TTS_MODEL=gemini-3.1-flash-tts-preview` para voz rápida
- `GEMINI_TTS_AUDIOBOOK_MODEL=gemini-2.5-pro-preview-tts` para audiobook
- `GEMINI_LIVE_MODEL=gemini-3.1-flash-live-preview` para futura conversação em tempo real
- `TEXT_AI_PROVIDER=gemini` para deixar Gemini como provedor textual padrão
- `DEEPSEEK_MODEL=deepseek-v4-pro`

Os identificadores acima seguem a documentação atual do Gemini. A rota de
transcrição usa a Interactions API com `store: false`, para não manter a sessão
ou o texto no serviço, e remove o arquivo remoto ao concluir.

## Como rodar em localhost

Jeito mais simples (Windows): dê dois cliques em `iniciar-leste-audio-ia.cmd`.

Esse iniciador verifica de verdade se o app está funcionando antes de abrir o
navegador: confere `/api/health`, carrega a página inicial e testa cada arquivo
estático que ela referencia. Se algo estiver quebrado, ele encerra o servidor
defeituoso, limpa o cache de compilação e sobe um novo sozinho.

Opções:

```bash
iniciar-leste-audio-ia.cmd              # inicia ou reaproveita o servidor
iniciar-leste-audio-ia.cmd -Reiniciar   # força encerrar e subir de novo
iniciar-leste-audio-ia.cmd -Limpar      # zera o cache de compilação antes
iniciar-leste-audio-ia.cmd -NoOpen      # não abre o navegador
```

Pela linha de comando:

```bash
npm run dev
```

Abrir:

`http://localhost:3000`

## Instalar em outro computador

O projeto pode ser distribuído como um ZIP limpo. O pacote não inclui `node_modules`, caches, `tmp`, `.git` ou `.env.local`; isso evita transportar dependências específicas do computador e, principalmente, chaves de API.

### Gerar o pacote

Na pasta do projeto, execute:

```bash
npm run package:windows
```

O arquivo gerado é `leste-audio-ia-distribuicao.zip`. Ele contém o código completo, `package-lock.json`, documentação, scripts de inicialização e os documentos técnicos disponíveis.

### Instalar no Windows

1. Copie `leste-audio-ia-distribuicao.zip` para o outro computador.
2. Extraia o ZIP para uma pasta sem bloquear a execução, por exemplo `C:\Apps\leste-audio-ia`.
3. Confirme que o Node.js `20` ou superior está instalado.
4. Dê dois cliques em `instalar-leste-audio-ia.cmd`.
5. O instalador cria `.env.local`, instala as dependências, cria o atalho `Leste Audio IA - Iniciar.lnk` na Área de Trabalho e inicia o app.
6. Preencha as chaves no `.env.local` e use o atalho novamente para reiniciar o servidor.

Também é possível executar `iniciar-leste-audio-ia.cmd` diretamente. Ele instala dependências se necessário, verifica a página e abre o navegador em uma porta livre entre `3000` e `3010`.

O `ffmpeg-static` é instalado pelo `npm install`. Para análise de vídeos, instale FFprobe no sistema e configure `FFPROBE_BIN` quando ele não estiver no `PATH`. Para links do YouTube, instale `yt-dlp` e configure `YTDLP_BIN`. Upload de arquivo local não depende do YouTube.

### Diretórios de build separados

`next dev` compila em `.next-dev` e `next build` compila em `.next`. Essa
separação existe porque rodar um `npm run build` com o `npm run dev` no ar
sobrescrevia os arquivos que o servidor de desenvolvimento já tinha carregado
em memória, deixando o app servindo uma página em branco até alguém reiniciar
tudo manualmente. Com os diretórios separados, os dois podem rodar ao mesmo
tempo sem se atrapalhar.

Produção (`npm run build`, `npm start`, `npm run start:next`) continua usando
`.next` normalmente — nada muda no deploy.

## URL de produção planejada

Domínio:

`https://lesteaudio.space`

## Como testar com áudio do WhatsApp

1. Exporte, baixe ou encaminhe os áudios para sua máquina.
2. Abra o app em `http://localhost:3000`.
3. Arraste ou selecione os arquivos.
4. Clique em `Transcrever áudios`.
5. Use os botões individuais e gerais para resumo, organização, interpretação, tarefas, dados-chave, resposta para WhatsApp, cópia e exportação.
6. Use a área de texto livre para converter qualquer texto em voz da Milena e baixar o áudio.
7. Use a área de imagem para enviar PNG, JPG, JPEG ou WEBP, gerar texto da imagem, copiar, ouvir e baixar a voz.
8. Envie um contrato, PDF ou DOCX na área `Contratos, PDF e DOCX: análise e audiolivro`. O app identifica o tipo de documento, produz análise, resumo e interpretação; então escolha quando gerar MP3s da conclusão, ouvir com controles de pausa e baixar o resultado.
9. Para livros, a leitura natural é preparada automaticamente; escolha quando gerar capítulos em MP3, ouvir com controles de pausa e baixar cada capítulo ou o audiobook completo.

## Fluxo implementado

1. O usuário escolhe um ou vários arquivos.
2. O frontend valida extensão e tamanho antes de enviar.
3. Os arquivos só são enviados quando o usuário clica em `Transcrever áudios`.
4. A fila processa no máximo `MAX_PARALLEL_TRANSCRIPTIONS`.
5. A rota `/api/transcribe` recebe um arquivo por requisição.
6. O backend salva temporariamente o arquivo.
7. Tenta transcrever com Gemini.
8. Se falhar em formato problemático, converte para WAV mono 16 kHz e tenta de novo.
9. O backend limpa os temporários no `finally`.
10. Após uma transcrição concluída, o app gera automaticamente o resumo, a interpretação do arquivo original e a identificação de assunto, contexto e intenção. Falhas em uma dessas análises não removem a transcrição nem bloqueiam os outros itens.
11. A geração de voz nunca é automática: em cada resumo, interpretação, texto organizado ou conteúdo derivado, o usuário escolhe `Transformar em áudio` antes de criar o MP3 com a Milena.
12. O texto fica apenas na sessão atual da interface.
13. O usuário pode continuar adicionando mais 10 áudios ou mais sem perder os arquivos já listados.
14. O painel geral permite ouvir os áudios enquanto organiza e analisa o conteúdo.
13. A área de texto livre permite colar conteúdo, gerar voz da Milena e baixar MP3.
14. A área de imagem envia a imagem ao backend, usa Gemini para gerar texto e permite copiar, ouvir e baixar a leitura.
15. Após extrair um PDF ou DOCX, o app gera em paralelo a identificação do tipo de documento, a análise, o resumo e a interpretação. Contratos recebem atenção adicional para partes, vigência, obrigações, valores, condições, riscos e ambiguidades, sem substituir avaliação jurídica profissional.
16. PDFs com texto pesquisável e arquivos DOCX são divididos em capítulos para audiobook. A geração ocorre em fila, um capítulo por vez, para evitar uma requisição longa e permitir retomar apenas o capítulo que falhar.
17. Em cada áudio transcrito, a análise automática identifica assunto, contexto, intenção, temas, insights, tarefas, decisões, dados-chave, riscos, oportunidades e estrutura narrativa a partir do arquivo original.
18. Depois da análise, também é possível gerar artigo, copy, post, roteiro, storytelling, resposta para WhatsApp, plano de negócios ou estratégia de marketing. Todo resultado pode ser copiado, baixado em DOCX, ouvido com a voz da Milena e baixado em MP3.
19. A área `Cortes Inteligentes` aceita MP4/MOV/WEBM/M4V, processa o vídeo em job assíncrono, mostra cada etapa, permite cancelar, encontra trechos por descoberta ou busca semântica e oferece revisão manual dos intervalos.
20. Cada candidato de corte recebe título, tema, trecho, score heurístico de retenção, critérios, legenda, copy, hashtags, participantes, confiança e alertas para revisão.
21. O usuário escolhe cortes, formato 9:16/1:1/16:9, legenda simples/dinâmica ou sem legenda e reenquadramento base. O renderizador entrega MP4 para assistir/baixar e SRT separado.

## Processamento temporário e privacidade

- Não salva áudio em banco.
- Não salva áudio em storage permanente.
- Não cria histórico automático.
- Não usa `localStorage`.
- Não usa `IndexedDB`.
- O backend usa `tmp/uploads` apenas durante o processamento.
- O arquivo original e o arquivo convertido são apagados no `finally`.
- Um vídeo usado em `Cortes Inteligentes` fica em `tmp/cuts/<jobId>` apenas até o job ser removido ou expirar; isso permite revisar e renderizar cortes sem reenviar o original.
- Em erro, a limpeza também é tentada.
- A transcrição dedicada e a análise multimodal usam `store: false` na Interactions API.
- O arquivo remoto enviado ao Gemini é removido ao fim de cada operação, inclusive em falha.
- Não existe log da transcrição completa por padrão.
- As chaves ficam no backend.

## Conversão com FFmpeg

Conversão padrão:

```bash
ffmpeg -y -i input -ac 1 -ar 16000 output.wav
```

Ordem de tentativa:

1. `ffmpeg-static`
2. `ffmpeg` instalado no sistema

Se ambos falharem, a API retorna erro claro orientando a verificar o FFmpeg.

## Health check

`GET /api/health`

Resposta:

```json
{
  "ok": true,
  "app": "Leste Audio IA",
  "geminiModel": "gemini-3.7-flash",
  "geminiTranscribeModel": "gemini-3.5-transcribe",
  "geminiAudioUnderstandingModel": "gemini-3.8-flash",
  "geminiTextModel": "gemini-3.8-flash",
  "geminiTtsModel": "gemini-3.1-flash-tts-preview",
  "geminiAudiobookTtsModel": "gemini-2.5-pro-preview-tts",
  "geminiLiveModel": "gemini-3.1-flash-live-preview",
  "textAiProvider": "gemini",
  "deepseekModel": "deepseek-v4-pro"
}
```

## APIs internas

### `POST /api/transcribe`

- Entrada: `multipart/form-data`
- Campo: `file`
- Responsabilidade: validar, salvar temporariamente, transcrever, converter se preciso, limpar temporários

### `POST /api/audio-analyze`

- Entrada: `multipart/form-data`, campo `file`
- Analisa o arquivo original com `gemini-3.8-flash`: assunto, contexto, intenção, temas, insights, tarefas, decisões, dados-chave, riscos, oportunidades e estrutura narrativa
- Retorna JSON estruturado, sem salvar histórico e com `store: false`

### `POST /api/audio-content`

Entrada JSON: `kind`, `transcription` e `analysis` retornada por `/api/audio-analyze`.

- Formatos: `article`, `copy`, `post`, `script`, `storytelling`, `whatsapp` e `audiobookOutline`
- Retorna texto puro, pronto para copiar ou narrar com a Milena

### `POST /api/summarize`

Entrada:

```json
{
  "text": "texto",
  "mode": "single"
}
```

### `POST /api/organize`

Entrada:

```json
{
  "text": "texto",
  "mode": "all"
}
```

### `POST /api/analyze-all`

Entrada:

```json
{
  "items": [
    {
      "name": "audio1.ogg",
      "transcription": "..."
    }
  ],
  "mode": "analysis"
}
```

Modos disponíveis:

- `analysis`
- `tasks`
- `keyData`
- `reply`

### `POST /api/export-txt`

Rota pronta para gerar TXT no backend, embora o download atual seja feito no frontend para evitar reenvio desnecessário.

### `POST /api/speech`

Entrada:

```json
{
  "title": "Resumo geral",
  "text": "texto para leitura",
  "format": "mp3"
}
```

Retorna áudio para a leitura com voz da Milena. O app entrega `audio/mpeg` em MP3. Se a conversão para MP3 falhar, a rota retorna erro claro em vez de baixar WAV. O estilo `audiolivro` seleciona automaticamente `GEMINI_TTS_AUDIOBOOK_MODEL`.

Observações:

- A rota aceita textos de até 24.000 caracteres.
- Textos longos de PDF, resumo geral, organização geral, texto livre e imagem são divididos em blocos menores.
- Os blocos de voz são reunidos e convertidos em um único MP3 para download.
- A conversão usa `ffmpeg-static` ou `ffmpeg` do sistema.

### `POST /api/image-extract`

- Entrada: `multipart/form-data`
- Campo: `file`
- Formatos aceitos: PNG, JPG, JPEG e WEBP
- Responsabilidade: validar imagem, enviar ao Gemini pelo backend e retornar texto limpo, copiável e pronto para leitura com voz.

### `POST /api/pdf-extract`

- Entrada: `multipart/form-data`
- Campo: `file`
- Formatos aceitos: PDF e DOCX.
- Responsabilidade: validar o documento, extrair texto pesquisável ou textual e retornar o conteúdo para a sessão atual.
- PDFs escaneados que contêm apenas imagens precisam de OCR antes da extração; a primeira versão não faz OCR local.

### Audiobook de PDF e DOCX

- O painel divide automaticamente o livro por títulos de capítulo quando encontrados ou por blocos de leitura de até cerca de 9.000 caracteres.
- Ao terminar a extração, o app prepara automaticamente uma versão de `Leitura natural` para o audiobook, preservando o conteúdo. A geração do MP3 continua opcional.
- `Leitura fiel` preserva o texto; `Leitura natural` ajusta a fluidez; `Adaptar para ouvir` reorganiza a leitura sem resumir.
- Cada capítulo é gerado como MP3, pode ser pausado no player nativo e baixado separadamente.
- Depois que todos os capítulos estiverem prontos, `Baixar audiobook completo` reúne os MP3s na ordem dos capítulos no navegador.
- Áudios do audiobook ficam apenas na sessão atual do navegador e são removidos ao limpar o PDF ou sair da página.

### `POST /api/pdf-process`

Entrada:

```json
{
  "text": "texto extraído do PDF",
  "mode": "summary"
}
```

Modos disponíveis:

- `analysis`: identifica o tipo do documento, finalidade, partes, dados-chave, obrigações, riscos e ambiguidades.
- `summary`
- `interpretation`: explica implicações práticas, compromissos, riscos, dúvidas e conclusão com base no texto.
- `organize`
- `grammar`
- `clean`

### Cortes Inteligentes

O módulo de vídeo usa jobs temporários em `tmp/cuts/<jobId>`. O estado público nunca inclui caminhos absolutos do servidor.

#### `POST /api/cuts/jobs`

Para upload, envie `multipart/form-data` com o campo `file` e, opcionalmente, `preferences` como JSON. Para YouTube, envie JSON:

```json
{
  "sourceType": "youtube",
  "url": "https://www.youtube.com/watch?v=...",
  "preferences": {
    "mode": "discover",
    "genre": "Podcast",
    "durationPreset": "30-60",
    "desiredCount": 8
  }
}
```

O retorno é `201` com `jobId` e estado inicial. Formatos locais: `.mp4`, `.mov`, `.webm` e `.m4v`. O limite padrão é `MAX_VIDEO_UPLOAD_MB=125`; a duração padrão máxima é `MAX_VIDEO_DURATION_SEC=7200`.

#### `POST /api/cuts/jobs/:jobId/analyze`

Inicia o processamento em segundo plano e retorna `202`. O frontend consulta `GET /api/cuts/jobs/:jobId` até `ready_for_review`, `completed`, `failed` ou `cancelled`.

Etapas: validar, adquirir, sondar metadados, extrair áudio mono 16 kHz, transcrever, detectar cenas, analisar semântica, gerar candidatos e pontuar diversidade/retensão. O primeiro downloader é `yt-dlp`; `@distube/ytdl-core` é fallback para links HTTPS públicos do YouTube.

#### `POST /api/cuts/jobs/:jobId/render`

Recebe os candidatos escolhidos, possíveis ajustes de início/fim e opções de saída:

```json
{
  "clips": [{ "candidateId": "candidate-...", "startTime": 12.4, "endTime": 58.1 }],
  "options": { "aspectRatio": "9:16", "captionPreset": "simple", "reframeMode": "center" }
}
```

O MP4 usa H.264/AAC, `yuv420p` e `faststart`, com SRT separado. Se a build do FFmpeg não tiver libass, o MP4 é gerado sem legenda queimada e o SRT continua disponível.

#### Outros endpoints

- `GET /api/cuts/jobs/:jobId`: estado, progresso, transcrição temporal, candidatos e saídas públicas.
- `POST /api/cuts/jobs/:jobId/cancel`: cancela o job e sinaliza o processo FFmpeg/Gemini.
- `DELETE /api/cuts/jobs/:jobId`: remove o job e todos os temporários.
- `GET /api/cuts/jobs/:jobId/outputs/:outputId`: assiste/baixa MP4; use `?format=srt` para a legenda.

#### Dependências do ambiente de vídeo

- `ffmpeg-static` cobre o FFmpeg no Node.js; `FFMPEG_BIN` pode apontar para uma instalação do sistema.
- FFprobe é necessário para duração e streams. Configure `FFPROBE_BIN` quando o executável não estiver no PATH.
- `yt-dlp` é recomendado para YouTube. Configure `YTDLP_BIN` quando o comando não estiver no PATH. O fallback do SDK pode continuar sujeito a bloqueios do YouTube.
- Links privados, vídeos com login, lives indisponíveis e conteúdos protegidos podem ser recusados; nesse caso, envie o arquivo MP4.

## Formatos aceitos

- `.ogg`
- `.opus`
- `.m4a`
- `.mp3`
- `.wav`
- `.webm`
- `.aac`
- `.flac`

## Formatos de vídeo aceitos

- `.mp4`
- `.mov`
- `.webm`
- `.m4v`

## Formatos de imagem aceitos

- `.png`
- `.jpg`
- `.jpeg`
- `.webp`

## Scripts

```json
{
  "dev": "next dev",
  "dev:clean": "apaga .next-dev e roda next dev",
  "clean": "apaga .next, .next-dev e tsconfig.tsbuildinfo",
  "build": "next build",
  "start": "node server.js",
  "start:next": "next start",
  "lint": "next lint",
  "typecheck": "tsc --noEmit"
}
```

### Se o app abrir em branco ou não abrir

Quase sempre é cache de compilação corrompido. Resolva com:

```bash
iniciar-leste-audio-ia.cmd -Reiniciar -Limpar
```

Ou manualmente:

```bash
npm run dev:clean
```

Os logs do servidor local ficam em `tmp/local-dev.out.log` e
`tmp/local-dev.err.log`.

## Dependências adicionais usadas

Além da lista principal pedida, o projeto usa:

- `docx`: para gerar download `.docx` no frontend sem reenviar o conteúdo ao backend.
- `@breezystack/lamejs`: para gerar MP3 da voz da Milena em memória, sem depender de arquivos temporários ou FFmpeg nessa etapa.
- `execa`: para executar `ffmpeg-static` ou `ffmpeg` do sistema com menos acoplamento.
- `pdf-parse`: para extrair texto pesquisável de PDFs no backend.
- `mammoth`: para extrair o texto de arquivos DOCX no backend, sem armazenar o documento.
- `@types/node`, `@types/react`, `@types/react-dom`: suporte de tipagem para TypeScript.
- `@types/pdf-parse`: suporte de tipagem para leitura de PDF.
- `eslint` e `eslint-config-next`: necessários para `npm run lint`.

## Como subir para GitHub

1. Inicialize o repositório, se ainda não existir.
2. Garanta que `.env.local` não foi versionado.
3. Faça commit do projeto sem segredos.
4. Envie para o GitHub.

Exemplo:

```bash
git init
git add .
git commit -m "feat: bootstrap Leste Audio IA"
git branch -M main
git remote add origin <url-do-repo>
git push -u origin main
```

## Como preparar para Hostinger

Este projeto deve ser publicado como **Node.js Web App**, nao como Hostinger Horizons. O Horizons recria outro app em React/JavaScript e nao preserva as rotas backend do Next.js, upload multipart, Gemini, DeepSeek e FFmpeg.

Checklist de deploy via GitHub:

1. Suba o projeto para GitHub.
2. No hPanel, acesse `Websites`.
3. Se `lesteaudio.space` ja estiver associado a outro tipo de site, remova esse website primeiro ou escolha criar um novo Node.js Web App para o dominio correto.
4. Clique em `Add Website`.
5. Escolha `Node.js Web App`.
6. Escolha `Import Git repository`.
7. Conecte o GitHub e selecione `pedroestigarribia/leste-audio-ia`.
8. Use a branch `main`.
9. Configure:
   - Node: `20` ou superior
   - Build command: `npm run build`
   - Start command: `npm run start`
   - Startup file, se o painel pedir: `server.js`
10. Configure as variáveis de ambiente:
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL`
   - `GEMINI_TTS_MODEL`
   - `GEMINI_TTS_VOICE`
   - `DEEPSEEK_API_KEY`
   - `DEEPSEEK_BASE_URL`
   - `DEEPSEEK_MODEL`
   - `MAX_PARALLEL_TRANSCRIPTIONS`
   - `MAX_FILE_SIZE_MB`
   - `MAX_VIDEO_UPLOAD_MB`
   - `MAX_VIDEO_DURATION_SEC`
   - `MAX_ACTIVE_CUT_JOBS`
   - `MAX_ANALYSIS_CONCURRENCY`
   - `MAX_RENDER_CONCURRENCY`
   - `CUT_OUTPUT_TTL_MINUTES`
   - `PROCESS_TIMEOUT_MS`
   - `YTDLP_BIN`
   - `TEMP_UPLOAD_DIR`
11. Configure o domínio `lesteaudio.space` para apontar para o projeto publicado.
12. Verifique se o ambiente suporta `ffmpeg-static` e FFprobe. Configure `FFPROBE_BIN` se o Hostinger não expuser `ffprobe` no PATH.
13. Instale `yt-dlp` no VPS e configure `YTDLP_BIN` para ativar a melhor aquisição de vídeos do YouTube.
14. Se FFmpeg/FFprobe/yt-dlp falharem na Hostinger, use um VPS/plano com esses binários ou mantenha o fluxo por upload de MP4.
15. Garanta que `TEMP_UPLOAD_DIR` aponta para uma pasta gravável, por exemplo `./tmp/uploads`, e não para um arquivo existente. Se aparecer erro `EEXIST`, limpe a pasta temporária e reinicie o app Node.js.

Se o repositório nao aparecer na Hostinger:

1. Abra `https://github.com/settings/installations`.
2. Procure a instalacao da Hostinger.
3. Clique em `Configure`.
4. Em `Repository access`, selecione `All repositories` ou marque manualmente `leste-audio-ia`.
5. Salve.
6. Volte para a Hostinger e reconecte o GitHub.
7. Confira se a Hostinger esta conectada na conta GitHub `pedroestigarribia`, nao em outra conta.

Plano B via ZIP:

1. Gere um ZIP limpo com:
   ```bash
   git archive --format=zip --output leste-audio-ia-hostinger.zip HEAD
   ```
2. No hPanel, escolha `Node.js Web App`.
3. Escolha upload de arquivos.
4. Envie `leste-audio-ia-hostinger.zip`.
5. Configure os mesmos comandos:
   - Build command: `npm run build`
   - Start command: `npm run start`
   - Startup file, se pedido: `server.js`
6. Configure as variáveis de ambiente no painel.

### Se aparecer `Application error: a client-side exception has occurred`

Esse erro pode acontecer quando a CDN/cache da Hostinger entrega um HTML antigo apontando para arquivos antigos em `/_next/static/...` que nao existem mais no build atual. O sintoma mais comum e a raiz `/` responder com `Cache-Control: s-maxage=31536000` e algum chunk antigo retornar `404`.

Como corrigir no hPanel:

1. Confirme que o ultimo commit da branch `main` foi redeployado.
2. Rode novamente o build do Node.js Web App.
3. Reinicie o app Node.js.
4. Limpe/purge o cache/CDN da Hostinger para `lesteaudio.space`.
5. Abra `https://lesteaudio.space/?v=<commit-atual>` para forcar uma primeira carga sem cache.
6. Depois abra `https://lesteaudio.space` e confirme que a raiz nao esta mais usando HTML antigo.

O projeto tambem inclui protecoes contra esse caso:

- `server.js` intercepta assets antigos quando o start command usa `npm run start`.
- `next.config.mjs` reescreve assets antigos conhecidos quando o ambiente usa `next start`.
- A rota `/` envia `Cache-Control: no-store, no-cache, max-age=0, must-revalidate`.

## Limitações conhecidas do produto

- Não integra diretamente com WhatsApp.
- O usuário precisa baixar ou encaminhar os áudios e subir no app.
- Não salva histórico.
- Não divide arquivos grandes automaticamente.
- O player de áudio funciona apenas durante a sessão atual, enquanto o arquivo ainda está no navegador.
- Texto livre e imagem processada ficam apenas na sessão atual da tela.
- A extração de imagem depende da legibilidade do texto e da qualidade visual da imagem.
- Imagens sem texto podem gerar uma descrição objetiva do conteúdo visível.
- A qualidade da transcrição depende da qualidade do áudio.
- Áudios com ruído, sobreposição de vozes ou fala distante podem gerar trechos incertos.
- O Gemini transcreve; o DeepSeek interpreta apenas o texto já transcrito.
- A remoção remota de arquivo no Gemini é feita em modo best effort e depende da versão do SDK suportar exclusão.
- A aquisição do YouTube depende das políticas e formatos disponíveis no momento; o upload de MP4 é o caminho de contingência.
- A transcrição temporal é gerada pela IA e deve ser revisada antes de publicar um corte.
- O reenquadramento `face`, `speaker`, `subject` e `screen` mantém o pipeline compatível, mas a renderização atual usa o enquadramento central como fallback seguro; rastreamento visual dedicado pode ser conectado depois.
- A legenda dinâmica usa o mesmo SRT-base da legenda simples nesta etapa.
- O produto não mantém histórico ou autenticação; jobs e saídas são temporários e expiram conforme configuração.

## Próximos recursos possíveis

- Chunking automático de arquivos grandes
- Upload por lote com cancelamento explícito
- Histórico opcional com banco de dados
- Tags e classificação por conversa
- Exportação PDF
- Resposta pronta por perfil de uso

## Checklist de testes manuais

- [ ] Abrir `http://localhost:3000`
- [ ] Ver tela inicial
- [ ] Selecionar 1 áudio `.ogg` do WhatsApp
- [ ] Transcrever
- [ ] Copiar transcrição
- [ ] Selecionar vários áudios
- [ ] Adicionar mais 10 áudios sem limpar a lista atual
- [ ] Transcrever todos
- [ ] Ver progresso por áudio
- [ ] Confirmar resumo, interpretação e assunto gerados automaticamente após transcrever um áudio
- [ ] Resumir um áudio
- [ ] Organizar um áudio
- [ ] Criar plano de negócios ou estratégia de marketing a partir da análise de um áudio
- [ ] Baixar o conteúdo completo de um áudio em DOCX
- [ ] Interpretar todos
- [ ] Extrair tarefas e dados-chave no painel geral
- [ ] Gerar resposta pronta para WhatsApp
- [ ] Copiar todas as transcrições
- [ ] Baixar transcrições em TXT
- [ ] Baixar transcrições em DOCX
- [ ] Baixar organização geral em TXT
- [ ] Baixar organização geral em DOCX
- [ ] Ouvir os áudios no painel geral
- [ ] Gerar leitura com voz da Milena
- [ ] Pausar e parar a leitura da Milena pelo player
- [ ] Baixar a leitura da Milena em MP3
- [ ] Colar texto livre
- [ ] Gerar voz da Milena a partir do texto livre
- [ ] Baixar a voz do texto livre
- [ ] Enviar imagem PNG, JPG, JPEG ou WEBP
- [ ] Gerar texto a partir da imagem
- [ ] Copiar texto gerado da imagem
- [ ] Gerar voz da Milena a partir do texto da imagem
- [ ] Baixar a voz do texto da imagem
- [ ] Enviar contrato, PDF ou DOCX
- [ ] Ver texto extraído do documento no painel
- [ ] Confirmar tipo, finalidade, partes, dados-chave, riscos e ambiguidades identificados no documento
- [ ] Resumir, interpretar, organizar, ajustar gramática e limpar o texto do documento
- [ ] Ouvir texto do documento com a Milena
- [ ] Gerar, ouvir e baixar MP3 do resumo ou da interpretação do documento
- [ ] Preparar PDF ou DOCX de livro para audiobook
- [ ] Gerar e ouvir capítulos do audiobook com pausa no player
- [ ] Baixar um capítulo em MP3
- [ ] Baixar audiobook completo em MP3 após gerar todos os capítulos
- [ ] Limpar tudo
- [ ] Confirmar que arquivos temporários foram apagados
- [ ] Confirmar que `.env.local` não foi versionado
- [ ] Confirmar que build passou
- [ ] Enviar um vídeo MP4 de até 125 MB
- [ ] Analisar vídeo e acompanhar cada etapa do job
- [ ] Buscar um momento por descrição semântica
- [ ] Revisar início/fim de um candidato
- [ ] Gerar MP4 vertical com legenda e baixar SRT
- [ ] Assistir o MP4 gerado diretamente no painel
- [ ] Cancelar um processamento em andamento
- [ ] Testar link público do YouTube com `yt-dlp` instalado

## Validação local obrigatória

```bash
npm run typecheck
npm run lint
npm run build
```

## Observações de segurança

- Nunca mova chaves para o frontend.
- Nunca faça commit de `.env.local`.
- Não registre tokens em log.
- Não exponha transcrições em logs por padrão.
