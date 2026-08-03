/**
 * GET /api/jobs/[jobId] — retorna o estado corrente do job (fase, progresso).
 * Se já terminou, inclui os cortes detectados.
 */

import { NextRequest } from "next/server";
import { readCutsFile } from "@/lib/jobs";
import { readStatus, deriveSteps } from "@/lib/job-status";

export async function GET(_req: NextRequest, { params }: { params: { jobId: string } }) {
  const status = await readStatus(params.jobId);
  if (!status) return Response.json({ error: "Job não encontrado" }, { status: 404 });

  const steps = deriveSteps(params.jobId, status);
  const cuts = status.phase === "done" ? readCutsFile(params.jobId) : null;
  return Response.json({ status, steps, cuts });
}
