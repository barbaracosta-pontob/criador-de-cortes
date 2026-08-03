/**
 * POST /api/jobs/[jobId]/reprocess — reseta o status e dispara o worker de novo.
 *
 * Usado quando o job foi interrompido (servidor fechado durante transcrição).
 * O vídeo já está em disco, então reprocessar não exige re-upload. Whisper
 * roda do zero (não há resume verdadeiro; se o modelo do .env mudou, o novo
 * modelo é usado).
 */

import { NextRequest } from "next/server";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { readStatusRaw, writeStatus, isActive } from "@/lib/job-status";
import { findVideoPath, jobDir } from "@/lib/jobs";
import { processJob } from "@/lib/process-job";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { jobId: string } }) {
  const jobId = params.jobId;

  const current = await readStatusRaw(jobId);
  if (!current) {
    return Response.json({ error: "Job não encontrado" }, { status: 404 });
  }

  // Evita disparar 2 workers pro mesmo job.
  if (isActive(jobId)) {
    return Response.json({ error: "Este job já está rodando" }, { status: 409 });
  }

  const videoPath = findVideoPath(jobId);
  if (!videoPath) {
    return Response.json({ error: "Vídeo não encontrado no jobDir" }, { status: 404 });
  }

  // from=transcribe → apaga transcript.json e cuts.json (força re-Whisper).
  // from=analyze    → apaga só cuts.json (pula Whisper, refaz Claude).
  // sem from        → continua do que tem em disco (só refaz o que falta).
  const from = req.nextUrl.searchParams.get("from");
  const dir = jobDir(jobId);
  if (from === "transcribe") {
    await unlink(path.join(dir, "transcript.json")).catch(() => {});
    await unlink(path.join(dir, "cuts.json")).catch(() => {});
  } else if (from === "analyze") {
    await unlink(path.join(dir, "cuts.json")).catch(() => {});
  }

  await writeStatus({
    ...current,
    phase: "queued",
    percent: undefined,
    atual_segundos: undefined,
    ultimo_texto: undefined,
    error: undefined,
    finishedAt: undefined,
  });

  void processJob(jobId);

  return Response.json({ jobId, phase: "queued", from: from ?? "resume" });
}
