/**
 * POST /api/jobs — recebe vídeo. Cria jobId, escreve status.json, DISPARA o
 *   worker em background sem await, retorna { jobId } na hora. O
 *   processamento (Whisper 2h + Claude) roda solto — não amarrado ao request.
 *   Se o usuário fecha o browser, o job continua até o Node cair.
 * GET  /api/jobs — lista todos os jobs (incluindo in-progress).
 */

import { NextRequest } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

import { JOBS_DIR, listJobs } from "@/lib/jobs";
import { writeStatus } from "@/lib/job-status";
import { processJob } from "@/lib/process-job";

// Handler retorna rápido (só salva arquivo + kick off). Sem risco de timeout HTTP.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const videoFile = form.get("video") as File | null;
    const brief = (form.get("brief") as string) ?? "";
    const especialistaSlug = (form.get("especialista_slug") as string) ?? "generico";

    if (!videoFile) {
      return Response.json({ error: "Vídeo não enviado" }, { status: 400 });
    }

    const jobId = crypto.randomUUID().slice(0, 8);
    const dir = path.join(JOBS_DIR, jobId);
    await mkdir(dir, { recursive: true });

    const videoPath = path.join(dir, videoFile.name);
    await writeFile(videoPath, Buffer.from(await videoFile.arrayBuffer()));

    const now = new Date().toISOString();
    await writeStatus({
      id: jobId,
      fileName: videoFile.name,
      especialista_slug: especialistaSlug,
      brief,
      phase: "queued",
      startedAt: now,
      updatedAt: now,
    });

    // Fire-and-forget: não amarrado ao request. Errors capturados dentro do worker.
    void processJob(jobId);

    return Response.json({ jobId });
  } catch (err) {
    console.error("[POST /api/jobs]", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET() {
  try {
    return Response.json(listJobs());
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
