/**
 * db.ts — storage de especialistas via arquivos JSON.
 *
 * Cada especialista é um arquivo <slug>.json em <repo_root>/especialistas/.
 * O arquivo generico.json é o fallback do sistema.
 *
 * Campos focados em DETECÇÃO DE CORTE (não em edição): quem é o público, o
 * tom, o nicho e o objetivo do especialista guiam quais trechos viram bons
 * cortes e como o título/legenda são escritos.
 */

import path from "node:path";
import { mkdirSync, existsSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";

export const REPO_ROOT = path.resolve(process.cwd(), "../..");
export const ESPECIALISTAS_DIR = path.join(REPO_ROOT, "especialistas");

// Garante que a pasta existe
mkdirSync(ESPECIALISTAS_DIR, { recursive: true });

export type EspecialistaRow = {
  slug: string;
  nome: string;
  cargo: string;
  nicho: string;
  /** Quem assiste — ex: "Psiquiatras com pós concluída, 1-3 anos de consultório". */
  publico_alvo: string;
  /** Tom de voz predominante — ex: "Técnico, direto, sem sensacionalismo". */
  tom_de_voz: string;
  /** Objetivo dos cortes — ex: "Atrair alunos para a mentoria". */
  objetivo: string;
  /** Termos técnicos da área que ajudam a reconhecer trechos fortes. */
  vocabulario: string;
  /** Prompt-guia padrão aplicado em todo job deste especialista. */
  brief_padrao: string;
};

const DEFAULTS: Omit<EspecialistaRow, "slug"> = {
  nome: "",
  cargo: "",
  nicho: "",
  publico_alvo: "",
  tom_de_voz: "",
  objetivo: "",
  vocabulario: "",
  brief_padrao: "",
};

function filePath(slug: string) {
  return path.join(ESPECIALISTAS_DIR, `${slug}.json`);
}

export function listEspecialistas(): EspecialistaRow[] {
  if (!existsSync(ESPECIALISTAS_DIR)) return [];
  return readdirSync(ESPECIALISTAS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .filter((slug) => slug !== "generico" && !slug.startsWith("_"))
    .map((slug) => getEspecialista(slug))
    .filter((e): e is EspecialistaRow => e !== null)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }));
}

export function getEspecialista(slug: string): EspecialistaRow | null {
  const fp = filePath(slug);
  if (!existsSync(fp)) return null;
  try {
    const raw = JSON.parse(readFileSync(fp, "utf-8"));
    return { ...DEFAULTS, ...raw, slug };
  } catch {
    return null;
  }
}

export function getEspecialistaOrGenerico(slug: string): EspecialistaRow {
  return (
    getEspecialista(slug) ??
    getEspecialista("generico") ?? { slug: "generico", ...DEFAULTS, nome: "Especialista", cargo: "Expert" }
  );
}

export function saveEspecialista(data: EspecialistaRow): void {
  writeFileSync(filePath(data.slug), JSON.stringify(data, null, 2), "utf-8");
}

export function deleteEspecialista(slug: string): void {
  const fp = filePath(slug);
  if (existsSync(fp)) unlinkSync(fp);
}

export function especialistaExists(slug: string): boolean {
  return existsSync(filePath(slug));
}
