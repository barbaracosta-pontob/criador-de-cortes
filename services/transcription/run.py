"""
Transcrição com faster-whisper — word-level timestamps em PT-BR.

Uso:
    python run.py --input video.mp4 --output transcript.json [--model large-v3] [--device auto]

Saída: JSON com segments + words timestampados, pronto para alimentar a etapa de análise Claude.
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

from faster_whisper import WhisperModel


def transcribe(
    input_path: str,
    output_path: str,
    model_size: str = "large-v3",
    device: str = "auto",
    language: str = "pt",
    beam_size: int = 5,
) -> dict:
    """Transcreve o vídeo e salva JSON estruturado."""

    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Arquivo não encontrado: {input_path}")

    # Auto-detect device se não especificado
    if device == "auto":
        try:
            import torch
            device = "cuda" if torch.cuda.is_available() else "cpu"
        except ImportError:
            device = "cpu"

    compute_type = "float16" if device == "cuda" else "int8"

    print(f"[transcribe] modelo={model_size} device={device} compute_type={compute_type}", file=sys.stderr)
    print(f"[transcribe] carregando modelo (primeira vez baixa ~3GB)...", file=sys.stderr)
    t0 = time.time()
    model = WhisperModel(model_size, device=device, compute_type=compute_type)
    print(f"[transcribe] modelo carregado em {time.time() - t0:.1f}s", file=sys.stderr)

    print(f"[transcribe] transcrevendo {input_path}...", file=sys.stderr)
    t0 = time.time()
    segments_iter, info = model.transcribe(
        input_path,
        language=language,
        beam_size=beam_size,
        word_timestamps=True,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
    )

    segments = []
    for seg in segments_iter:
        words = []
        if seg.words:
            for w in seg.words:
                words.append({
                    "word": w.word.strip(),
                    "start": round(w.start, 3),
                    "end": round(w.end, 3),
                    "probability": round(w.probability, 3),
                })

        segments.append({
            "id": seg.id,
            "start": round(seg.start, 3),
            "end": round(seg.end, 3),
            "text": seg.text.strip(),
            "words": words,
        })
        # Stream incremental progress
        print(f"  [{seg.start:.1f}s → {seg.end:.1f}s] {seg.text[:80]}", file=sys.stderr)

    elapsed = time.time() - t0
    duration = info.duration
    realtime_factor = duration / elapsed if elapsed > 0 else 0
    print(f"[transcribe] concluído. {len(segments)} segments. {elapsed:.1f}s para {duration:.1f}s de áudio ({realtime_factor:.1f}x realtime).", file=sys.stderr)

    result = {
        "language": info.language,
        "language_probability": round(info.language_probability, 3),
        "duration": round(info.duration, 3),
        "segments": segments,
        "metadata": {
            "model": model_size,
            "device": device,
            "compute_type": compute_type,
            "beam_size": beam_size,
            "elapsed_seconds": round(elapsed, 1),
        },
    }

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"[transcribe] salvo em {output_path}", file=sys.stderr)
    return result


def main():
    parser = argparse.ArgumentParser(description="Transcrever vídeo com faster-whisper")
    parser.add_argument("--input", required=True, help="Caminho do vídeo de entrada (mp4, mov, etc)")
    parser.add_argument("--output", required=True, help="Caminho do JSON de saída")
    parser.add_argument("--model", default=os.getenv("WHISPER_MODEL", "large-v3"))
    parser.add_argument("--device", default=os.getenv("WHISPER_DEVICE", "auto"))
    parser.add_argument("--language", default="pt")
    parser.add_argument("--beam-size", type=int, default=5)

    args = parser.parse_args()

    transcribe(
        input_path=args.input,
        output_path=args.output,
        model_size=args.model,
        device=args.device,
        language=args.language,
        beam_size=args.beam_size,
    )


if __name__ == "__main__":
    main()
