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
- IndexedDB nativo do navegador para projetos locais explicitamente salvos, sem persistir mídia original
- `fflate` para empacotar capítulos MP3 e roteiro em ZIP, sem enviar os áudios gerados ao servidor
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
GEMINI_LIVE_TRANSCRIBE_MODEL=gemini-3.5-transcribe-live
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
8. `GEMINI_LIVE_TRANSCRIBE_MODEL=gemini-3.5-transcribe-live` usa reconhecimento contínuo na área de escuta; `GEMINI_LIVE_MODEL` continua reservado para conversação de voz bidirecional futura.
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
- `GEMINI_LIVE_TRANSCRIBE_MODEL=gemini-3.5-transcribe-live` para transcrição ao vivo, independente da configuração de conversação
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

O arquivo gerado é `leste-audio-ia-distribuicao.zip`. Ele contém o código completo, `public/` (incluindo o processador de áudio ao vivo), `package-lock.json`, documentação, scripts de inicialização e os documentos técnicos disponíveis.

Esse pacote padrão não contém `.env.local`. Para uma transferência privada que leve também as chaves já configuradas, gere um ZIP separado:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/empacotar-leste-audio-ia.ps1 -IncludeLocalEnv -OutputPath "$env:USERPROFILE\Downloads\Leste-Audio-IA-privado.zip"
```

O pacote privado contém credenciais de API. Guarde-o apenas em armazenamento local seguro e não o envie ao GitHub, a hospedagens ou a serviços de compartilhamento.

### Backup local completo

Para criar um backup recuperável com código, documentação, `.git` e `.env.local`, execute:

```powershell
npm run backup:windows
```

O ZIP é salvo em `Downloads` com data e hora no nome. Ele exclui `node_modules`, caches de build, `tmp/` (uploads temporários) e pacotes ZIP antigos. O backup contém chaves de API e deve permanecer privado. Para escolher outro destino, execute o script diretamente com `-OutputPath "C:\caminho\arquivo.zip"`.

### Instalar no Windows

1. Copie `leste-audio-ia-distribuicao.zip` para o outro computador.
2. Extraia o ZIP para uma pasta sem bloquear a execução, por exemplo `C:\Apps\leste-audio-ia`.
3. Confirme que o Node.js `20` ou superior está instalado.
4. Dê dois cliques em `instalar-leste-audio-ia.cmd`.
5. O instalador cria `.env.local`, instala as dependências, cria o atalho `Leste Audio IA - Iniciar.lnk` na Área de Trabalho e inicia o app.
6. Preencha as chaves no `.env.local` e use o atalho novamente para reiniciar o servidor.

Também é possível executar `iniciar-leste-audio-ia.cmd` diretamente. Ele instala dependências se necessário, verifica a página e abre o navegador em uma porta livre entre `3000` e `3010`.

`npm install` instala `ffmpeg-static` e `@derhuerst/ffprobe-static`; o app também aceita os binários do sistema via `FFMPEG_BIN` e `FFPROBE_BIN`. A transcrição por link do Instagram/YouTube usa o `yt-dlp` empacotado por `youtube-dl-exec`. O instalador normalmente verifica Python; em Linux sem Python, configure `YOUTUBE_DL_SKIP_PYTHON_CHECK=1` e `YOUTUBE_DL_FILENAME=yt-dlp_linux` para baixar o executável autossuficiente oficial. Não use `YOUTUBE_DL_FILENAME=yt-dlp_linux` no Windows. `YTDLP_BIN` pode apontar para um binário compatível instalado no sistema. Para `Cortes Inteligentes`, mantenha `yt-dlp` disponível no servidor, pois esse fluxo também pode usar o executável do sistema. O upload local não depende das plataformas.

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

## Escuta ao vivo e interpretação da voz

1. No painel de processamento, clique em `Começar a ouvir`, permita o microfone e fale. O botão `Gravar áudio` anterior continua disponível para quem prefere processar somente após parar.
2. A fala é capturada como PCM mono de 16 kHz por AudioWorklet e enviada diretamente ao Gemini Live por WebSocket. A interface separa texto provisório de trechos confirmados. O MediaRecorder conserva uma cópia somente em memória durante a escuta para o fallback de transcrição de arquivo.
3. A cada trecho confirmado, com pausa de 2 segundos entre chamadas, `/api/voice-interpret` atualiza intenção, domínio, requisitos, exclusões, correções e texto normalizado. O modo pode ser Automático, Transcrição fiel, Texto limpo, Interpretação, Prompt, Especificação técnica, Codex, Claude, ChatGPT, Documento, WhatsApp ou Briefing criativo. A saída é editável, copiável e exportável em TXT/DOCX.
4. Para reaproveitar arquivos já enviados, escolha uma transcrição em `Analisar áudio já transcrito`. Ela usa o mesmo interpretador sem reenviar o arquivo de áudio. Mudanças de modo reinterpretam o texto completo. O vocabulário personalizado (até 50 termos) é aplicado às novas sessões Live.
5. Ao clicar em `Parar e processar`, uma transcrição Live concluída entra na lista existente e recebe resumo, organização, intenção e análise automática. Se não houver trechos finais ou ocorrer erro de WebSocket, a gravação inteira segue para `/api/transcribe` e nenhum trecho parcial é tratado como final. Quando o fallback também falha, o erro é mostrado e a gravação não é persistida.

O servidor emite apenas um token Live de uso único e curto prazo em `POST /api/live-transcribe-token`, restrito ao modelo e à configuração de transcrição. A chave permanente continua em `.env.local`/ambiente de produção. O endpoint limita novas sessões por IP (limite em memória do processo); sem autenticação, isso não substitui rate limiting externo e controle de custos na hospedagem. O navegador precisa de HTTPS em produção para abrir o microfone, e o ambiente deve permitir WebSocket de saída para a API do Google. A sessão Live do modelo dura até 10 minutos; em caso de desconexão, a gravação continua localmente para o fallback. O Live não fornece diarização nem timestamps por palavra; a análise posterior do arquivo pode adicionar informações quando disponíveis.

O processamento semântico usa `TEXT_AI_PROVIDER` e o modelo textual já configurado. Texto original não é sobrescrito por normalização; resultados de IA, inferências e correções devem ser revisados antes do uso. A transcrição salva em um projeto local entra como áudio textual, mas o resultado editável do painel de voz, isoladamente, deve ser copiado/exportado antes de sair da página.

Teste automatizado sem áudio: `npm run test:voice` (inclui token e handshake WebSocket). Teste real, com custo de API: `npm run test:voice:audio` (gera um MP3 sintético curto, testa TTS, transcrição de arquivo e transcrição Live; exige Node com WebSocket nativo). A transcrição sintética não é gravada em histórico. O teste de microfone físico e permissão deve ser feito manualmente no navegador.

Referências: [transcrição Live](https://ai.google.dev/gemini-api/docs/live-api/live-transcribe), [tokens temporários](https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens) e [referência da Live API](https://ai.google.dev/api/live). A API HTTP validada com a chave deste ambiente aceita `bidiGenerateContentSetup` na emissão do token; o WebSocket usa `BidiGenerateContentConstrained`.

## Processamento temporário e privacidade

- Não salva áudio em banco.
- Não salva áudio em storage permanente.
- Não cria histórico na nuvem nem exige login. O painel `Projetos neste computador` salva projetos nomeados no IndexedDB do navegador, no dispositivo e na mesma origem (`localhost` e porta usados para abrir o app). Salve/atualize o projeto depois das alterações para retomá-lo.
- O armazenamento local inclui transcrições, textos extraídos, análises, memória editorial, tarefas, aprovações, versões anteriores, seleção de capítulos e configurações de narração. Não inclui áudios, PDFs, DOCX ou imagens originais, nem MP3s gerados.
- É possível exportar um backup `.leste.json` e importá-lo em outro navegador/computador. Guarde o backup com segurança: ele pode conter transcrições e informações pessoais. Projetos locais podem ser pesquisados, abertos e apagados no painel.
- Ao reabrir um projeto, transcrições e resultados continuam disponíveis; para ouvir ou retranscrever, envie os áudios originais novamente. A geração de voz também precisa ser refeita porque MP3s ficam apenas na sessão atual.
- `Limpar tudo` limpa a sessão aberta, mas não apaga projetos locais salvos. Para remover um projeto persistente, use `Apagar projeto` no painel.
- Não usa `localStorage`.
- Usa `IndexedDB` somente para os projetos locais explicitamente salvos; não armazena arquivos de áudio nesse banco.
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
  "geminiLiveTranscribeModel": "gemini-3.5-transcribe-live",
  "textAiProvider": "gemini",
  "deepseekModel": "deepseek-v4-pro"
}
```

## APIs internas

### `POST /api/transcribe`

- Entrada: `multipart/form-data`
- Campo: `file`
- Responsabilidade: validar, salvar temporariamente, transcrever, converter se preciso, limpar temporários

### `POST /api/transcribe-url`

- Entrada JSON: `{ "url": "https://..." }`; aceita links diretos HTTPS de vídeos do YouTube e publicações/Reels do Instagram, um por requisição.
- Valida host e formato do link, consulta disponibilidade e usa duração dos metadados quando fornecida. Depois da extração, confirma a duração real com FFprobe; limita a mídia por `MAX_VIDEO_UPLOAD_MB` e `MAX_VIDEO_DURATION_SEC`, baixa somente a faixa de áudio para uma pasta temporária, transcreve com Gemini e remove a pasta no `finally`.
- A transcrição entra na mesma fila e recebe automaticamente resumo, organização, interpretação e identificação de intenção dos arquivos enviados.
- Não usa cookies, credenciais ou sessão do navegador. Conteúdo privado, bloqueado, indisponível ou com login obrigatório retorna erro individual; envie um arquivo de mídia autorizado como alternativa.
- Alternativa oficial para YouTube: a YouTube Data API exige OAuth para listar legendas e a operação `captions.download` exige permissão para editar o vídeo. Portanto, ela não oferece transcrição sem login para qualquer vídeo público; este app não pede OAuth nesta versão.
- Referências técnicas: [extrator Instagram do yt-dlp](https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/instagram.py), [wrapper Node youtube-dl-exec](https://github.com/microlinkhq/youtube-dl-exec), [API oficial de captions do YouTube](https://developers.google.com/youtube/v3/docs/captions/download) e [políticas para desenvolvedores do YouTube](https://developers.google.com/youtube/terms/developer-policies-guide). O extrator é de terceiros, não uma API oficial; revise os termos e direitos aplicáveis antes de disponibilizar a aquisição por link em produção.

### `POST /api/live-transcribe-token`

- Entrada JSON opcional: `{ "vocabulary": ["nome próprio", "termo técnico"] }` (máximo 50 termos de até 80 caracteres)
- Saída: token temporário de uso único, modelo e configuração restritos à transcrição. Não exponha a chave permanente no navegador nem registre o token em logs.
- Respostas de erro: `400` para vocabulário inválido, `403` para origem cruzada, `429` para excesso de sessões por IP e `502` para falha de configuração/provedor.

### `POST /api/voice-interpret`

- Entrada JSON: `newText`, `previous` (estado semântico), `mode` e `fullRefresh`. No modo incremental, envie apenas os novos trechos confirmados.
- Saída: `state` estruturado com intenção, domínio, artefato, requisitos, exclusões, tecnologias, correções, dúvidas, texto normalizado, interpretação e resultado final, além do modelo textual usado.
- Limite de 40.000 caracteres por novo trecho. Entrada inválida retorna `400`; falha do provedor ou formato inválido retorna `502`. Esta rota não armazena conteúdo no servidor.

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

### `POST /api/editorial-workflow`

Rota para os fluxos de biografia e reunião. Recebe fontes em blocos de até 8 itens, com limite de 9.000 caracteres por item, e executa uma etapa por chamada.

- `detect-project-type` sugere a trilha com justificativa e nível de confiança, sem trocar a escolha do usuário automaticamente.
- Biografias: `biography-memory` extrai o dossiê revisável; `biography-outline` propõe a estrutura; `biography-chapter` escreve um capítulo por vez usando a estrutura e as notas aprovadas. `womenMethod10=true` ativa o método padrão de 10 capítulos de Mulheres do Leste, com validação do número de capítulos no backend.
- Reuniões: `meeting-analysis` organiza contexto, assuntos, decisões, tarefas, prazos citados, pendências e sugestões de acompanhamento.
- Modos `*-merge` consolidam resultados parciais de lotes extensos.
- Respostas estruturadas de classificação, memória e tarefas preservam o JSON retornado pelo modelo; textos de leitura continuam normalizados para texto simples.
- As fontes e os resultados permanecem na sessão do navegador; a chave de IA é usada somente no backend.

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
- A entrada principal também aceita links diretos de Reels e vídeos do Instagram por `POST /api/transcribe-url`; o extractor do `yt-dlp` é best-effort e alguns Reels públicos podem exigir login, ser limitados ou deixar de funcionar após mudanças da plataforma. O app não usa cookies nem contorna essas restrições.
- Links privados, vídeos com login, lives indisponíveis e conteúdos protegidos podem ser recusados; nesse caso, envie o arquivo MP4.
- Use links apenas de conteúdo próprio ou para o qual você tenha autorização. A extração de mídia pode estar sujeita aos termos da plataforma e aos direitos autorais; a integração de link não é uma API oficial de download do YouTube/Instagram.

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
- `youtube-dl-exec`: wrapper Node.js do projeto `microlinkhq/youtube-dl-exec` para executar `yt-dlp` no servidor na aquisição temporária de áudio a partir de links. O instalador upstream baixa o binário; em Linux sem Python, use as variáveis `YOUTUBE_DL_SKIP_PYTHON_CHECK=1` e `YOUTUBE_DL_FILENAME=yt-dlp_linux`. Veja as limitações de acesso das plataformas acima.
- `@derhuerst/ffprobe-static`: fornece FFprobe em Windows, Linux e macOS para confirmar duração e presença de áudio em vídeos sem exigir instalação manual.
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
   - `GEMINI_TRANSCRIBE_MODEL`
   - `GEMINI_AUDIO_UNDERSTANDING_MODEL`
   - `GEMINI_TEXT_MODEL`
   - `GEMINI_LIVE_TRANSCRIBE_MODEL`
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
12. Verifique se o ambiente executa os binários empacotados `ffmpeg-static` e `@derhuerst/ffprobe-static`. Configure `FFPROBE_BIN` se preferir o FFprobe do sistema.
13. Na hospedagem Linux sem Python, configure `YOUTUBE_DL_SKIP_PYTHON_CHECK=1` e `YOUTUBE_DL_FILENAME=yt-dlp_linux` nas variáveis de ambiente antes do build. O segundo valor seleciona o executável Linux oficial, que não depende de Python instalado. Não aplique essa configuração ao Windows. Se usar um binário próprio, configure `YTDLP_BIN`.
14. Se FFmpeg/FFprobe/yt-dlp falharem na Hostinger, use um VPS/plano com esses binários ou mantenha o fluxo por upload de MP4. Links de Instagram/YouTube podem falhar por restrições externas mesmo com o binário instalado.
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
- Não salva histórico em servidor ou banco. Projetos nomeados podem ser salvos manualmente neste navegador, sem arquivos originais.
- Não divide o arquivo de áudio em segmentos de áudio automaticamente. As transcrições extensas, porém, são divididas em blocos numerados para resumo e análise textual, sem remover caracteres da transcrição original.
- O player de áudio funciona apenas durante a sessão atual, enquanto o arquivo ainda está no navegador.
- Texto livre e imagem processada ficam apenas na sessão atual da tela.
- A extração de imagem depende da legibilidade do texto e da qualidade visual da imagem.
- Imagens sem texto podem gerar uma descrição objetiva do conteúdo visível.
- A qualidade da transcrição depende da qualidade do áudio.
- Áudios com ruído, sobreposição de vozes ou fala distante podem gerar trechos incertos.
- O Gemini transcreve; o DeepSeek interpreta apenas o texto já transcrito.
- A remoção remota de arquivo no Gemini é feita em modo best effort e depende da versão do SDK suportar exclusão.
- A aquisição do YouTube depende das políticas e formatos disponíveis no momento; o upload de MP4 é o caminho de contingência.
- A aquisição sem login de links do Instagram também é best-effort; o acesso público no navegador não garante que a plataforma libere a faixa de áudio para extração automatizada.
- A transcrição temporal é gerada pela IA e deve ser revisada antes de publicar um corte.
- O reenquadramento `face`, `speaker`, `subject` e `screen` mantém o pipeline compatível, mas a renderização atual usa o enquadramento central como fallback seguro; rastreamento visual dedicado pode ser conectado depois.
- A legenda dinâmica usa o mesmo SRT-base da legenda simples nesta etapa.
- O produto não mantém histórico ou autenticação; jobs e saídas são temporários e expiram conforme configuração.

## Próximos recursos possíveis

- Chunking automático de arquivos grandes
- Identificação de falantes com revisão manual
- Histórico opcional com banco de dados
- Tags e classificação por conversa
- Exportação PDF
- Resposta pronta por perfil de uso

## Lotes grandes e entendimento da sessão

- A lista de arquivos não tem limite fixo de 50. O usuário pode selecionar lotes maiores e adicionar mais arquivos enquanto a fila estiver ativa; os novos itens válidos entram no final da fila.
- A fila respeita `MAX_PARALLEL_TRANSCRIPTIONS`, mantém status por arquivo e permite pausar, continuar ou cancelar. Pausar deixa terminar os uploads já iniciados. Cancelar impede os próximos e tenta interromper os uploads de transcrição ativos; análises individuais que já começaram podem terminar.
- Um erro em um arquivo não encerra os outros. Arquivos com erro podem ser reprocessados individualmente.
- Transcrições completas permanecem no navegador durante a sessão. Resumo, interpretação e organização gerais usam somente os arquivos marcados para análise; arquivos excluídos ou identificados como duplicados continuam disponíveis para consulta e exportação.
- A área “Entendimento geral da sessão” avisa quando novos arquivos, mudanças de seleção, remoções ou mudanças de ordem tornam a análise desatualizada. Resultados e grupos anteriores não são apagados. Quando somente áudios novos foram adicionados e a análise anterior está completa, é possível consolidar apenas os novos com os resultados anteriores ou regenerar tudo.
- Texto enviado à IA é particionado em trechos de até 9.000 caracteres, agrupados em chamadas limitadas e consolidados em etapas. Cada trecho conserva o nome do áudio e o marcador de parte. Os limites da API rejeitam excesso em vez de truncar silenciosamente. A transcrição original não é substituída pelos resumos parciais.
- As respostas globais pedem referências pelo nome do arquivo e separação entre fatos, inferências e sugestões. A atribuição depende da resposta do modelo e deve ser revisada; não há diarização/tempos garantidos quando o provedor não os fornece.
- “Continuidade e narrativa” permite renomear, dividir, unir e reordenar grupos, alterar a ordem dos áudios e excluir arquivos da análise sem removê-los da sessão. Lotes de continuidade grandes são processados por blocos; a interface alerta que relações entre blocos precisam de revisão manual.
- “Narrativa final revisável” gera formatos como relato fiel, cronologia, biografia, storytelling, roteiro, relatório ou WhatsApp. A narrativa fica separada das transcrições integrais, pode ser editada e só vira áudio se o usuário pedir “Gerar voz da Milena”. A geração TTS é uma leitura MP3 única nesta área; capítulos de audiobook continuam disponíveis no fluxo de documentos.
- Antes de baixar o DOCX completo, é possível selecionar transcrições, texto integral unificado, resumos e interpretações individuais, resultados gerais e narrativa revisada. O texto integral mantém a origem de cada trecho e pode seguir a ordem original ou a contextual sugerida.

O processamento textual em blocos não equivale a transcrever um áudio grande em partes. O endpoint de transcrição e os limites de tamanho de upload continuam sendo regidos pela configuração do ambiente e pelo provedor de áudio.

## Fluxo de produção editorial

A navegação no topo organiza as ferramentas em seis etapas: adicionar fontes, transcrever e extrair, entender e organizar, escrever e transformar, produzir vídeo e revisar/entregar. Os cartões levam diretamente às áreas correspondentes; as ferramentas continuam podendo ser usadas individualmente.

Na etapa editorial, escolha uma trilha:

- `Biografia Mulheres do Leste`: o método padrão usa exatamente 10 capítulos. Desative o método padrão para manter a trilha flexível de 5 a 10 capítulos.
- `Biografia completa`: planejar até 30 capítulos para a trajetória da pessoa.
- `Reunião de trabalho`: gerar um relatório separado com intenção provável, assuntos, posições, decisões, tarefas, responsáveis e prazos quando citados, dúvidas e próximos passos.

O fluxo editorial reúne áudios transcritos, PDF/DOCX extraídos e textos colados no painel `Materiais do projeto`. Dê nome ao texto recebido, marque se ele é relato da pessoa ou correção editorial e escolha quais fontes entram na análise. A origem de cada item permanece visível, e cada fonte ou o conjunto integral pode ser copiado. `Identificar tipo do material` sugere biografia, Mulheres do Leste, reunião ou objetivo indefinido; a seleção final é sua.

Para as biografias, escolha a narração em primeira pessoa, como se a pessoa contasse a própria história, ou em terceira pessoa, como ghostwriter. `Analisar todos os materiais e propor sumário` extrai a memória editorial das fontes selecionadas e só então propõe a estrutura. No método padrão Mulheres do Leste, o sumário tem 10 capítulos; revise e clique em `Aprovar sumário de 10 capítulos` antes de escrever. Cada capítulo é gerado separadamente e o próximo depende da aprovação do anterior. O método foi incorporado aos prompts do servidor por etapa; não é necessário colar o prompt mestre no campo de guia adicional.

Na trilha de biografia, cada fonte pode receber a pergunta que respondeu e uma associação opcional a um capítulo. Na escrita, fontes atribuídas a outros capítulos ficam de fora, enquanto fontes sem capítulo continuam como contexto geral. A pergunta orienta a leitura, mas nunca é tratada como prova de um fato. O guia adicional pode ser colado ou carregado como TXT/Markdown. A memória editorial separa pessoas, relações, cronologia, relatos, fatos aprovados, inferências, voz, falas características, conflitos, marcos, fatos reservados por capítulo e dúvidas; revise-a antes de usá-la como orientação.

Cada capítulo tem estado (planejado, rascunho, em revisão ou aprovado), fontes relacionadas, versões anteriores e texto editorial distinto da versão limpa para narração. O capítulo seguinte recebe automaticamente os títulos anteriores e o trecho final do capítulo aprovado imediatamente anterior, além das notas de continuidade preenchidas pelo editor. Gerar de novo um capítulo existente produz uma comparação e não substitui o atual sem aceite. É possível selecionar um trecho e revisar apenas aquele trecho. Cada capítulo oferece cópia da versão editorial e da versão limpa. Após aprovar todos os capítulos, `Copiar livro completo` e `Baixar livro completo em DOCX` reúnem o manuscrito em ordem, sem memória editorial, perguntas finais ou referências técnicas. `Baixar dossiê editorial DOCX` conserva o pacote de trabalho separado. Antes de narrar, edite/prepare a versão de voz; a Milena e os downloads em MP3 continuam opcionais.

O mapa de capítulos mostra fontes associadas e não aproveitadas. Perguntas complementares podem ser revisadas e copiadas como mensagem para WhatsApp. Para reuniões, encaminhamentos estruturados incluem responsável, prazo, situação, classificação (compromisso, proposta ou sugestão) e evidência/fonte, todos editáveis. A conferência final compara capítulos e fontes selecionadas em blocos, apontando lacunas, repetições e MP3s antigos; resultados de blocos diferentes exigem revisão editorial. O audiobook pode ser gerado para capítulos selecionados e retomado: capítulos que já têm MP3 em memória não são solicitados novamente. O pacote ZIP contém MP3s por capítulo e roteiro editorial; o download de áudio completo concatena os MP3s selecionados. A duração e o custo exibidos são estimativas, não cobrança garantida.

`Cortes Inteligentes` fica em uma etapa audiovisual própria, depois das trilhas editoriais. A análise do YouTube continua na preparação do conteúdo; a área de cortes seleciona, revisa e renderiza clipes. As duas áreas mantêm as funções atuais.

Como biografias podem levar várias sessões, `Projetos neste computador` permite salvar/atualizar por nome, buscar, abrir, apagar e exportar/importar um backup completo. O armazenamento é do navegador/dispositivo, sem conta e sem sincronização automática entre computadores. O backup JSON não inclui arquivos originais nem chaves de API. O recurso legado `Salvar projeto`/`Abrir projeto` em `.leste.json` permanece para intercâmbio do pacote editorial.

## Checklist de testes manuais

- [ ] Abrir `http://localhost:3000`
- [ ] Ver tela inicial
- [ ] Em `Escuta ao vivo`, permitir o microfone, falar e ver texto provisório e final confirmado
- [ ] Parar a escuta e confirmar que o áudio entra na lista para resumo, organização e interpretação
- [ ] Simular perda de conexão Live e confirmar fallback para transcrição da gravação inteira
- [ ] Testar vocabulário personalizado, correção posterior e restrição negativa (por exemplo: `não quero login`)
- [ ] Selecionar um áudio já transcrito no painel de voz e alternar os modos Codex, Documento e Texto limpo
- [ ] Copiar resultado e baixar TXT/DOCX do painel de voz sem alterar a transcrição fiel
- [ ] Testar microfone e responsividade em desktop e celular, inclusive permissão negada
- [ ] Selecionar 1 áudio `.ogg` do WhatsApp
- [ ] Transcrever
- [ ] Copiar transcrição
- [ ] Selecionar vários áudios
- [ ] Adicionar mais 10 áudios sem limpar a lista atual
- [ ] Adicionar arquivos enquanto a fila está rodando e confirmar que entram no final
- [ ] Pausar, continuar e cancelar a fila; confirmar que arquivos concluídos permanecem
- [ ] Reprocessar apenas um arquivo com erro
- [ ] Testar lotes simulados de 60 e 100 itens, sem chave de IA, confirmando contagem e conteúdo integral dos blocos
- [ ] Testar uma transcrição longa que gere várias partes, confirmar origem e ausência de cortes
- [ ] Marcar um áudio duplicado e excluir outro da análise sem removê-lo da sessão
- [ ] Reordenar grupos, alternar entre ordem original e contextual e revisar áudios ainda sem grupo
- [ ] Adicionar novo áudio após uma análise e confirmar que os resultados anteriores ficam visíveis e marcados como desatualizados
- [ ] Atualizar somente áudios novos e também testar regeneração completa
- [ ] Gerar narrativa em formatos diferentes, editar o texto e confirmar que a transcrição original não muda
- [ ] Pedir a voz da Milena manualmente, pausar/parar e baixar a narrativa em MP3
- [ ] Selecionar seções específicas no DOCX e confirmar que somente elas são exportadas
- [ ] Conferir fontes por nome do áudio, fatos, inferências, lacunas e transições editoriais sugeridas
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
- [ ] Salvar projeto com nome, fechar e reabrir no mesmo navegador
- [ ] Confirmar que transcrições, memória, tarefas, estado dos capítulos e versões anteriores foram restaurados
- [ ] Confirmar que os áudios não foram armazenados e precisam ser enviados novamente para reprodução
- [ ] Exportar backup `.leste.json` e importá-lo em outro perfil/navegador
- [ ] Apagar projeto salvo e confirmar que ele some da biblioteca
- [ ] Gerar memória editorial e corrigir/confirmar fatos manualmente
- [ ] Comparar a nova geração com um capítulo existente antes de aceitar
- [ ] Selecionar um parágrafo e revisar apenas o trecho selecionado
- [ ] Gerar perguntas complementares e copiar mensagem para WhatsApp
- [ ] Extrair tarefas da reunião, editar responsável/prazo/status e conferir evidências
- [ ] Revisar texto de narração sem referências editoriais e validar a prévia
- [ ] Gerar capítulos selecionados, simular falha e retomar sem refazer os concluídos
- [ ] Baixar ZIP dos capítulos e audiobook completo em MP3
- [ ] Conferir duração/custo aproximados antes da geração
- [ ] Executar conferência editorial e revisar capítulos ausentes, lacunas e áudio desatualizado
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
- [ ] Testar link público de Reel do Instagram; confirmar mensagem individual e alternativa de upload quando a plataforma bloquear a extração
- [ ] Confirmar que o texto vindo de link recebe as mesmas ações automáticas de resumo, organização, interpretação e intenção
- [ ] Navegar pelas seis etapas no desktop e no celular e confirmar que os atalhos chegam às áreas corretas
- [ ] Gerar e revisar uma proposta Mulheres do Leste com 5 a 10 capítulos
- [ ] Misturar áudio transcrito e texto colado no mesmo projeto e copiar o material integral
- [ ] Desmarcar uma fonte e confirmar que ela fica fora da análise editorial
- [ ] Identificar o tipo de material e corrigir a sugestão quando necessário
- [ ] Ativar o método padrão Mulheres do Leste, gerar memória e sumário de 10 capítulos e aprová-lo
- [ ] Confirmar que os capítulos do método padrão só são gerados após aprovação do sumário e do capítulo anterior
- [ ] Aprovar todos os capítulos, copiar o livro inteiro e baixar o DOCX limpo
- [ ] Gerar e revisar uma proposta de biografia completa com até 30 capítulos
- [ ] Associar entrevistas às perguntas e aos capítulos e confirmar a seleção de fontes na escrita
- [ ] Escrever capítulos em primeira e terceira pessoa, editar e exportar o DOCX
- [ ] Enviar um capítulo/relatório à Central Inteligente e confirmar que o contexto anterior foi preservado
- [ ] Alterar fontes depois de gerar capítulos e confirmar o aviso de conteúdo desatualizado
- [ ] Salvar um projeto `.leste.json`, recarregar a página, abrir o projeto e continuar um capítulo
- [ ] Analisar uma reunião e revisar separadamente fatos, decisões, tarefas, prazos e sugestões
- [ ] Confirmar que as fontes desmarcadas não entram na análise editorial
- [ ] Confirmar que “Limpar tudo” remove o rascunho atual da sessão

## Validação local obrigatória

```bash
npm run typecheck
npm run lint
npm run test:session
npm run test:voice
npm run build
```

## Observações de segurança

- Nunca mova chaves para o frontend.
- Nunca faça commit de `.env.local`.
- Não registre tokens em log.
- Não exponha transcrições em logs por padrão.
