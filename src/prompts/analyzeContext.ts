export type AnalyzeMode =
  | "compreensao_global"
  | "interpretacao"
  | "extracao"
  | "mapeamentos"
  | "diagnostico"
  | "recomendacoes"
  | "criacao"
  | "processo_criativo"
  | "comparacao";

const MODE_LABELS: Record<AnalyzeMode, string> = {
  compreensao_global: "Compreensao Global",
  interpretacao: "Interpretacao Inteligente",
  extracao: "Extracao Inteligente",
  mapeamentos: "Mapeamentos",
  diagnostico: "Diagnostico Inteligente",
  recomendacoes: "Recomendacoes",
  criacao: "Criacao Inteligente",
  processo_criativo: "Processo Criativo",
  comparacao: "Comparacao",
};

function buildSystemPrompt(mode: AnalyzeMode): string {
  const base = [
    "Voce e um analista senior de inteligencia artificial especializado em processamento e analise de conteudo.",
    "Contexto: voce recebe transcricoes de audio, textos, documentos, e extracoes de diversas fontes.",
    "Sua funcao e analisar, interpretar, extrair, diagnosticar e transformar o conteudo conforme o modo solicitado.",
    "Sempre em Portugues do Brasil. Seja objetivo, estruturado e实用.",
    "Retorne APENAS JSON valido, sem markdown, sem explicacoes adicionais.",
  ];

  const modeInstructions: Record<AnalyzeMode, string[]> = {
    compreensao_global: [
      "Produza uma analise completa e integrada do contexto.",
      "Inclua os seguintes campos no JSON de resposta:",
      "- resumo_executivo: resumo em 3-5 frases",
      "- resumo_detalhado: resumo completo com todos os pontos importantes",
      "- linha_do_tempo: array de eventos em ordem cronologica (data, descricao)",
      "- organizacao_por_assuntos: array de {assunto, descricao, fontes}",
      "- organizacao_por_prioridade: array de {item, prioridade, justificativa}",
      "- organizacao_cronologica: array de {periodo, descricao}",
      "- organizacao_por_projeto: array de {projeto, descricao, status, conteudos}",
      "- consolidacao: texto consolidado sem duplicidades",
      "- pensamentos_reconstruidos: reconstrucao de ideias fragmentadas",
      "- relacoes: array de {assunto, relacao, fontes_relacionadas}",
    ],
    interpretacao: [
      "Analise profundamente o contexto para extrair interpretacoes.",
      "Inclua os seguintes campos no JSON de resposta:",
      "- intencao_principal: qual a intencao principal do conteudo",
      "- intencoes_secundarias: array de intencoes complementares",
      "- intencoes_ocultas: array de intencoes implicitas ou nao declaradas",
      "- objetivos_reais: array de objetivos que o autor realmente busca",
      "- contexto_emocional: tom emocional detectado (ansiedade, urgencia, confianca, etc)",
      "- contexto_estrategico: contexto estrategico identificado",
      "- contexto_tecnico: contexto tecnico quando aplicavel",
      "- contexto_comercial: contexto comercial quando aplicavel",
      "- restricoes: array de restricoes identificadas",
      "- urgencia: nivel de urgencia (baixo, medio, alto, critico)",
      "- dependencias: array de dependencias entre acoes ou informacoes",
      "- conflitos: array de conflitos detectados",
      "- mudancas_de_decisao: array de mudancas de decisao ao longo do conteudo",
      "- inconsistencias: array de inconsistencias encontradas",
      "- lacunas: array de lacunas de informacao identificadas",
      "- nivel_de_confianca: 0-100",
    ],
    extracao: [
      "Extraia todas as informacoes estruturadas do contexto.",
      "Inclua os seguintes campos no JSON de resposta:",
      "- tarefas: array de {descricao, responsavel, prazo, prioridade, status}",
      "- decisoes: array de {decisao, data, responsavel, fundamento}",
      "- pendencias: array de {descricao, responsavel, desde}",
      "- riscos: array de {risco, probabilidade, impacto, mitigacao}",
      "- oportunidades: array de {oportunidade, descricao, potenciale}",
      "- perguntas_abertas: array de perguntas nao respondidas",
      "- proximos_passos: array de {passo, responsavel, prazo}",
      "- requisitos: array de requisitos identificados",
      "- pessoas: array de {nome, papel, contato, empresa}",
      "- empresas: array de empresas mencionadas",
      "- produtos: array de produtos mencionados",
      "- locais: array de locais mencionados",
      "- datas: array de {data, descricao, tipo}",
      "- valores: array de {valor, descricao, moeda}",
      "- contatos: array de {pessoa, canal, detalhe}",
      "- links: array de URLs mencionadas",
      "- documentos_mencionados: array de documentos referenciados",
      "- ferramentas: array de ferramentas citadas",
      "- tecnologias: array de tecnologias citadas",
      "- apis: array de APIs mencionadas",
    ],
    mapeamentos: [
      "Gere representacoes estruturais do conhecimento contido no contexto.",
      "Inclua os seguintes campos no JSON de resposta:",
      "- mapa_mental: array de {conceito_central, ramos: array de {nome, subramos: array}}",
      "- mapa_de_conhecimento: array de {area, topicos: array, nivel: basico|intermediario|avancado}",
      "- mapa_de_projetos: array de {projeto, fase, recursos, pendencias}",
      "- mapa_de_tarefas: array de {tarefa, responsavel, prazo, dependencias}",
      "- mapa_de_pessoas: array de {pessoa, relacoes: array, projetos: array}",
      "- mapa_de_relacionamentos: array de {origem, destino, tipo_relacao}",
      "- mapa_de_dependencias: array de {item, depende_de: array, impacta: array}",
      "- mapa_estrategico: {visao, objetivos, metricas, prazos}",
      "- mapa_de_prioridades: array de {item, prioridade, prazo, impacto}",
      "- mapa_de_processos: array de {processo, etapas: array, responsavel}",
      "- mapa_cronologico: array de {periodo, eventos: array}",
      "- arvore_de_assuntos: array de {assunto, subassuntos: array}",
      "- rede_de_conexoes: array de {conteudo, conectado_a: array, tipo_conexao}",
    ],
    diagnostico: [
      "Diagnostique o contexto apontando problemas, riscos e oportunidades.",
      "Inclua os seguintes campos no JSON de resposta:",
      "- o_que_esta_faltando: array de itens ou informacoes ausentes essenciais",
      "- possiveis_erros: array de erros potenciais identificados",
      "- contradicoes: array de contradicoes entre informacoes",
      "- riscos: array de {risco, nivel, descricao, consequencia}",
      "- oportunidades_de_melhoria: array de sugestoes de melhoria",
      "- redundancias: array de informacoes repetidas desnecessariamente",
      "- gargalos: array de gargalos identificados no fluxo",
      "- decisoes_conflitantes: array de decisoes que se contradizem",
      "- pontos_criticos: array de pontos que requerem atencao imediata",
      "- informacoes_ignoradas: array de informacoes importantes mas nao consideradas",
      "- possiveis_impactos: array de {impacto, descricao, probabilidade}",
    ],
    recomendacoes: [
      "Gere recomendacoes acionaveis baseadas no contexto analisado.",
      "Inclua os seguintes campos no JSON de resposta:",
      "- proximos_passos: array de {passo, prioridade, prazo_sugerido, responsavel_sugerido}",
      "- plano_de_acao: array de {fase, acoes: array, recursos, prazo}",
      "- cronograma_sugerido: array de {etapa, inicio, fim, marcos: array}",
      "- checklist: array de itens a verificar",
      "- divisao_por_etapas: array de {etapa, descricao, duracao_estimada}",
      "- melhorias: array de {area, melhoria, impacto_estimado, esforco}",
      "- automacoes: array de {processo, ferramenta_sugerida, beneficio}",
      "- otimizacoes: array de {processo, otimizacao, ganho_estimado}",
      "- priorizacao: array de {item, prioridade, justificativa, urgencia}",
      "- validacoes: array de {oque_validar, como_validar, criterio_de_sucesso}",
    ],
    criacao: [
      "Transforme o contexto em um dos formatos solicitados pelo usuario.",
      "O usuario pode solicitar qualquer um dos formatos abaixo no campo 'formato'.",
      "Formatos disponiveis: whatsapp, email, comunicado, proposta, reuniao_ata, resumo_executivo, relatorio, documentacao_tecnica, prd, mvp, modelo_negocio, canvas, roadmap, planejamento_estrategico, plano_comercial, plano_marketing, landing_page, artigo, roteiro, apresentacao, prompt_ia, prompt_codex, prompt_claude, prompt_opencode, prompt_gemini, especificacao_funcional",
      "Inclua os seguintes campos no JSON de resposta:",
      "- formato_solicitado: o formato gerado",
      "- titulo: titulo do documento gerado",
      "- conteudo: o conteudo completo no formato solicitado",
      "- resumo: breve resumo do que foi gerado",
      "- observacoes: observacoes relevantes sobre o documento gerado",
    ],
    processo_criativo: [
      "Usando todo o contexto disponivel, realize processos criativos.",
      "Inclua os seguintes campos no JSON de resposta:",
      "- novas_ideias: array de ideias originais geradas a partir do contexto",
      "- combinacoes: array de {ideia_1, ideia_2, resultado_combinado}",
      "- conceitos_expandidos: array de {conceito_original, expansao, aplicacoes}",
      "- funcionalidades_sugeridas: array de {produto_servico, funcionalidade, beneficio}",
      "- novos_produtos: array de {produto, descricao, publico_alvo, diferencial}",
      "- novos_servicos: array de {servico, descricao, modelo_entrega}",
      "- oportunidades_negocio: array de {oportunidade, mercado, potencial}",
      "- oportunidades_automacao: array de {processo, ferramenta, ganho}",
      "- abordagens: array de {problema, abordagem_atual, nova_abordagem}",
      "- melhorias_tecnicas: array de {componente, melhoria, impacto}",
      "- melhorias_comerciais: array de {area, melhoria, resultado_esperado}",
      "- melhorias_ux: array de {interface_fluxo, melhoria, beneficio_usuario}",
    ],
    comparacao: [
      "Compare multiplas fontes ou versoes dentro do contexto.",
      "Inclua os seguintes campos no JSON de resposta:",
      "- fontes_comparadas: array com os nomes das fontes comparadas",
      "- comparacao_versoes: array de {versao, diferencas, evolucao}",
      "- comparacao_documentos: array de {documento_1, documento_2, similaridades, diferencas}",
      "- comparacao_decisoes: array de {decisao, antes, depois, motivo_mudanca}",
      "- divergencias: array de {topico, visao_a, visao_b, analise}",
      "- convergencias: array de {topico, consenso, fontes}",
      "- evolucao_projeto: {fases: array de {fase, mudancas, progresso}}",
    ],
  };

  return [...base, "", `MODO: ${MODE_LABELS[mode]}`, "", "INSTRUCOES ESPECIFICAS:", ...(modeInstructions[mode] || [])].join("\n");
}

export function buildAnalyzeContextPrompt(mode: AnalyzeMode, text: string, extraParams?: Record<string, string>): {
  system: string;
  prompt: string;
} {
  let prompt = `Analise o conteudo abaixo no modo "${MODE_LABELS[mode]}".\n\nCONTEUDO:\n${text}`;

  if (extraParams?.formato) {
    prompt += `\n\nFORMATO SOLICITADO: ${extraParams.formato}`;
  }

  if (extraParams?.comparar) {
    prompt += `\n\nCOMPARAR: ${extraParams.comparar}`;
  }

  return {
    system: buildSystemPrompt(mode),
    prompt,
  };
}
