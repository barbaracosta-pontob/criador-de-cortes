/**
 * Roda o Whisper (services/transcription/run.py) como subprocesso e streama o
 * progresso via callback. O run.py imprime `  [X.Xs → Y.Ys] texto` por segmento
 * no stderr — extraímos Y.Y como posição corrente e reportamos throttled.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "@/lib/db";

// Permite reusar a venv de outro projeto (ex: pontob-video-editor) via
// WHISPER_PYTHON — evita reinstalar o modelo Whisper (~3GB).
export const WHISPER_PYTHON =
  process.env.WHISPER_PYTHON ??
  path.join(
    REPO_ROOT,
    process.platform === "win32"
      ? "services/transcription/.venv/Scripts/python.exe"
      : "services/transcription/.venv/bin/python",
  );

export const TRANSCRIBE_SCRIPT = path.join(REPO_ROOT, "services/transcription/run.py");

export type WhisperProgress = {
  atual_segundos?: number;
  ultimo_texto?: string;
};

/**
 * Executa a transcrição. Emite progresso incremental via onProgress.
 * duracaoRef é usado apenas pra calcular % pelo caller (o Whisper não sabe).
 */
export function runWhisper(
  inputPath: string,
  outputPath: string,
  onProgress: (p: WhisperProgress) => void,
): Promise<void> {
  const pythonBin = existsSync(WHISPER_PYTHON) ? WHISPER_PYTHON : "python";
  const args = [
    TRANSCRIBE_SCRIPT,
    "--input", inputPath,
    "--output", outputPath,
    "--model", process.env.WHISPER_MODEL ?? "large-v3",
    "--device", process.env.WHISPER_DEVICE ?? "auto",
  ];

  return new Promise((resolve, reject) => {
    // No Windows, o Python default converte stderr pra cp1252 e faz backslashreplace
    // em não-ASCII — a seta unicode vira literal "→" (6 chars) e acentuação
    // vira mojibake. Forçamos UTF-8 pra o stderr vir cru e o regex bater.
    const child = spawn(pythonBin, args, {
      stdio: ["ignore", "ignore", "pipe"],
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });

    let stderrTail = "";
    let buf = "";
    // Formato de run.py: `  [12.34s → 15.67s] texto...`.
    // Aceita → (utf-8), -> (ASCII fallback) e → (backslashreplace do Windows).
    const segRe = /\[\s*(\d+(?:\.\d+)?)s\s*(?:->|→|\\u2192)\s*(\d+(?:\.\d+)?)s\s*\]\s*(.*)/;
    let lastEmit = 0;

    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf-8");
      stderrTail = (stderrTail + text).slice(-4000);
      buf += text;
      if (process.env.WHISPER_DEBUG === "1") process.stderr.write(text);

      const lines = buf.split(/\r?\n/);
      buf = lines.pop() ?? "";

      for (const line of lines) {
        const m = segRe.exec(line);
        if (!m) continue;
        const atual = parseFloat(m[2]);
        const now = Date.now();
        // Throttle 500ms — evita spammar SSE em segmentos curtos.
        if (now - lastEmit < 500) continue;
        lastEmit = now;
        const p = {
          atual_segundos: Math.round(atual * 10) / 10,
          ultimo_texto: m[3].trim().slice(0, 120),
        };
        if (process.env.WHISPER_DEBUG === "1") console.log(`[whisper progress]`, p);
        onProgress(p);
      }
    });

    child.on("error", (err) => reject(err));
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`whisper exit ${code}: ${stderrTail}`));
    });
  });
}
