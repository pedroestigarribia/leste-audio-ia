import type { AnalyzeAllItem } from "@/types/audio";
import { WOMEN_METHOD_AUDIT, WOMEN_METHOD_CHAPTER, WOMEN_METHOD_MEMORY, WOMEN_METHOD_OUTLINE, WOMEN_METHOD_SHARED } from "@/prompts/mulheresDoLeste";

export type EditorialTaskMode =
  | "detect-project-type"
  | "biography-outline"
  | "biography-chapter"
  | "biography-chapter-preview"
  | "biography-outline-merge"
  | "biography-chapter-merge"
  | "meeting-analysis"
  | "meeting-analysis-merge"
  | "biography-memory"
  | "biography-followups"
  | "meeting-followups"
  | "meeting-actions"
  | "editorial-quality"
  | "biography-rewrite-passage"
  | "narration-review";

export type EditorialProjectType = "women-biography" | "full-biography" | "meeting";
export type EditorialNarrator = "subject-first-person" | "ghostwriter-third-person";

export type EditorialWorkflowInput = {
  mode: EditorialTaskMode;
  projectType: EditorialProjectType;
  projectTitle: string;
  subjectName: string;
  chapterCount: number;
  narrator: EditorialNarrator;
  chapterNumber: number;
  chapterTitle: string;
  editorialNotes: string;
  collectionGuide: string;
  womenMethod10: boolean;
  memory: Record<string, string>;
  continuityNotes: string;
  previousChapterEnding: string;
  selectedPassage: string;
  narrationMode: "faithful" | "natural" | "adapted";
  pronunciationNotes: string;
  outline: string;
  items: AnalyzeAllItem[];
};

const narratorInstructions: Record<EditorialNarrator, string> = {
  "subject-first-person": "Escreva em primeira pessoa, como se a própria pessoa biografada estivesse contando sua história. Preserve o modo de falar e não invente frases entre aspas.",
  "ghostwriter-third-person": "Escreva em terceira pessoa, como um ghostwriter narrando a história da pessoa biografada com proximidade, clareza e respeito à voz dela. Não invente frases entre aspas.",
};

function formatSources(items: AnalyzeAllItem[]) {
  return items.map((item, index) => `FONTE ${index + 1}: ${item.name}\nCONTEÚDO:\n${item.transcription}`).join("\n\n========================\n\n");
}

function sharedContext(input: EditorialWorkflowInput) {
  const projectLabel = input.projectType === "women-biography"
    ? "Biografia do projeto Mulheres do Leste"
    : input.projectType === "full-biography"
      ? "Biografia completa"
      : "Reunião de trabalho";
  const method = input.projectType === "women-biography" && input.womenMethod10 ? `\n${WOMEN_METHOD_SHARED}` : "";
  return `PROJETO: ${input.projectTitle || projectLabel}\nTIPO: ${projectLabel}\nPESSOA BIOGRAFADA: ${input.subjectName || "não informada"}\nORIENTAÇÃO EDITORIAL: ${input.editorialNotes || "não informada"}\nGUIA DA COLEÇÃO E EXEMPLOS APROVADOS: ${input.collectionGuide || "não fornecidos"}\nMEMÓRIA EDITORIAL ATUAL (referência revisável, não substitui as fontes): ${JSON.stringify(input.memory ?? {})}${method}\n\nFONTES:\n${formatSources(input.items)}`;
}

export function buildEditorialWorkflowPrompt(input: EditorialWorkflowInput) {
  if (input.mode === "detect-project-type") {
    return `Leia todos os materiais abaixo e identifique o objetivo editorial mais provável. Retorne exclusivamente JSON válido: {"type":"women-biography"|"full-biography"|"meeting"|"other","reason":"...","confidence":"low"|"medium"|"high"}. Use women-biography somente quando o material mencionar explicitamente Mulheres do Leste ou instrução equivalente do editor; uma história de vida sem essa indicação é full-biography. Uma conversa sobre trabalho sem história de vida é meeting. Se estes materiais forem análises parciais de vários blocos, consolide as evidências e não deixe o primeiro bloco dominar a decisão. Se não houver evidência suficiente, use other e confidence low. Não use o modo atualmente selecionado como evidência.\n\nMATERIAIS:\n${formatSources(input.items)}`;
  }
  const shared = sharedContext(input);
  const approvedOutline = input.outline.trim()
    ? `\n\nESTRUTURA DO LIVRO REVISADA PELO EDITOR:\n${input.outline}`
    : "";
  const noInvent = `\n\nREGRAS EDITORIAIS OBRIGATÓRIAS:\n- Use todas as fontes recebidas nesta chamada. Não descarte falas nem transforme hipótese em fato.\n- A etiqueta origem=original indica relato recebido; origem=editor indica correção ou orientação; origem=derived indica texto gerado pela IA. Texto derivado não comprova fatos e não substitui a fonte original.\n- Os nomes das fontes podem conter uma pergunta respondida e um capítulo indicado pelo editor; use isso como orientação de contexto, nunca como evidência de fatos que não aparecem na transcrição.\n- Não invente acontecimentos, falas, pensamentos, datas, relações, motivos, responsáveis ou prazos.\n- Preserve divergências e lacunas; liste o que precisa ser confirmado.\n- Associe os fatos relevantes ao nome do arquivo, por exemplo [Fonte: entrevista 03.ogg].\n- Distinga informação narrada pela pessoa, fato explicitamente confirmado e transição editorial sugerida.\n- Escreva em português brasileiro natural, sem floreios artificiais.\n- Retorne texto simples, sem asteriscos, cerquilhas, tabelas ou blocos de código.`;

  if (input.mode === "biography-memory") {
    return `Atualize a memória editorial revisável deste projeto com base somente nas fontes e na memória atual. Retorne exclusivamente um objeto JSON válido com estas chaves string: people, relationships, timeline, events, reportedFacts, confirmedFacts, inferences, voiceAndTone, openQuestions, characteristicQuotes, conflicts, milestones, factOwnership. Preserve tudo que já estava registrado e não contradiga nem promova inferências a fatos confirmados. Em cada fato relevante, inclua a referência ao nome do arquivo. Marque explicitamente relatos não verificados como relato e sugestões editoriais como sugestão. ${input.womenMethod10 ? WOMEN_METHOD_MEMORY : ""} ${noInvent}\n\n${shared}`;
  }

  if (input.mode === "biography-followups") {
    return `Com base nas fontes, na memória editorial e na estrutura do livro, proponha perguntas complementares curtas e respeitosas para enviar à entrevistada pelo WhatsApp. Priorize lacunas que impedem a compreensão da cronologia, relações, transições e divergências. Para cada pergunta, explique em uma linha qual informação precisa ser confirmada; não sugira a resposta. Evite repetir perguntas já respondidas. ${noInvent}\n\n${shared}`;
  }

  if (input.mode === "meeting-followups") {
    return `Com base somente nas fontes da reunião, gere perguntas curtas de acompanhamento para resolver dúvidas, confirmar responsáveis ou prazos e encaminhar decisões pendentes. Não formule perguntas cuja resposta já está explícita. Separe perguntas e diga a qual fonte ou item do relatório se relacionam. Não invente compromisso ou resposta. ${noInvent}\n\n${shared}`;
  }

  if (input.mode === "meeting-actions") {
    return `Extraia apenas encaminhamentos práticos da reunião. Retorne exclusivamente JSON válido: um array de objetos com title, owner, deadline, kind (agreed, proposed ou suggested), evidence e sourceName. kind=agreed somente para compromisso explícito; proposed para proposta discutida sem confirmação; suggested apenas quando for uma recomendação da IA, nunca apresentada como fala da reunião. owner/deadline devem ser "Não informado" quando não forem ditos. evidence deve conter trecho fiel curto que sustente o item. Use [] quando não houver tarefas. ${noInvent}\n\n${shared}`;
  }

  if (input.mode === "editorial-quality") {
    return `Faça a conferência final do projeto biográfico recebido. Aponte: capítulos ausentes ou sem fonte; perguntas em aberto; possível repetição entre capítulos; fontes não aproveitadas; versões narradas antigas; fatos conflitantes; transições sugeridas que precisam de validação. Cite fonte/capítulo. Não reescreva o livro e não trate lacuna como erro factual. O material pode estar dividido em blocos: audite apenas o que foi recebido nesta chamada e não conclua que um fato não possui fonte apenas porque a fonte está em outro bloco. Ao consolidar análises parciais, elimine alertas incompatíveis e mantenha incertezas explícitas. ${input.projectType === "women-biography" && input.womenMethod10 ? WOMEN_METHOD_AUDIT : ""} ${noInvent}\n\nPACOTE PARA CONFERÊNCIA:\n${formatSources(input.items)}`;
  }

  if (input.mode === "biography-rewrite-passage") {
    return `Revise somente o trecho selecionado abaixo para melhorar clareza, ritmo e naturalidade. Use o restante do capítulo apenas como contexto. Não acrescente fato, não altere voz narrativa nem o sentido. Retorne exclusivamente a nova versão do trecho, sem comentários nem referência editorial.\n\nTRECHO SELECIONADO:\n${input.selectedPassage || "não selecionado"}\n\nCAPÍTULO E FONTES DE CONTEXTO:\n${formatSources(input.items)}${noInvent}`;
  }

  if (input.mode === "biography-chapter-preview") {
    return `Crie apenas uma prévia curta do início do capítulo ${input.chapterNumber}, em aproximadamente 2 a 3 parágrafos, para o editor avaliar voz, foco e transição. Não apresente o capítulo completo. Use a voz narrativa selecionada, as fontes associadas, a memória editorial e o guia da coleção. Cite a origem dos fatos e marque inferências; não conclua a história antes do capítulo completo. ${input.womenMethod10 ? WOMEN_METHOD_CHAPTER : ""} ${noInvent}${approvedOutline}\n\n${shared}`;
  }

  if (input.mode === "narration-review") {
    const style = input.narrationMode === "faithful" ? "fiel ao texto aprovado" : input.narrationMode === "adapted" ? "adaptada para leitura em voz alta, sem mudar fatos" : "natural, com pontuação e parágrafos adequados à voz";
    return `Prepare o conteúdo para narração em voz alta de forma ${style}. Remova apenas marcas técnicas de fonte, notas editoriais, instruções e dúvidas claramente separadas do texto narrativo. Não descarte conteúdo da história nem invente. Respeite as substituições de pronúncia informadas. Retorne somente o texto final, sem cabeçalhos de revisão.\n\nSUBSTITUIÇÕES DE PRONÚNCIA:\n${input.pronunciationNotes || "nenhuma"}${noInvent}\n\n${formatSources(input.items)}`;
  }

  if (input.mode === "meeting-analysis" || input.mode === "meeting-analysis-merge") {
    return `Analise o material como registro de uma reunião de trabalho e produza um relatório prático, fiel e rastreável.\n\nOrganize a resposta nesta ordem:\n1. Tipo, objetivo provável e contexto da reunião; sinalize quando forem inferidos.\n2. Resumo executivo.\n3. Assuntos discutidos, na ordem em que aparecem.\n4. Posições e informações relevantes por participante, somente quando a identificação estiver disponível.\n5. Decisões efetivamente tomadas, separadas de ideias e propostas.\n6. Tarefas e próximos passos, com responsável e prazo apenas quando citados.\n7. Pendências, dúvidas, riscos e pontos sem consenso.\n8. Dados-chave: nomes, empresas, lugares, datas, horários, valores e links.\n9. Sugestão de mensagem de acompanhamento, identificada como sugestão editorial.\n10. Referências às fontes de cada ponto importante.\n\nSe esta for uma consolidação, una informações repetidas sem apagar diferenças relevantes. Não crie decisões para completar o relatório.${noInvent}\n\n${shared}`;
  }

  if (input.mode === "biography-outline" || input.mode === "biography-outline-merge") {
    if (input.projectType === "women-biography" && input.womenMethod10) {
      return `${WOMEN_METHOD_OUTLINE}\n\nEm consolidação, reúna todas as propostas parciais e preserve fatos de todas as fontes. ${noInvent}\n\n${shared}`;
    }
    const programNote = input.projectType === "women-biography"
      ? "Siga a linha editorial específica de Mulheres do Leste somente conforme as orientações fornecidas. Não presuma temas ou regras editoriais que não foram informados."
      : "Construa uma proposta ampla para uma biografia completa, cobrindo etapas e viradas da vida somente quando houver fontes para sustentá-las.";
    return `Crie uma proposta de estrutura para um livro biográfico com exatamente ${input.chapterCount} capítulos.\n\n${programNote}\n\nLeia as entrevistas em conjunto, mesmo quando tenham sido enviadas em arquivos separados ou fora de ordem. Identifique continuidades prováveis, repetições, mudanças de assunto e uma sequência narrativa possível. Separe cronologia confirmada de ordem narrativa sugerida. Não una acontecimentos apenas por parecerem semelhantes e não esconda partes ausentes.\n\nPara cada capítulo, informe:\n- Número e título provisório.\n- Período ou acontecimento central, se identificável.\n- Função do capítulo na trajetória e conexão com o anterior e o seguinte.\n- Fontes que oferecem material para escrevê-lo.\n- Perguntas respondidas e capítulos indicados pelo editor, quando existirem.\n- Perguntas, lacunas ou contradições que precisam ser confirmadas antes da redação.\n\nFinalize com uma linha do tempo provisória e uma lista de confirmações editoriais. Não distribua um fato por capítulo sem explicar a relação. Se as fontes não sustentarem a quantidade solicitada, mantenha a quantidade de capítulos e sinalize quais estão dependentes de novas entrevistas. Em consolidação, reúna propostas parciais sem eliminar fontes ou lacunas.${noInvent}\n\n${shared}`;
  }

  const narrator = narratorInstructions[input.narrator];
  const continuity = input.continuityNotes.trim()
    ? `\n\nCONTINUIDADE JÁ APROVADA PELO EDITOR:\n${input.continuityNotes}`
    : "";
  const previousEnding = input.previousChapterEnding.trim()
    ? `\n\nCAPÍTULOS ANTERIORES APROVADOS E TRECHO FINAL DO CAPÍTULO ANTERIOR (contexto de continuidade; não repita o texto):\n${input.previousChapterEnding}`
    : "";
  const memory = `\n\nMEMÓRIA EDITORIAL (consultar, mas conferir cada ponto nas fontes):\n${JSON.stringify(input.memory ?? {})}`;
  return `Escreva o rascunho do capítulo ${input.chapterNumber} de uma biografia.\n\nTÍTULO OU TEMA DO CAPÍTULO: ${input.chapterTitle || "não informado"}\nQUANTIDADE PLANEJADA DE CAPÍTULOS: ${input.chapterCount}\n${narrator}\n\nConstrua uma narrativa coesa com começo, desenvolvimento e fechamento que prepare a transição para o próximo capítulo. Use a estrutura aprovada como guia e limite o capítulo aos acontecimentos que pertencem a este trecho da vida. Considere primeiro as fontes associadas a este capítulo; fontes sem capítulo específico servem como contexto transversal. Use as perguntas respondidas como pistas para compreender a entrevista. Se diferentes áudios forem partes de uma mesma lembrança ou narração, conecte-os apenas quando houver evidência textual; sinalize a conexão como hipótese quando não estiver confirmada. Use apenas acontecimentos sustentados pelas fontes. Marque mudanças de origem quando houver correção editorial, interpretação ou sugestão narrativa. Quando uma passagem precisar de ligação editorial, marque [Transição editorial sugerida]. Quando houver informação relevante ausente ou contraditória, não escolha uma versão em silêncio: registre a dúvida em uma seção final chamada "Pontos para confirmar". Inclua referências internas [Fonte: nome do arquivo] junto aos trechos factuais, para revisão do ghostwriter. Não misture resumo de reunião nem conteúdo de outro projeto. ${input.womenMethod10 ? WOMEN_METHOD_CHAPTER : ""}${noInvent}${approvedOutline}${continuity}${previousEnding}${memory}\n\n${shared}`;
}
