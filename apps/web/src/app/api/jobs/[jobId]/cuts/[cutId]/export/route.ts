/**
 * POST /api/jobs/[jobId]/cuts/[cutId]/export — recorta o trecho com ffmpeg e
 * devolve o .mp4 para download, pronto para subir no pontob-video-editor.
 *
 * Default: -c copy (rápido, sem reencode) — corte snapa no keyframe mais próximo
 * do inicio_segundos. Aulas longas cortadas em ~1s. Com ?exact=1 força reencode
 * frame-accurate (mais lento, começa no gancho exato).
 */

import { NextRequest } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir } from "node:fs/promises";
import { createReadStream, statSync } from "node:fs";
import path from "node:path";

import { jobDir, readCutsFile, findVideoPath } from "@/lib/jobs";

export const maxDuration = 1800;
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

type Corte = { id: string; titulo?: string; inicio_segundos: number; fim_segundos: number };

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "corte";
}

export async function POST(req: NextRequest, { params }: { params: { jobId: string; cutId: string } }) {
  try {
    const cutsFile = readCutsFile(params.jobId);
    if (!cutsFile) return Response.json({ error: "Job não encontrado" }, { status: 404 });

    const corte = (cutsFile.cortes as Corte[]).find((c) => c.id === params.cutId);
    if (!corte) return Response.json({ error: "Corte não encontrado" }, { status: 404 });

    const videoPath = findVideoPath(params.jobId);
    if (!videoPath) return Response.json({ error: "Vídeo não encontrado" }, { status: 404 });

    const inicio = Math.max(0, corte.inicio_segundos);
    const duracao = Math.max(0.1, corte.fim_segundos - inicio);
    // -c copy é o default (aulas longas cortadas em ~1s). exact=1 reencoda.
    const exact = req.nextUrl.searchParams.get("exact") === "1";

    const outDir = path.join(jobDir(params.jobId), "cuts");
    await mkdir(outDir, { recursive: true });
    const outName = `${slug(corte.titulo || corte.id)}.mp4`;
    const outPath = path.join(outDir, `${params.cutId}.mp4`);

    const args = exact
      ? [
          "-y",
          "-ss", String(inicio),
          "-i", videoPath,
          "-t", String(duracao),
          "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
          "-c:a", "aac", "-b:a", "160k",
          "-movflags", "+faststart",
          outPath,
        ]
      : ["-y", "-ss", String(inicio), "-i", videoPath, "-t", String(duracao), "-c", "copy", "-movflags", "+faststart", outPath];

    await execFileAsync("ffmpeg", args, { maxBuffer: 64 * 1024 * 1024 });

    // Streamo o arquivo direto do disco — recortes de aulas longas passam de 100MB;
    // ler tudo em Buffer estoura RAM. HTTP Range aqui não é necessário (download).
    const size = statSync(outPath).size;
    const nodeStream = createReadStream(outPath);
    const webStream = new ReadableStream<Uint8Array>({
      start(controller) {
        nodeStream.on("data", (c) =>
          controller.enqueue(c instanceof Buffer ? new Uint8Array(c) : (c as Uint8Array)),
        );
        nodeStream.on("end", () => controller.close());
        nodeStream.on("error", (e) => controller.error(e));
      },
      cancel() {
        nodeStream.destroy();
      },
    });
    return new Response(webStream, {
      status: 200,
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${outName}"`,
        "Content-Length": String(size),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[POST export]", err);
    const raw = err instanceof Error ? err.message : String(err);
    return Response.json({ error: `Erro ao exportar corte: ${raw}` }, { status: 500 });
  }
}
