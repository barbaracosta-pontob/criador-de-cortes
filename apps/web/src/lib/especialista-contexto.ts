/**
 * Converte o cadastro do especialista (EspecialistaRow) no contexto enxuto que
 * o serviço de análise espera, e monta o brief final (brief padrão + brief do job).
 */

import type { EspecialistaRow } from "./db";
import type { EspecialistaContexto } from "../services/analysis-bridge";

export function toContexto(esp: EspecialistaRow): EspecialistaContexto {
  return {
    nome: esp.nome || "Especialista",
    cargo: esp.cargo || undefined,
    nicho: esp.nicho || undefined,
    publico_alvo: esp.publico_alvo || undefined,
    tom_de_voz: esp.tom_de_voz || undefined,
    objetivo: esp.objetivo || undefined,
    vocabulario: esp.vocabulario || undefined,
  };
}

export function briefFinal(esp: EspecialistaRow, briefJob?: string): string | undefined {
  return (
    [esp.brief_padrao, briefJob]
      .map((s) => (s ?? "").trim())
      .filter(Boolean)
      .join("\n\n---\n") || undefined
  );
}
