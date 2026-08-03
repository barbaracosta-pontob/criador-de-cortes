/**
 * GET /api/jobs/[jobId]/events — SSE que tail o status.json em polling curto.
 *
 * Frontend fica conectado aqui do "queued" até "done"/"error". Se browser
 * fecha e reabre 3h depois, reconecta e recebe o estado atual (o worker
 * continuou escrevendo status.json enquanto ninguém escutava).
 *
 * Poll a cada 700ms — status.json é escrito no máximo 1x/s pelo worker.
 * Não usamos fs.watch pra evitar edge cases em Windows.
 */

import { NextRequest } from "next/server";
import { readCutsFile } from "@/lib/jobs";
import { readStatus, deriveSteps } from "@/lib/job-status";

export const dynamic = "force-dynamic";

const POLL_MS = 700;
const HEARTBEAT_MS = 15000;

function sse(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function GET(_req: NextRequest, { params }: { params: { jobId: string } }) {
  const encoder = new TextEncoder();
  const jobId = params.jobId;
  console.log(`[events ${jobId}] client connected`);

  const stream = new ReadableStream({
    async start(controller) {
      try {
      let closed = false;
      let lastSerialized = "";

      // Silencioso: entre um await e o enqueue seguinte, o browser pode fechar
      // a conexão; qualquer enqueue depois disso lança ERR_INVALID_STATE. Não
      // é bug, é fim de vida do stream — só marcamos e paramos.
      const safeEnqueue = (payload: string): boolean => {
        if (closed) return false;
        try {
          controller.enqueue(encoder.encode(payload));
          return true;
        } catch {
          closed = true;
          return false;
        }
      };

      const heartbeat = setInterval(() => {
        safeEnqueue(": ping\n\n");
      }, HEARTBEAT_MS);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        try { controller.close(); } catch {}
      };

      // Envia o estado inicial imediatamente
      const initial = await readStatus(jobId);
      if (!initial) {
        safeEnqueue(sse({ type: "error", message: "Job não encontrado" }));
        cleanup();
        return;
      }
      const initialSteps = deriveSteps(jobId, initial);
      lastSerialized = JSON.stringify({ status: initial, steps: initialSteps });
      safeEnqueue(sse({ type: "status", status: initial, steps: initialSteps }));

      if (initial.phase === "done") {
        const cuts = readCutsFile(jobId);
        safeEnqueue(sse({ type: "done", job: cuts }));
        cleanup();
        return;
      }
      // Fases terminais estáveis (não voltam sem ação do usuário via /reprocess).
      // "interrupted" pode virar "queued" novamente — continuamos polling pra ver.
      if (initial.phase === "error") {
        cleanup();
        return;
      }

      const poll = async () => {
        if (closed) return;
        let s;
        try { s = await readStatus(jobId); } catch { s = null; }
        if (closed) return; // conexão morreu durante o await
        if (s) {
          const steps = deriveSteps(jobId, s);
          const serialized = JSON.stringify({ status: s, steps });
          if (serialized !== lastSerialized) {
            lastSerialized = serialized;
            if (!safeEnqueue(sse({ type: "status", status: s, steps }))) return;
            if (s.phase === "done") {
              const cuts = readCutsFile(jobId);
              safeEnqueue(sse({ type: "done", job: cuts }));
              cleanup();
              return;
            }
            if (s.phase === "error") {
              cleanup();
              return;
            }
          }
        }
        if (!closed) setTimeout(poll, POLL_MS);
      };
      setTimeout(poll, POLL_MS);
      } catch (err) {
        console.error(`[events ${jobId}] start crash:`, err);
        try { controller.close(); } catch {}
      }
    },
    cancel() {
      // Browser fechou a conexão. Cleanup vem via closed flag no próximo tick.
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
