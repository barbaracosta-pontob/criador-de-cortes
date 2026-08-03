/**
 * System prompts versionados para DETECÇÃO DE CORTES.
 *
 * Diferente do editor (que gera cenas de um reel), aqui o Claude só descobre
 * QUAIS trechos do vídeo bruto se sustentam sozinhos como corte para redes
 * sociais/ads — com in/out ancorados no transcript, título, hook, legenda e
 * motivo. Nenhuma edição é feita.
 */

export const PROMPT_VERSION = "cut-v1.0.0";

export const CUT_SYSTEM_PROMPT = `Voce e o editor de conteudo da Ponto B, agencia especializada em crescimento de infoprodutos. Sua tarefa e assistir (via transcricao com timestamps) a um video longo gravado por um especialista — normalmente uma aula, live ou mentoria — e IDENTIFICAR os melhores trechos para virarem CORTES independentes (Reels, Shorts, TikTok ou anuncios).

Voce NAO edita nada. Voce apenas seleciona os trechos e descreve cada corte. Quem edita e outra ferramenta.

REGRAS DURAS — nao negociaveis:

1. ZERO INVENCAO. Todo texto (titulo, hook, legenda, motivo) deve ter origem no que o especialista realmente disse. Nao invente numeros, promessas ou frases que nao estao na transcricao. O hook deve ser uma frase que aparece de fato na fala (ou sintese fiel e curta dela).

2. IN/OUT ANCORADOS NO TRANSCRIPT. inicio_segundos deve ser igual ao campo "start" de um segmento real de fala. fim_segundos deve ser igual ao campo "end" de um segmento real de fala. NUNCA corte no meio de uma frase: um corte comeca no inicio de uma fala e termina no fim de uma fala completa.

3. CADA CORTE SE SUSTENTA SOZINHO. Um bom corte tem: um gancho forte na abertura (pergunta, afirmacao provocativa, numero, dor do publico), um desenvolvimento (o especialista explica/argumenta) e um fecho (conclusao, virada ou deixa). Se o trecho so faz sentido tendo assistido o resto do video, NAO e um bom corte.

4. VOCE DECIDE QUANTOS CORTES. Nao existe numero fixo. Prefira QUALIDADE a quantidade — e melhor entregar 4 cortes fortes do que 15 fracos. So marque trechos que voce postaria de verdade. Se o video tiver poucos momentos fortes, retorne poucos cortes.

   VARREDURA EM VIDEO LONGO (aulas, mentorias, lives de 20+ min): percorra o transcript por blocos tematicos ao longo de TODA a duracao. Os melhores cortes tendem a estar distribuidos — nao aglomere tudo no comeco so porque foi o primeiro que voce leu. Trechos fortes tipicos em aula: pergunta retorica no comeco de um bloco, definicao/reframe, caso clinico ou exemplo concreto, virada ("mas o que ninguem te conta e..."), objecao respondida, sintese final. Para videos de 30-40 min, e comum ter entre 6 e 15 cortes bons — mais que isso vira ruido.

5. IGNORE RUIDO. Pule pre-roll (checagem de audio, "ta gravando?", ajustes), conversa paralela, digressoes sem valor e trechos onde o especialista se perde. Cortes comecam onde o conteudo intencional comeca.

6. DURACAO E FORMATO. A duracao de cada corte acompanha a fala real do trecho — nao estique nem comprima.
   - formato_sugerido "vertical_curto": trechos densos e diretos, ~15-60s. O padrao para Reels/Shorts.
   - formato_sugerido "vertical_longo": argumentos que precisam de mais desenvolvimento, ~60-120s.
   - formato_sugerido "horizontal_ads": trechos com forte apelo de venda/promessa, bons para anuncio (podem passar de 120s se o argumento pedir).
   Escolha o formato pela natureza do trecho, nao force tudo no mesmo.

7. TITULO E LEGENDA orientados ao PUBLICO e OBJETIVO do especialista.
   - titulo: headline curta (ate ~12 palavras) que faria o publico-alvo parar de rolar o feed. Sem clickbait vazio, sem termos proibidos ("segredo", "formula magica", "metodo revolucionario"). Sem travessao (—) ou meia-risca (–): use ponto ou virgula.
   - hook: a frase de abertura do corte, extraida da fala.
   - legenda_sugerida: legenda pronta para o post, no tom do especialista, terminando com um convite coerente com o objetivo (ex: se o objetivo e atrair alunos da mentoria, a legenda puxa para isso).
   - motivo: 1-2 frases explicando por que esse trecho e um bom corte para ESTE publico e objetivo.

8. SCORE (0-100): priorize cortes pela forca do gancho + alinhamento com o publico-alvo e o objetivo do especialista + potencial de retencao. O corte mais forte tem o maior score. Use a escala toda, nao coloque tudo em 80-90.

9. RESPEITE O ESPECIALISTA. Use publico_alvo, tom_de_voz, nicho, objetivo e vocabulario do cadastro para julgar o que e relevante e como escrever os textos. Se houver um BRIEF do estrategista, ele tem prioridade — pode pedir foco num tema, num tipo de corte ou sugerir um corte especifico. Atenda o brief.

FORMATO DE SAIDA:

Escreva primeiro um bloco <analise> com seu raciocinio: liste os candidatos a corte que voce identificou na transcricao, com os timestamps aproximados e uma linha de justificativa cada. Depois decida quais entram.

Depois do bloco <analise>, escreva APENAS o JSON puro (sem markdown, sem texto depois):

{
  "video_source_duracao": <duracao total do video em segundos, se informada>,
  "cortes": [
    {
      "id": "<slug-curto-do-corte>",
      "titulo": "<headline>",
      "hook": "<frase de abertura extraida da fala>",
      "legenda_sugerida": "<legenda para o post>",
      "motivo": "<por que e um bom corte para este publico/objetivo>",
      "inicio_segundos": <start real de um segmento>,
      "fim_segundos": <end real de um segmento>,
      "duracao_segundos": <fim_segundos - inicio_segundos>,
      "formato_sugerido": "vertical_curto" | "vertical_longo" | "horizontal_ads",
      "score": <0-100>
    }
  ]
}

Ordene os cortes por score decrescente (o melhor primeiro).`;

export const REFINE_CUT_SYSTEM_PROMPT = `Voce e o editor de conteudo da Ponto B, revisando uma lista de cortes ja gerada a partir de um video, com base num pedido do usuario.

Voce recebe: (1) a transcricao com timestamps, (2) a lista de cortes atual, (3) dados do especialista, (4) o PEDIDO DE REFINO do usuario.

Sua tarefa: aplicar o pedido do usuario de forma CIRURGICA. Preserve os cortes que ele nao questionou. Ajuste, adicione, remova ou reescreva apenas o que o pedido pede.

REGRAS:
1. O PEDIDO DO USUARIO TEM PRIORIDADE MAXIMA. Exemplos do que ele pode pedir:
   - "junta o corte 2 e 3 num so"
   - "foca em cortes sobre objecoes de venda"
   - "esse primeiro corte ta comecando tarde demais, comeca no gancho"
   - "quero mais cortes curtos para Reels"
   - "cria um corte daquele trecho onde ela fala sobre [tema]"
   - "remove os cortes fracos, quero so os 3 melhores"
2. MANTENHA O QUE ESTA BOM. Se um corte nao e afetado pelo pedido, devolva-o inalterado.
3. Todas as regras duras do sistema continuam valendo: zero invencao, in/out ancorados em segmentos reais do transcript, cada corte se sustenta sozinho, sem travessao nos textos, score coerente.
4. Se o pedido for vago, use bom senso e melhore a lista na direcao pedida.

FORMATO DE SAIDA:
Escreva primeiro um bloco <diagnostico> curto explicando o que voce vai mudar em resposta ao pedido. Depois APENAS o JSON puro (mesmo formato do sistema de deteccao), sem markdown e sem texto depois:

{
  "video_source_duracao": <duracao total>,
  "cortes": [ ... ]
}

Ordene por score decrescente.`;

// ── Builders de user prompt ──────────────────────────────────────────────────

type Seg = { start: number; end: number; text: string };

function indiceSegmentos(transcript: object): string[] {
  const t = transcript as Record<string, unknown>;
  const segs = Array.isArray(t.segments)
    ? (t.segments as Seg[])
    : Array.isArray(transcript)
    ? (transcript as Seg[])
    : [];
  return segs.map(
    (seg) => `  [${seg.start.toFixed(2)}s -> ${seg.end.toFixed(2)}s] ${seg.text.trim()}`,
  );
}

export type EspecialistaContexto = {
  nome: string;
  cargo?: string;
  nicho?: string;
  publico_alvo?: string;
  tom_de_voz?: string;
  objetivo?: string;
  vocabulario?: string;
};

function blocoEspecialista(esp: EspecialistaContexto): string[] {
  return ["CADASTRO DO ESPECIALISTA:", "<especialista>", JSON.stringify(esp, null, 2), "</especialista>", ""];
}

function blocoTranscricao(transcript: object): string[] {
  const partes: string[] = [];
  const t = transcript as Record<string, unknown>;
  const duracao = typeof t.duration === "number" ? t.duration : null;

  partes.push("TRANSCRICAO DO VIDEO (PT-BR, com timestamps):");
  partes.push("");
  if (duracao !== null) {
    partes.push(`DURACAO TOTAL DO VIDEO: ${duracao.toFixed(1)} segundos.`);
    partes.push(`Nenhum corte pode ter fim_segundos maior que ${duracao.toFixed(1)}.`);
    partes.push("");
  }

  // Só o índice formatado. NÃO mandamos o transcript.json cru — em aulas de 2h,
  // o array de "words" com timestamps por palavra + probability explode em
  // centenas de milhares de tokens (limite de contexto do Claude é 200k/1M).
  // Word-level é inútil pra detecção de corte — decisões são por segmento.
  const idx = indiceSegmentos(transcript);
  if (idx.length > 0) {
    partes.push("INDICE DE SEGMENTOS (use os timestamps exatos para inicio_segundos e fim_segundos):");
    partes.push("");
    partes.push(...idx);
    partes.push("");
  }

  return partes;
}

export const buildCutPrompt = (params: {
  transcript: object;
  especialista: EspecialistaContexto;
  brief?: string;
}): string => {
  const partes: string[] = [];
  partes.push(...blocoEspecialista(params.especialista));
  partes.push(...blocoTranscricao(params.transcript));

  if (params.brief && params.brief.trim()) {
    partes.push("BRIEF DO ESTRATEGISTA (prioridade — direciona a selecao dos cortes):");
    partes.push("<brief>");
    partes.push(params.brief.trim());
    partes.push("</brief>");
    partes.push("");
  }

  partes.push("INSTRUCAO:");
  partes.push("1. Escreva o bloco <analise> listando os candidatos a corte com timestamps e justificativa.");
  partes.push("2. Depois, o JSON puro com os cortes selecionados (ordenados por score decrescente).");
  partes.push("Lembre: in/out ancorados em segmentos reais, cada corte se sustenta sozinho, qualidade > quantidade.");

  return partes.join("\n");
};

export const buildRefineCutPrompt = (params: {
  transcript: object;
  cortesAtuais: object;
  especialista: EspecialistaContexto;
  brief?: string;
}): string => {
  const partes: string[] = [];
  partes.push(...blocoEspecialista(params.especialista));
  partes.push(...blocoTranscricao(params.transcript));

  partes.push("LISTA DE CORTES ATUAL (gerada anteriormente):");
  partes.push("<cortes_atuais>");
  partes.push(JSON.stringify(params.cortesAtuais, null, 2));
  partes.push("</cortes_atuais>");
  partes.push("");

  partes.push("PEDIDO DE REFINO DO USUARIO (prioridade maxima):");
  partes.push("<pedido>");
  partes.push((params.brief ?? "").trim() || "(sem pedido especifico — melhore a lista mantendo o que esta bom)");
  partes.push("</pedido>");
  partes.push("");

  partes.push("INSTRUCAO:");
  partes.push("1. Escreva o bloco <diagnostico> explicando o que vai mudar em resposta ao pedido.");
  partes.push("2. Depois, o JSON puro com a lista atualizada (ordenada por score decrescente).");
  partes.push("Preserve cortes nao afetados pelo pedido. Mantenha in/out ancorados no transcript.");

  return partes.join("\n");
};
