/**
 * Roda o pipeline completo em background:
 *   transcribe (Whisper) → analyze (Claude) → grava cuts.json → marca done.
 *
 * Não amarrado ao HTTP: o handler POST /api/jobs chama isso SEM await e retorna
 * o jobId na hora. Aulas de 2h que levam horas na CPU não seguram a rota nem
 * batem em maxDuration. Se o Node cair no meio, o job morre — mas o
 * status.json fica travado em "transcribing" e o user vê no reload.
 */

import { writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

import { analyzeCuts } from "@/services/analysis-bridge";
import { getEspecialistaOrGenerico } from "@/lib/db";
import { getVideoDuration } from "@/lib/video-duration";
import { jobDir, findVideoPath } from "@/lib/jobs";
import { toContexto, briefFinal } from "@/lib/especialista-contexto";
import { runWhisper } from "@/lib/whisper";
import { updateStatus, readStatusRaw, markActive, markInactive } from "@/lib/job-status";

/** Traduz erros da Anthropic em mensagens que o usuário entende. */
function friendlyError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes("401") || raw.toLowerCase().includes("authentication") || raw.toLowerCase().includes("api key")) {
    return "Chave de API inválida ou ausente. Verifique ANTHROPIC_API_KEY no .env e reinicie o servidor.";
  }
  if (raw.includes("529") || raw.toLowerCase().includes("overloaded")) {
    return "A API da Anthropic está sobrecarregada. Tente novamente em alguns segundos.";
  }
  if (raw.includes("rate") || raw.includes("429")) {
    return "Limite de requisições da API atingido. Aguarde alguns segundos e tente novamente.";
  }
  return `Erro ao processar o vídeo: ${raw}`;
}

export async function processJob(jobId: string): Promise<void> {
  const dir = jobDir(jobId);
  const status = await readStatusRaw(jobId);
  if (!status) {
    console.error(`[processJob ${jobId}] status.json não encontrado — abort`);
    return;
  }

  markActive(jobId);
  try {
    const videoPath = findVideoPath(jobId);
    if (!videoPath) throw new Error("Vídeo não encontrado no jobDir");

    // Duração antes do Whisper — necessária pra calcular % de progresso.
    const duracaoVideo = await getVideoDuration(videoPath);
    await updateStatus(jobId, { phase: "transcribing", duracao_video: duracaoVideo ?? undefined });

    // ETAPA 1: Whisper (só se ainda não temos transcript.json)
    // run.py grava o arquivo só no final — se existe, é porque a transcrição
    // completou numa execução anterior. Reprocessa sem re-transcrever (economia
    // de horas em aulas longas quando o erro foi só na etapa do Claude).
    const transcriptPath = path.join(dir, "transcript.json");
    if (!existsSync(transcriptPath)) {
      let lastWrite = 0;
      await runWhisper(videoPath, transcriptPath, (p) => {
        const now = Date.now();
        if (now - lastWrite < 1000) return;
        lastWrite = now;
        const percent =
          p.atual_segundos !== undefined && duracaoVideo && duracaoVideo > 0
            ? Math.min(99, Math.round((p.atual_segundos / duracaoVideo) * 100))
            : undefined;
        updateStatus(jobId, {
          atual_segundos: p.atual_segundos,
          percent,
          ultimo_texto: p.ultimo_texto,
        }).catch(() => {});
      });
    } else {
      console.log(`[processJob ${jobId}] transcript.json já existe — pulando Whisper`);
    }
    const transcript = JSON.parse(await readFile(transcriptPath, "utf-8"));

    // ETAPA 2: Claude
    await updateStatus(jobId, { phase: "analyzing", atual_segundos: undefined, ultimo_texto: undefined, percent: undefined });

    const rawEspecialista = getEspecialistaOrGenerico(status.especialista_slug);
    const result = await analyzeCuts({
      transcript,
      videoDuration: duracaoVideo ?? undefined,
      especialista: toContexto(rawEspecialista),
      brief: briefFinal(rawEspecialista, status.brief),
    });

    // ETAPA 3: grava cuts.json (compatível com o resto do app)
    const cutsFile = {
      id: jobId,
      fileName: status.fileName,
      especialista_slug: status.especialista_slug,
      brief: status.brief,
      video_source_duracao: result.cuts.video_source_duracao ?? duracaoVideo ?? undefined,
      cortes: result.cuts.cortes,
      createdAt: status.startedAt,
    };
    await writeFile(path.join(dir, "cuts.json"), JSON.stringify(cutsFile, null, 2), "utf-8");

    await updateStatus(jobId, { phase: "done", finishedAt: new Date().toISOString() });
  } catch (err) {
    console.error(`[processJob ${jobId}]`, err);
    await updateStatus(jobId, {
      phase: "error",
      error: friendlyError(err),
      finishedAt: new Date().toISOString(),
    });
  } finally {
    markInactive(jobId);
  }
}
