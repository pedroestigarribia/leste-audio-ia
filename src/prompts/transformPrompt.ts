import type { PromptTransformFormat } from "@/types/audio";

const formatLabels: Record<PromptTransformFormat, string> = {
  app: "construcao de aplicativo",
  existingProject: "atualizacao de projeto existente",
  landingPage: "criacao de landing page",
  webApp: "criacao de app web",
};

function buildFormatRules(format: PromptTransformFormat) {
  if (format === "app") {
    return `Foque em um aplicativo completo.
Inclua objetivo, publico-alvo, plataformas sugeridas, telas principais, funcionalidades, regras de negocio, integracoes, dados, fluxos do usuario, requisitos nao funcionais, seguranca, privacidade, criterios de aceite e etapas de validacao.`;
  }

  if (format === "webApp") {
    return `Foque em um app web.
Inclua stack sugerida, paginas, componentes, APIs internas, estados, validacoes, uploads/downloads se fizer sentido, responsividade, variaveis de ambiente, deploy, seguranca, criterios de aceite e testes.`;
  }

  if (format === "landingPage") {
    return `Foque em uma landing page.
Inclua promessa central, publico-alvo, secoes da pagina, copy, CTAs, provas/beneficios, formulario ou contato, identidade visual, responsividade, SEO basico, tracking se fizer sentido e criterios de aceite.`;
  }

  return `Foque na atualizacao de um projeto existente.
Inclua contexto atual inferido, problemas a corrigir, melhorias solicitadas, arquivos/areas provaveis, requisitos funcionais, requisitos tecnicos, cuidados para nao quebrar o que ja funciona, migracao se houver, validacao, testes e criterios de aceite.`;
}

export function buildTransformPrompt({
  analysis,
  format,
  intent,
  keyData,
  organized,
  reply,
  summary,
  tasks,
  transcriptions,
}: {
  analysis: string;
  format: PromptTransformFormat;
  intent: string;
  keyData: string;
  organized: string;
  reply: string;
  summary: string;
  tasks: string;
  transcriptions: string;
}) {
  return `Transforme o conteudo interpretado abaixo em um prompt final para ${formatLabels[format]}.

Objetivo:
Gerar uma instrucao completa, objetiva e pronta para copiar, usando apenas as informacoes disponiveis nas transcricoes e nos resultados interpretados.

Formato esperado:
1. Titulo do projeto.
2. Contexto.
3. Objetivo principal.
4. Publico-alvo ou usuario final.
5. Problema a resolver.
6. Requisitos funcionais.
7. Requisitos tecnicos.
8. Fluxo do usuario.
9. Conteudos, mensagens ou textos necessarios.
10. Integracoes e APIs, se forem citadas.
11. Dados importantes, nomes, datas, valores, links e decisoes.
12. Restrições e cuidados.
13. Criterios de aceite.
14. Instrucao final pronta para o agente/desenvolvedor executar.

Regras:
- Nao invente informacoes.
- Se faltar dado, escreva "A definir".
- Nao use markdown com **, ##, tabelas ou blocos de codigo.
- Nao use floreio.
- Nao use termos vagos quando houver dado concreto.
- Preserve nomes, datas, valores, links, decisoes e restricoes.
- Entregue apenas texto puro, bem estruturado e copiavel.

Regras especificas do formato:
${buildFormatRules(format)}

Conteudo interpretado:

RESUMO CONSOLIDADO:
${summary || "(nao gerado)"}

ORGANIZACAO POR TEMAS:
${organized || "(nao gerado)"}

INTERPRETACAO DO CONTEUDO:
${analysis || "(nao gerado)"}

INTENCAO CONSOLIDADA E RECOMENDACOES:
${intent || "(nao gerada)"}

TAREFAS E PROXIMOS PASSOS:
${tasks || "(nao gerado)"}

DADOS-CHAVE, NOMES, DATAS, VALORES, LINKS E DECISOES:
${keyData || "(nao gerado)"}

RESPOSTA PRONTA PARA WHATSAPP:
${reply || "(nao gerado)"}

TRANSCRICOES ORIGINAIS:
${transcriptions || "(nao enviadas)"}`;
}
