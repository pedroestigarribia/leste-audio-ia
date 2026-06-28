# Leste Audio IA

Web app local em Next.js para upload, transcrição, resumo, organização, interpretação e cópia de áudios do WhatsApp.

## Objetivo

Rodar primeiro em `localhost`, processar múltiplos áudios enviados manualmente pelo usuário e manter as chaves de API apenas no backend.

## Stack

- Next.js com App Router
- TypeScript
- Tailwind CSS
- Route Handlers do Next.js
- Node.js runtime
- Gemini API para transcrição
- DeepSeek API para resumo, organização e análise geral
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
    plain-text.ts
    queue.ts
    temp-files.ts
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
GEMINI_MODEL=gemini-3.5-flash

DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-pro

MAX_PARALLEL_TRANSCRIPTIONS=3
MAX_FILE_SIZE_MB=25
TEMP_UPLOAD_DIR=./tmp/uploads

APP_NAME=Leste Audio IA
```

Se faltar `GEMINI_API_KEY`, a rota de transcrição retorna erro claro.

Se faltar `DEEPSEEK_API_KEY`, as rotas de resumo, organização e análise retornam erro claro.

A interface não cai por causa disso. Ela mostra a mensagem:

`Configure a chave da API no arquivo .env.local`

## Como obter e configurar a Gemini API key

1. Gere uma chave no painel da Gemini API / Google AI Studio.
2. Cole a chave em `GEMINI_API_KEY`.
3. Mantenha `GEMINI_MODEL=gemini-3.5-flash` ou troque depois, se quiser.

## Como obter e configurar a DeepSeek API key

1. Gere uma chave no painel da DeepSeek.
2. Cole a chave em `DEEPSEEK_API_KEY`.
3. Mantenha:
   - `DEEPSEEK_BASE_URL=https://api.deepseek.com`
   - `DEEPSEEK_MODEL=deepseek-v4-pro`

## Modelos usados

- `GEMINI_MODEL=gemini-3.5-flash`
- `DEEPSEEK_MODEL=deepseek-v4-pro`

## Como rodar em localhost

```bash
npm run dev
```

Abrir:

`http://localhost:3000`

## URL de produção planejada

Domínio:

`https://lesteaudio.space`

## Como testar com áudio do WhatsApp

1. Exporte, baixe ou encaminhe os áudios para sua máquina.
2. Abra o app em `http://localhost:3000`.
3. Arraste ou selecione os arquivos.
4. Clique em `Transcrever áudios`.
5. Use os botões individuais e gerais para resumo, organização, interpretação, tarefas, dados-chave, resposta para WhatsApp, cópia e exportação.

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
10. O texto fica apenas na sessão atual da interface.
11. O usuário pode continuar adicionando mais 10 áudios ou mais sem perder os arquivos já listados.
12. O painel geral permite ouvir os áudios enquanto organiza e analisa o conteúdo.

## Processamento temporário e privacidade

- Não salva áudio em banco.
- Não salva áudio em storage permanente.
- Não cria histórico automático.
- Não usa `localStorage`.
- Não usa `IndexedDB`.
- O backend usa `tmp/uploads` apenas durante o processamento.
- O arquivo original e o arquivo convertido são apagados no `finally`.
- Em erro, a limpeza também é tentada.
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
  "geminiModel": "gemini-3.5-flash",
  "deepseekModel": "deepseek-v4-pro"
}
```

## APIs internas

### `POST /api/transcribe`

- Entrada: `multipart/form-data`
- Campo: `file`
- Responsabilidade: validar, salvar temporariamente, transcrever, converter se preciso, limpar temporários

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

## Formatos aceitos

- `.ogg`
- `.opus`
- `.m4a`
- `.mp3`
- `.wav`
- `.webm`
- `.aac`
- `.flac`

## Scripts

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "node server.js",
  "start:next": "next start",
  "lint": "next lint",
  "typecheck": "tsc --noEmit"
}
```

## Dependências adicionais usadas

Além da lista principal pedida, o projeto usa:

- `docx`: para gerar download `.docx` no frontend sem reenviar o conteúdo ao backend.
- `execa`: para executar `ffmpeg-static` ou `ffmpeg` do sistema com menos acoplamento.
- `@types/node`, `@types/react`, `@types/react-dom`: suporte de tipagem para TypeScript.
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
   - `DEEPSEEK_API_KEY`
   - `DEEPSEEK_BASE_URL`
   - `DEEPSEEK_MODEL`
   - `MAX_PARALLEL_TRANSCRIPTIONS`
   - `MAX_FILE_SIZE_MB`
   - `TEMP_UPLOAD_DIR`
11. Configure o domínio `lesteaudio.space` para apontar para o projeto publicado.
12. Verifique se o ambiente suporta `ffmpeg-static`.
13. Se FFmpeg falhar, instale FFmpeg no VPS ou ajuste o ambiente/plano para um runtime com suporte adequado.

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

## Limitações da primeira versão

- Não integra diretamente com WhatsApp.
- O usuário precisa baixar ou encaminhar os áudios e subir no app.
- Não salva histórico.
- Não divide arquivos grandes automaticamente.
- O player de áudio funciona apenas durante a sessão atual, enquanto o arquivo ainda está no navegador.
- A qualidade da transcrição depende da qualidade do áudio.
- Áudios com ruído, sobreposição de vozes ou fala distante podem gerar trechos incertos.
- O Gemini transcreve; o DeepSeek interpreta apenas o texto já transcrito.
- A remoção remota de arquivo no Gemini é feita em modo best effort e depende da versão do SDK suportar exclusão.

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
- [ ] Resumir um áudio
- [ ] Organizar um áudio
- [ ] Interpretar todos
- [ ] Extrair tarefas e dados-chave no painel geral
- [ ] Gerar resposta pronta para WhatsApp
- [ ] Copiar todas as transcrições
- [ ] Baixar transcrições em TXT
- [ ] Baixar transcrições em DOCX
- [ ] Baixar organização geral em TXT
- [ ] Baixar organização geral em DOCX
- [ ] Ouvir os áudios no painel geral
- [ ] Limpar tudo
- [ ] Confirmar que arquivos temporários foram apagados
- [ ] Confirmar que `.env.local` não foi versionado
- [ ] Confirmar que build passou

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
