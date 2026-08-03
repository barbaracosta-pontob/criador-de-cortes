/**
 * Schema Zod dos cortes detectados pelo Claude.
 *
 * O cut-creator NÃO edita vídeo — apenas descobre trechos (cortes) que se
 * sustentam sozinhos para virar Reels/Shorts/ads, com título e legenda
 * sugeridos. Cada corte tem in/out ancorados nos timestamps do transcript.
 */

import { z } from "zod";

export const SCHEMA_VERSION = "cuts-v1.0.0";

/** Formato-alvo sugerido para o corte. */
export const FormatoSugeridoSchema = z.enum([
  "vertical_curto", // Reels/Shorts ~15-60s
  "vertical_longo", // vertical mais denso ~60-120s
  "horizontal_ads", // trecho p/ anúncio, geralmente mais longo
]);
export type FormatoSugerido = z.infer<typeof FormatoSugeridoSchema>;

export const CutSchema = z
  .object({
    /** Slug curto e estável do corte (ex: "gargalo-do-consultorio"). */
    id: z.string().min(1),
    /** Headline sugerida — alimenta a headline do editor. Até ~12 palavras. */
    titulo: z.string().min(1),
    /** Primeira frase / gancho do corte, extraída da fala. */
    hook: z.string().min(1),
    /** Legenda sugerida para o post. */
    legenda_sugerida: z.string().default(""),
    /** Por que este trecho é um bom corte (tema, promessa, público). */
    motivo: z.string().default(""),
    /** In point em segundos — ancorado no start de um segmento do transcript. */
    inicio_segundos: z.number().nonnegative(),
    /** Out point em segundos — ancorado no end de um segmento do transcript. */
    fim_segundos: z.number().positive(),
    /** Duração derivada (fim - inicio). Recalculada no backend por segurança. */
    duracao_segundos: z.number().positive(),
    formato_sugerido: FormatoSugeridoSchema,
    /** 0-100: força do gancho + alinhamento com público/objetivo do especialista. */
    score: z.number().min(0).max(100),
  })
  .refine((c) => c.fim_segundos > c.inicio_segundos, {
    message: "fim_segundos deve ser maior que inicio_segundos",
    path: ["fim_segundos"],
  });

export type Cut = z.infer<typeof CutSchema>;

export const CutsResultSchema = z.object({
  /** Duração real do arquivo de vídeo em segundos (referência). */
  video_source_duracao: z.number().nonnegative().optional(),
  cortes: z.array(CutSchema).min(1),
});

export type CutsResult = z.infer<typeof CutsResultSchema>;
