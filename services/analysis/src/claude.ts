import Anthropic from "@anthropic-ai/sdk";
import { ZodError } from "zod";

import { CutsResultSchema, type CutsResult } from "@pontob/cut-schema";
import {
  CUT_SYSTEM_PROMPT,
  REFINE_CUT_SYSTEM_PROMPT,
  buildCutPrompt,
  buildRefineCutPrompt,
  PROMPT_VERSION,
  type EspecialistaContexto,
} from "./prompt";

const DEFAULT_MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-6";
// O prompt pede um bloco <analise>/<diagnostico> antes do JSON. Somado a uma lista
// de cortes (cada um com legenda/motivo), 4096 estoura facil. Base generosa; para
// aulas longas (~40 min) escalamos ate MAX_TOKENS_CEILING por transcript grande.
const MAX_TOKENS_BASE = 12000;
const MAX_TOKENS_CEILING = 32000;

export type { EspecialistaContexto };

export type AnalyzeCutsParams = {
  transcript: object;
  /** Duração real do arquivo (ffprobe). Teto duro: nenhum corte passa disso. */
  videoDuration?: number;
  especialista: EspecialistaContexto;
  brief?: string;
};

export type RefineCutsParams = {
  transcript: object;
  videoDuration?: number;
  cortesAtuais: object;
  especialista: EspecialistaContexto;
  brief?: string;
};

export type CutsAnalysisResult = {
  cuts: CutsResult;
  metadata: {
    promptVersion: string;
    model: string;
    tentativas: number;
    tokens: { input: number; output: number; cacheRead: number; cacheCreation: number };
  };
};

/** Remove markdown fence caso Claude envolva o JSON em ```json ... ``` */
function stripMarkdownFence(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();
}

/**
 * Remove blocos de raciocinio (<analise> ou <diagnostico>) que o Claude escreve
 * antes do JSON e retorna apenas o JSON (a partir da primeira "{").
 */
function stripAnalysisBlock(text: string): string {
  const stripped = text
    .replace(/<analise>[\s\S]*?<\/analise>/gi, "")
    .replace(/<diagnostico>[\s\S]*?<\/diagnostico>/gi, "")
    .trim();
  const jsonStart = stripped.indexOf("{");
  if (jsonStart === -1) return stripped;
  return stripped.slice(jsonStart);
}

/** Gera um id/slug estavel a partir do titulo, com fallback por indice. */
function slugify(base: string, fallbackIdx: number): string {
  const slug = base
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || `corte-${fallbackIdx + 1}`;
}

/**
 * Rede de seguranca: garante in/out validos e dentro do arquivo, recalcula a
 * duracao, normaliza ids e reordena por score. Equivalente aos clamps do editor.
 */
function normalizeCuts(cuts: CutsResult, videoDuration?: number): CutsResult {
  const seen = new Set<string>();

  const cortes = cuts.cortes
    .map((c, i) => {
      let inicio = Math.max(0, c.inicio_segundos);
      let fim = c.fim_segundos;
      if (videoDuration && videoDuration > 0) {
        fim = Math.min(fim, videoDuration);
      }
      // Se o clamp inverteu ou zerou a janela, descarta este corte.
      if (fim <= inicio) return null;

      let id = slugify(c.id || c.titulo, i);
      while (seen.has(id)) id = `${id}-${i + 1}`;
      seen.add(id);

      return {
        ...c,
        id,
        inicio_segundos: Math.round(inicio * 10) / 10,
        fim_segundos: Math.round(fim * 10) / 10,
        duracao_segundos: Math.round((fim - inicio) * 10) / 10,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .sort((a, b) => b.score - a.score);

  return {
    ...cuts,
    video_source_duracao: videoDuration ?? cuts.video_source_duracao,
    cortes,
  };
}

export class CutAnalysisError extends Error {
  constructor(
    message: string,
    public readonly tentativas: number,
    public readonly ultimaResposta?: string,
    public readonly zodError?: ZodError,
  ) {
    super(message);
    this.name = "CutAnalysisError";
  }
}

type RunConfig = {
  systemPrompt: string;
  userPrompt: string;
  temperaturas: [number, number, number];
  videoDuration?: number;
  model: string;
  apiKey: string;
};

/** Loop de 3 tentativas com temperatura decrescente + realimentacao do erro Zod. */
async function runWithRetry(cfg: RunConfig): Promise<CutsAnalysisResult> {
  const client = new Anthropic({ apiKey: cfg.apiKey });
  const tokens = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 };
  let ultimaResposta = "";
  let ultimoErroZod: ZodError | undefined;

  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: cfg.userPrompt }];

    if (tentativa > 1 && ultimoErroZod) {
      messages.push({ role: "assistant", content: ultimaResposta });
      messages.push({
        role: "user",
        content: `O JSON anterior falhou na validacao Zod:\n\n${ultimoErroZod.errors
          .map((e) => `- ${e.path.join(".")}: ${e.message}`)
          .join("\n")}\n\nCorrija e retorne apenas o JSON valido.`,
      });
    }

    // Escala pelo tamanho aproximado do user prompt (proxy do tamanho do transcript):
    // ~4 chars por token. Cada 20k tokens de entrada = +6k tokens de saída.
    const promptChars = cfg.userPrompt.length;
    const dinamico = Math.min(
      MAX_TOKENS_CEILING,
      MAX_TOKENS_BASE + Math.floor(promptChars / 4 / 20000) * 6000,
    );
    const maxTokens = Math.min(MAX_TOKENS_CEILING, dinamico + (tentativa - 1) * 6000);

    const response = await client.messages.create({
      model: cfg.model,
      max_tokens: maxTokens,
      temperature: cfg.temperaturas[tentativa - 1],
      // cache_control é aceito pela API (prompt caching) mas só tipado no namespace
      // beta do SDK 0.32.x — cast mantém o benefício sem quebrar o build.
      system: [{ type: "text", text: cfg.systemPrompt, cache_control: { type: "ephemeral" } }] as unknown as Anthropic.MessageCreateParams["system"],
      messages,
    });

    // Campos de cache existem no Usage beta do SDK 0.32.x; leitura via cast.
    const usage = response.usage as {
      input_tokens: number;
      output_tokens: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
    tokens.input += usage.input_tokens;
    tokens.output += usage.output_tokens;
    tokens.cacheRead += usage.cache_read_input_tokens ?? 0;
    tokens.cacheCreation += usage.cache_creation_input_tokens ?? 0;

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new CutAnalysisError("Resposta do Claude sem bloco de texto", tentativa);
    }
    ultimaResposta = textBlock.text;

    if (response.stop_reason === "max_tokens") {
      console.error(
        `[cuts] tentativa ${tentativa}: resposta TRUNCADA (max_tokens=${maxTokens}, ` +
        `output=${response.usage.output_tokens}). Escalando na proxima tentativa...`,
      );
      ultimoErroZod = undefined;
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripMarkdownFence(stripAnalysisBlock(ultimaResposta)));
    } catch {
      console.error(`[cuts] tentativa ${tentativa}: JSON invalido, retentando...`);
      continue;
    }

    const validation = CutsResultSchema.safeParse(parsed);
    if (validation.success) {
      const cuts = normalizeCuts(validation.data, cfg.videoDuration);
      if (cuts.cortes.length === 0) {
        console.error(`[cuts] tentativa ${tentativa}: nenhum corte valido apos normalizacao, retentando...`);
        ultimoErroZod = undefined;
        continue;
      }
      return {
        cuts,
        metadata: { promptVersion: PROMPT_VERSION, model: cfg.model, tentativas: tentativa, tokens },
      };
    }

    console.error(
      `[cuts] tentativa ${tentativa}: schema invalido (${validation.error.errors.length} erros), retentando...`,
    );
    ultimoErroZod = validation.error;
  }

  throw new CutAnalysisError(
    `Falha apos 3 tentativas. Ultimo erro: ${
      ultimoErroZod?.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ") ?? "JSON invalido"
    }`,
    3,
    ultimaResposta,
    ultimoErroZod,
  );
}

/** Detecta os cortes de um video a partir da transcricao. */
export async function analyzeCuts(
  params: AnalyzeCutsParams,
  options: { model?: string; apiKey?: string } = {},
): Promise<CutsAnalysisResult> {
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY nao definido. Passe via env ou options.apiKey");

  return runWithRetry({
    systemPrompt: CUT_SYSTEM_PROMPT,
    userPrompt: buildCutPrompt({
      transcript: params.transcript,
      especialista: params.especialista,
      brief: params.brief,
    }),
    temperaturas: [0.4, 0.2, 0.0],
    videoDuration: params.videoDuration,
    model: options.model ?? DEFAULT_MODEL,
    apiKey,
  });
}

/** Reavalia a lista de cortes atual aplicando o pedido de refino do usuario. */
export async function refineCuts(
  params: RefineCutsParams,
  options: { model?: string; apiKey?: string } = {},
): Promise<CutsAnalysisResult> {
  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY nao definido.");

  return runWithRetry({
    systemPrompt: REFINE_CUT_SYSTEM_PROMPT,
    userPrompt: buildRefineCutPrompt({
      transcript: params.transcript,
      cortesAtuais: params.cortesAtuais,
      especialista: params.especialista,
      brief: params.brief,
    }),
    temperaturas: [0.3, 0.1, 0.0],
    videoDuration: params.videoDuration,
    model: options.model ?? DEFAULT_MODEL,
    apiKey,
  });
}
