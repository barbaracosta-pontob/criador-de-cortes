/**
 * Helpers de path/leitura dos jobs. Cada job vive em <JOBS_DIR>/<jobId>/ com:
 *   - o vídeo original (nome preservado)
 *   - transcript.json  (saída do Whisper)
 *   - cuts.json        (cortes detectados pelo Claude + metadados)
 *   - cuts/<cutId>.mp4 (arquivos exportados sob demanda)
 */

import path from "node:path";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";

import { REPO_ROOT } from "./db";

export const JOBS_DIR = process.env.JOBS_DIR
  ? path.resolve(REPO_ROOT, process.env.JOBS_DIR)
  : path.join(REPO_ROOT, "jobs");

const VIDEO_EXTS = [".mp4", ".mov", ".mkv", ".webm", ".m4v", ".avi"];

export function jobDir(jobId: string): string {
  return path.join(JOBS_DIR, jobId);
}

/** Encontra o arquivo de vídeo dentro da pasta do job (nome preservado). */
export function findVideoPath(jobId: string): string | null {
  const dir = jobDir(jobId);
  if (!existsSync(dir)) return null;
  const file = readdirSync(dir).find((f) => VIDEO_EXTS.includes(path.extname(f).toLowerCase()));
  return file ? path.join(dir, file) : null;
}

export type CutsFile = {
  id: string;
  fileName: string;
  especialista_slug: string;
  brief?: string;
  video_source_duracao?: number;
  cortes: unknown[];
  createdAt: string;
};

export function readCutsFile(jobId: string): CutsFile | null {
  const fp = path.join(jobDir(jobId), "cuts.json");
  if (!existsSync(fp)) return null;
  try {
    return JSON.parse(readFileSync(fp, "utf-8")) as CutsFile;
  } catch {
    return null;
  }
}

import { isActive, isRunningPhase } from "./job-status";

type JobSummary = {
  id: string;
  fileName: string;
  especialista_slug: string;
  createdAt: string;
  phase: "queued" | "transcribing" | "analyzing" | "done" | "error" | "interrupted";
  percent?: number;
  numCortes: number;
};

export function listJobs(): JobSummary[] {
  if (!existsSync(JOBS_DIR)) return [];
  const out: JobSummary[] = [];

  for (const entry of readdirSync(JOBS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = jobDir(entry.name);

    // Tenta status.json primeiro (fluxo novo, cobre in-progress).
    const statusPath = path.join(dir, "status.json");
    if (existsSync(statusPath)) {
      try {
        const s = JSON.parse(readFileSync(statusPath, "utf-8")) as {
          id: string;
          fileName?: string;
          especialista_slug?: string;
          phase: JobSummary["phase"];
          percent?: number;
          startedAt?: string;
        };
        const cuts = s.phase === "done" ? readCutsFile(entry.name) : null;
        const displayPhase =
          isRunningPhase(s.phase) && !isActive(s.id) ? "interrupted" : s.phase;
        out.push({
          id: s.id,
          fileName: s.fileName ?? cuts?.fileName ?? "",
          especialista_slug: s.especialista_slug ?? cuts?.especialista_slug ?? "generico",
          createdAt: s.startedAt ?? "",
          phase: displayPhase,
          percent: s.percent,
          numCortes: cuts && Array.isArray(cuts.cortes) ? cuts.cortes.length : 0,
        });
        continue;
      } catch {}
    }

    // Fallback: jobs antigos (sem status.json) só têm cuts.json.
    const cuts = readCutsFile(entry.name);
    if (!cuts) continue;
    let createdAt = cuts.createdAt ?? "";
    if (!createdAt) {
      try {
        createdAt = statSync(path.join(dir, "cuts.json")).mtime.toISOString();
      } catch {}
    }
    out.push({
      id: entry.name,
      fileName: cuts.fileName ?? "",
      especialista_slug: cuts.especialista_slug ?? "generico",
      createdAt,
      phase: "done",
      numCortes: Array.isArray(cuts.cortes) ? cuts.cortes.length : 0,
    });
  }

  out.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  return out;
}
