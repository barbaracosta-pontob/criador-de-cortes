/**
 * Estado de um job persistido em jobs/<id>/status.json.
 *
 * O job roda em background (não amarrado ao request HTTP). O status.json é a
 * fonte da verdade — worker escreve, SSE endpoint tail para o browser. Se o
 * navegador fecha e volta 3h depois, o worker continuou rodando e o status
 * atual é lido do disco.
 */

import { writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { jobDir, findVideoPath } from "./jobs";

export type JobPhase = "queued" | "transcribing" | "analyzing" | "done" | "error" | "interrupted";

// Set em memória dos jobIds que este processo Node está processando ativamente.
// Quando o servidor é fechado, o Set morre junto — no reboot, todos os status
// que estavam "in-progress" viram órfãos (o worker não existe mais). O detector
// abaixo pega esse caso e os marca como "interrupted" pra UI só na leitura,
// sem reescrever o disco (preserva o percent/atual_segundos pra exibição).
//
// Anexado ao globalThis pra sobreviver ao HMR do next dev — cada recompilação
// de módulo cria uma instância nova; sem isso, /reprocess marca no Set A e o
// SSE poll consulta o Set B (vazio) e mantém o job como zumbi pra sempre.
const ACTIVE_KEY = Symbol.for("pontob.cutcreator.activeWorkers");
type GlobalWithActive = typeof globalThis & { [ACTIVE_KEY]?: Set<string> };
const g = globalThis as GlobalWithActive;
if (!g[ACTIVE_KEY]) g[ACTIVE_KEY] = new Set<string>();
const ACTIVE_WORKERS: Set<string> = g[ACTIVE_KEY]!;

export function markActive(jobId: string): void { ACTIVE_WORKERS.add(jobId); }
export function markInactive(jobId: string): void { ACTIVE_WORKERS.delete(jobId); }
export function isActive(jobId: string): boolean { return ACTIVE_WORKERS.has(jobId); }

/**
 * Fases que exigem worker vivo pra progredir. Se o status.json tem uma dessas
 * e o jobId NÃO está no Set ativo, o worker morreu (servidor foi fechado).
 * O caller trata isso como fase "interrupted" pra UI, sem tocar no disco.
 */
export function isRunningPhase(phase: JobPhase): boolean {
  return phase === "queued" || phase === "transcribing" || phase === "analyzing";
}

/** Aplica detecção de zumbi: se worker morto, retorna status com phase="interrupted". */
export function withInterruptionDetection(status: JobStatus): JobStatus {
  if (isRunningPhase(status.phase) && !isActive(status.id)) {
    return { ...status, phase: "interrupted" };
  }
  return status;
}

// Modelo de passos derivado do disco. Fonte da verdade é o próprio filesystem —
// evita divergência entre status.json e realidade (ex: crash entre gravar
// transcript.json e atualizar status.json).
export type StepId = "upload" | "transcribe" | "analyze";
export type StepState = "pending" | "running" | "done" | "error";

export type Step = {
  id: StepId;
  label: string;
  state: StepState;
  progress?: number;
  detalhe?: string;
  errorMsg?: string;
};

/**
 * Deriva o estado de cada passo pra um job.
 *   upload   done   ⇔ vídeo em disco
 *   transcribe done ⇔ transcript.json em disco
 *   analyze  done   ⇔ cuts.json em disco
 * O status.json ainda diz qual passo está *rodando* agora (via phase) e o
 * progresso do Whisper. Estados derivados + phase corrente = quadro completo.
 */
export function deriveSteps(jobId: string, status: JobStatus): Step[] {
  const dir = jobDir(jobId);
  const hasVideo = !!findVideoPath(jobId);
  const hasTranscript = existsSync(path.join(dir, "transcript.json"));
  const hasCuts = existsSync(path.join(dir, "cuts.json"));

  const running = isActive(jobId);
  const errorNow = status.phase === "error";

  const upload: Step = {
    id: "upload",
    label: "Upload do vídeo",
    state: hasVideo ? "done" : "pending",
  };

  const transcribe: Step = {
    id: "transcribe",
    label: "Transcrição (Whisper)",
    state: hasTranscript
      ? "done"
      : running && status.phase === "transcribing"
      ? "running"
      : errorNow && !hasTranscript
      ? "error"
      : "pending",
    progress: !hasTranscript && running && status.phase === "transcribing" ? status.percent : undefined,
    detalhe: !hasTranscript && running && status.phase === "transcribing" ? status.ultimo_texto : undefined,
    errorMsg: errorNow && !hasTranscript ? status.error : undefined,
  };

  const analyze: Step = {
    id: "analyze",
    label: "Detecção de cortes (Claude)",
    state: hasCuts
      ? "done"
      : running && status.phase === "analyzing"
      ? "running"
      : errorNow && hasTranscript
      ? "error"
      : "pending",
    errorMsg: errorNow && hasTranscript && !hasCuts ? status.error : undefined,
  };

  return [upload, transcribe, analyze];
}

export type JobStatus = {
  id: string;
  fileName: string;
  especialista_slug: string;
  brief?: string;
  phase: JobPhase;
  duracao_video?: number;
  atual_segundos?: number;
  percent?: number;
  ultimo_texto?: string;
  error?: string;
  startedAt: string;
  updatedAt: string;
  finishedAt?: string;
};

function statusPath(jobId: string): string {
  return path.join(jobDir(jobId), "status.json");
}

export async function writeStatus(status: JobStatus): Promise<void> {
  status.updatedAt = new Date().toISOString();
  await writeFile(statusPath(status.id), JSON.stringify(status, null, 2), "utf-8");
}

export async function readStatus(jobId: string): Promise<JobStatus | null> {
  try {
    const raw = JSON.parse(await readFile(statusPath(jobId), "utf-8")) as JobStatus;
    return withInterruptionDetection(raw);
  } catch {
    return null;
  }
}

/** Igual a readStatus, mas retorna a fase crua do disco (sem detecção de zumbi). */
export async function readStatusRaw(jobId: string): Promise<JobStatus | null> {
  try {
    return JSON.parse(await readFile(statusPath(jobId), "utf-8")) as JobStatus;
  } catch {
    return null;
  }
}

export async function updateStatus(jobId: string, patch: Partial<JobStatus>): Promise<JobStatus | null> {
  const current = await readStatusRaw(jobId);
  if (!current) return null;
  const merged: JobStatus = { ...current, ...patch, updatedAt: new Date().toISOString() };
  await writeStatus(merged);
  return merged;
}
