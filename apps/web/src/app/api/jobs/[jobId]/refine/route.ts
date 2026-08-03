/**
 * POST /api/jobs/[jobId]/refine — recebe { prompt } e re-gera os cortes aplicando
 * o pedido do usuário sobre a lista atual. Persiste e devolve os cortes atualizados.
 */

import { NextRequest } from "next/server";
import { writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";

import { refineCuts } from "@/services/analysis-bridge";
import { getEspecialistaOrGenerico } from "@/lib/db";
import { getVideoDuration } from "@/lib/video-duration";
import { jobDir, readCutsFile, findVideoPath } from "@/lib/jobs";
import { toContexto } from "@/lib/especialista-contexto";

export const maxDuration = 1800;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { jobId: string } }) {
  try {
    const { prompt } = (await req.json()) as { prompt?: string };
    if (!prompt || !prompt.trim()) {
      return Response.json({ error: "Pedido de refino vazio." }, { status: 400 });
    }

    const cutsFile = readCutsFile(params.jobId);
    if (!cutsFile) return Response.json({ error: "Job não encontrado" }, { status: 404 });

    const dir = jobDir(params.jobId);
    const transcriptPath = path.join(dir, "transcript.json");
    if (!existsSync(transcriptPath)) {
      return Response.json({ error: "Transcrição não encontrada para este job." }, { status: 404 });
    }
    const transcript = JSON.parse(await readFile(transcriptPath, "utf-8"));

    const videoPath = findVideoPath(params.jobId);
    const videoDuration = videoPath ? await getVideoDuration(videoPath) : cutsFile.video_source_duracao ?? null;

    const rawEspecialista = getEspecialistaOrGenerico(cutsFile.especialista_slug);

    const result = await refineCuts({
      transcript,
      videoDuration: videoDuration ?? undefined,
      cortesAtuais: { cortes: cutsFile.cortes, video_source_duracao: cutsFile.video_source_duracao },
      especialista: toContexto(rawEspecialista),
      brief: prompt,
    });

    const updated = {
      ...cutsFile,
      video_source_duracao: result.cuts.video_source_duracao ?? cutsFile.video_source_duracao,
      cortes: result.cuts.cortes,
    };

    await writeFile(path.join(dir, "cuts.json"), JSON.stringify(updated, null, 2), "utf-8");

    return Response.json(updated);
  } catch (err) {
    console.error("[POST /api/jobs/:id/refine]", err);
    const raw = err instanceof Error ? err.message : String(err);
    return Response.json({ error: `Erro ao refinar: ${raw}` }, { status: 500 });
  }
}
