/**
 * GET /api/jobs/[jobId]/video — serve o vídeo original com suporte a HTTP Range,
 * necessário para o player nativo fazer seek para os in/out de cada corte.
 */

import { NextRequest } from "next/server";
import { createReadStream, statSync } from "node:fs";
import path from "node:path";
import { findVideoPath } from "@/lib/jobs";

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
  ".webm": "video/webm",
  ".m4v": "video/x-m4v",
  ".avi": "video/x-msvideo",
};

export async function GET(req: NextRequest, { params }: { params: { jobId: string } }) {
  const videoPath = findVideoPath(params.jobId);
  if (!videoPath) return new Response("Vídeo não encontrado", { status: 404 });

  const size = statSync(videoPath).size;
  const contentType = MIME[path.extname(videoPath).toLowerCase()] ?? "video/mp4";
  const range = req.headers.get("range");

  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    const start = match && match[1] ? parseInt(match[1], 10) : 0;
    const end = match && match[2] ? parseInt(match[2], 10) : size - 1;
    const chunkEnd = Math.min(end, size - 1);
    const chunkSize = chunkEnd - start + 1;

    const nodeStream = createReadStream(videoPath, { start, end: chunkEnd });
    const webStream = nodeStreamToWeb(nodeStream);

    return new Response(webStream, {
      status: 206,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(chunkSize),
        "Content-Range": `bytes ${start}-${chunkEnd}/${size}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store",
      },
    });
  }

  const webStream = nodeStreamToWeb(createReadStream(videoPath));
  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
    },
  });
}

function nodeStreamToWeb(nodeStream: NodeJS.ReadableStream): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk) =>
        controller.enqueue(chunk instanceof Buffer ? new Uint8Array(chunk) : (chunk as Uint8Array)),
      );
      nodeStream.on("end", () => controller.close());
      nodeStream.on("error", (err) => controller.error(err));
    },
    cancel() {
      (nodeStream as unknown as { destroy?: () => void }).destroy?.();
    },
  });
}
