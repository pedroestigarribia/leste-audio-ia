const { Document, HeadingLevel, Packer, Paragraph, TextRun, AlignmentType } = require("docx");
const { writeFileSync, copyFileSync } = require("fs");
const { join } = require("path");

const content = `

LESTE AUDIO IA
Documentacao Completa do Projeto

1. Introducao

O Leste Audio IA e uma plataforma web desenvolvida com Next.js 14 que oferece ferramentas de processamento de audio, texto, PDF, imagens e videos utilizando inteligencia artificial. O sistema integra as APIs DeepSeek e Gemini para realizar transcricoes, resumos, organizacao de conteudo, deteccao de intencao, sintese de voz, extracao de PDF/imagem, analise de videos do YouTube e correcao de textos.

O Leste Audio IA foi transformado na Central Inteligente, um ambiente unificado de inteligencia que recebe, compreende, relaciona e processa qualquer tipo de conteudo. A interface unica permite trabalhar com audios, textos, PDFs, imagens, videos do YouTube e resultados gerados anteriormente em um unico contexto, sem trocar de modulo.

2. Arquitetura do Projeto

Tecnologias utilizadas:
- Next.js 14 (App Router) com TypeScript
- React 18 com Server Components e Client Components
- Tailwind CSS para estilizacao
- OpenAI SDK (DeepSeek) para execucao de modelos de linguagem
- Google Gen AI SDK (Gemini) para transcricao de audio e analise de video
- docx para geracao de documentos Word
- zod para validacao de schemas
- nanoid para geracao de IDs unicos
- lucide-react para icones
- ffmpeg-static para conversao de audio

Estrutura de diretorios:
- src/app/ - paginas e rotas API (App Router)
- src/components/ - componentes React
- src/lib/ - utilitarios (deepseek, plain-text, env, audio, clipboard, export, queue)
- src/prompts/ - templates de prompts para IA
- src/types/ - definicoes de tipos TypeScript

3. Funcionalidades

3.0 Central Inteligente (Interface Unificada)

A Central Inteligente substitui a separacao anterior entre Audio IA e Corretor IA por um ambiente unico que integra todas as fontes de conteudo:

- Fontes: painel que lista todos os conteudos adicionados (audios transcritos, PDFs extraidos, imagens processadas, textos colados, YouTube)
- Contexto Consolidado: editor que unifica automaticamente o conteudo de todas as fontes habilitadas
- Acoes Inteligentes: botoes para Analisar e Criar, Entender Intencao, Extrair Tarefas, Extrair Dados, e correcao/transformacao de texto (Corrigir, Reescrever, Humanizar, Profissionalizar, Clareza, Encurtar, Expandir, Sem repeticoes)
- Botao principal "Analisar e Criar": processa todo o contexto, identifica intencoes, extrai informacoes e sugere acoes
- Resultados: cada acao exibe seu resultado na interface, com opcao de copiar e usar como novo contexto
- Rastreabilidade: cada fonte mantem tipo, nome e data de criacao, e pode ser habilitada/desabilitada no contexto
- Todos os paineis existentes (UploadArea, PdfPanel, TextImageVoicePanel, YoutubePanel, AudioList, ResultPanel) continuam funcionando e alimentam automaticamente o sistema de fontes quando produzem conteudo

Arcabouco de tipos unificados:
- ContentSourceType: audio, text, pdf, docx, image, youtube, url, generated
- ContentSource: id, type, name, originalContent, extractedContent, projectId, createdAt, metadata, enabledInContext
- UnifiedAction: 30 acoes inteligentes disponiveis

3.1 Transcricao de Audio

Endpoint: POST /api/transcribe

Utiliza a API Gemini (modelo gemini-2.0-flash-lite) para transcrever audios. Suporta os formatos MP3, MP4, M4A, WAV, WEBM, OGG, AAC, FLAC, OPUS. Arquivos sao convertidos automaticamente para WAV quando necessario via ffmpeg. Suporta processamento em fila com ate 20 transcricoes simultaneas configurado via variavel MAX_PARALLEL_TRANSCRIPTIONS.

O componente UploadArea gerencia a selecao de arquivos e a validacao de extensao/tamanho.

3.2 Resumo (Sumarizacao)

Endpoint: POST /api/summarize

Modos: single (um audio) e all (todos os audios da sessao). Prompt personalizado que extrai topicos principais, pontos importantes e conclusoes.

3.3 Organizacao de Conteudo

Endpoint: POST /api/organize

Modos: single e all. Reorganiza a transcricao em topicos, dados importantes, pendencias e proximos passos.

3.4 Deteccao de Intencao Inteligente

Endpoint: POST /api/detect-intent

Analisa transcricoes de audio para detectar automaticamente a intencao do usuario. Utiliza um prompt avancado que considera contexto completo, intencoes compostas, ambiguidades e converte a fala em instrucoes estruturadas.

Formato de saida (JSON):
- intencao_principal: descricao precisa da intencao
- intencoes_secundarias: acoes complementares
- tipo_de_solicitacao: classificacao operacional
- resumo_do_entendimento: explicacao do que foi compreendido
- objetivo_final: resultado esperado pelo usuario
- entidades_identificadas: conteudos, pessoas, formatos, datas, restricoes, preferencias
- acoes_necessarias: lista de acoes para atender ao pedido
- ordem_de_execucao: sequencia logica das acoes
- informacoes_faltantes: dados necessarios que estao ausentes
- nivel_de_confianca: valor de 0 a 100
- pode_executar_automaticamente: true se o pedido esta claro e completo
- instrucao_convertida: comando claro pronto para execucao
- resposta_para_o_usuario: entendimento em linguagem natural

O componente IntentDetectedSection exibe a intencao detectada, o prompt gerado, permite copiar e executar a instrucao via DeepSeek.

3.5 Analise Completa

Endpoint: POST /api/analyze-all

Modos: analysis, tasks, keyData, reply. Processa todos os audios da sessao para gerar: interpretacao geral, tarefas e pendencias, dados-chave, resposta pronta para WhatsApp.

3.6 Transformacao em Prompt

Endpoint: POST /api/transform-prompt

Converte os resultados da analise completa em prompts estruturados para desenvolvimento de apps, web apps, landing pages ou projetos existentes.

3.7 Exportacao

Formatos suportados: TXT e DOCX. Exportacao individual: transcricao, resumo, conteudo organizado de cada audio. Exportacao geral: todos os resultados agregados em um unico arquivo.

A exportacao DOCX utiliza a biblioteca 'docx' para gerar documentos formatados com titulos, secoes e paragrafos.

3.8 Sintese de Voz

Endpoint: POST /api/speech

Gera audio MP3 a partir de texto utilizando a voz Milena (modelo deepgram). Os audios gerados podem ser reproduzidos e baixados diretamente na interface.

3.9 Extracao de PDF

Endpoints: POST /api/pdf-extract e POST /api/pdf-process

Extrai texto de arquivos PDF. O texto extraido pode ser processado nos modos: sumarizar, organizar, corrigir gramatica e limpar (remover formatacao). Utiliza a biblioteca pdf-parse para extracao.

3.10 Extracao de Imagem

Endpoint: POST /api/image-extract

Extrai texto de imagens (PNG, JPG, JPEG, WEBP) utilizando a API Gemini (modelo gemini-2.0-flash-lite) com visao computacional.

3.11 Analise de YouTube

Endpoints: GET /api/youtube-info e POST /api/youtube-analyze

Obtem informacoes de videos do YouTube e realiza analise aprofundada do conteudo utilizando Gemini. Gera: resumo, topicos abordados, pontos principais, dados-chave, tarefas, citacoes e perguntas frequentes.

3.12 Corretor IA (Integrado ao Editor Contextual)

A correcao e transformacao de texto agora esta integrada diretamente ao editor de Contexto Consolidado da Central Inteligente, com 8 modos disponiveis como botoes de acao rapida: Corrigir, Reescrever, Humanizar, Profissionalizar, Clareza, Encurtar, Expandir, Sem repeticoes.

Interface com duas areas de texto (original/processado), contadores de caracteres e palavras, botoes de colar, copiar, selecionar, usar resultado (retroalimentacao) e limpar. Suporta atalho de teclado Ctrl+Enter e persiste o rascunho no localStorage.

Integrado a Central Inteligente, o editor recebe automaticamente transcricoes de audio, extratos de documentos e resultados de acoes anteriores como parte do contexto consolidado.

4. Rotas da API

POST /api/transcribe - Transcricao de audio via Gemini
POST /api/summarize - Resumo de transcricao
POST /api/organize - Organizacao de conteudo
POST /api/detect-intent - Deteccao de intencao inteligente
POST /api/analyze-all - Analise completa multi-audio
POST /api/transform-prompt - Transformacao em prompt
POST /api/execute-prompt - Execucao de prompt via DeepSeek
POST /api/speech - Sintese de voz
POST /api/pdf-extract - Extracao de texto de PDF
POST /api/pdf-process - Processamento de texto de PDF
POST /api/image-extract - Extracao de texto de imagem
GET /api/youtube-info - Informacoes de video YouTube
POST /api/youtube-analyze - Analise de video YouTube
POST /api/text-correct - Correcao e transformacao de texto
POST /api/export-txt - Exportacao TXT
GET /api/health - Health check

5. Componentes Principais

LesteAudioApp - Componente principal que gerencia todo o estado da aplicacao (itens de audio, resultados, paineis).

AppHeader - Cabecalho com logo, nome do app e link para Instagram da Leste Valley.

UploadArea - Area de upload de arquivos de audio com validacao.

AudioList - Lista de audios com botoes de acao individuais.

AudioCard - Card individual de audio com transcricao, resumo, organizacao, deteccao de intencao e botoes de acao.

IntentDetectedSection - Exibe a intencao detectada, prompt gerado e resultado da execucao.

PdfPanel - Painel de extracao e processamento de PDF.

TextImageVoicePanel - Painel de texto livre, extracao de imagem e sintese de voz.

YoutubePanel - Painel de analise de videos do YouTube.

TextCorrectorPanel - Painel de correcao e transformacao de texto com 10 modos.

ResultPanel - Painel de resultados agregados (resumo, organizacao, analise, tarefas, dados-chave, resposta, prompt).

ActionButton - Botao generico com variantes (primary, secondary, ghost, danger) e estado de loading.

ErrorBox - Componente de exibicao de erro.

ProgressBar - Barra de progresso.

SectionBlock - Bloco de texto com titulo e botoes de copia.

6. Tipos e Interfaces (src/types/audio.ts)

AudioStatus: idle, queued, uploading, converting, transcribing, done, error

AutoDetectedIntent: Estrutura completa para deteccao de intencao com campos em portugues (intencao_principal, intencoes_secundarias, tipo_de_solicitacao, etc.)

AudioItem: Item de audio com id, file, name, size, type, extension, status, progress, transcription, summary, organizedText, autoDetectedIntent, error

TranscriptionResponse: Resposta da transcricao (ok, transcription, error, meta)

TextProcessResponse: Resposta generica de processamento (ok, result, error, model)

AnalyzeAllItem: Item para analise em lote (name, transcription)

AnalyzeAllMode: analysis, tasks, keyData, reply

PromptTransformFormat: app, webApp, landingPage, existingProject

7. Prompts de IA (src/prompts/)

A pasta src/prompts/ contem templates de prompts utilizados pelas rotas API:

detectIntent.ts - Prompt avancado para deteccao de intencao com analise contextual, deteccao de intencoes compostas, tratamento de ambiguidades e saida JSON estruturada.

organize.ts - Prompt para organizacao de transcricoes em topicos, dados importantes, pendencias e proximos passos.

summarize.ts - Prompt para extracao de topicos principais, pontos importantes e conclusoes.

textCorrect.ts - Prompt para correcao e transformacao de texto com 10 modos de processamento, regras especificas para cada modo e requisitos de preservacao de conteudo.

8. Configuracao e Variaveis de Ambiente

O sistema utiliza variaveis de ambiente definidas em .env.local:

DEEPSEEK_API_KEY - Chave da API DeepSeek
DEEPSEEK_BASE_URL - URL base da API DeepSeek

GEMINI_API_KEY - Chave da API Gemini

NEXT_PUBLIC_APP_NAME - Nome do aplicativo
MAX_PARALLEL_TRANSCRIPTIONS - Maximo de transcricoes simultaneas (padrao: 20)
MAX_FILE_SIZE_MB - Tamanho maximo de arquivo em MB (padrao: 125)

As configuracoes sao gerenciadas pelo modulo src/lib/env.ts com validacao em startup.

`;

const lines = content.trim().split("\n");

function getHeadingLevel(line) {
  const trimmed = line.trim();
  if (/^[1-8]\.\d/.test(trimmed)) return HeadingLevel.HEADING_2;
  if (/^[1-8]\. /.test(trimmed)) return HeadingLevel.HEADING_1;
  return null;
}

async function main() {
  const children = [];
  let isTitle = true;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      if (!isTitle) children.push(new Paragraph({ spacing: { after: 100 }, children: [] }));
      continue;
    }

    const headingLevel = getHeadingLevel(line);

    if (isTitle && headingLevel === null && !trimmed.startsWith("- ")) {
      if (trimmed === "LESTE AUDIO IA") {
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
            children: [new TextRun({ text: trimmed, bold: true, size: 52 })],
          })
        );
        continue;
      }
      if (trimmed === "Documentacao Completa do Projeto") {
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [new TextRun({ text: trimmed, size: 32 })],
          })
        );
        continue;
      }
      if (trimmed.startsWith("Gerado em")) {
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 600 },
            children: [new TextRun({ text: trimmed, size: 20, color: "666666" })],
          })
        );
        isTitle = false;
        continue;
      }
    }

    isTitle = false;

    if (headingLevel) {
      children.push(
        new Paragraph({
          heading: headingLevel,
          spacing: { before: 400, after: 200 },
          children: [new TextRun({ text: trimmed, bold: true })],
        })
      );
      continue;
    }

    const isListItem = trimmed.startsWith("- ");
    const isEndpoint = /^(POST|GET) \//.test(trimmed);
    const isPath = trimmed.startsWith("src/");

    children.push(
      new Paragraph({
        spacing: { after: 60 },
        indent: isListItem || isEndpoint ? { left: 720 } : undefined,
        children: [
          new TextRun({
            text: isListItem ? trimmed.substring(2) : trimmed,
            italics: isPath || isEndpoint,
            bold: isEndpoint,
            size: isListItem ? 22 : 24,
          }),
        ],
      })
    );
  }

  const doc = new Document({
    title: "Leste Audio IA - Documentacao Completa",
    description: "Documentacao completa do projeto Leste Audio IA",
    creator: "Leste Valley",
    sections: [{ children }],
  });

  const buffer = await Packer.toBuffer(doc);
  const desktopPath = join("C:\\Users\\pedro\\OneDrive\\Área de Trabalho", "documentacao-completa-leste-audio-ia.docx");
  writeFileSync(desktopPath, buffer);
  console.log("Documentacao gerada: " + desktopPath);
}

main().catch((err) => {
  console.error("Erro ao gerar documentacao:", err);
  process.exit(1);
});
