"use client";

import { useState } from "react";
import { Play, Download } from "lucide-react";
import type { Cut } from "@pontob/cut-schema";
import styles from "./CutCard.module.css";

const FORMATO_LABEL: Record<string, string> = {
  vertical_curto: "Reels/Shorts",
  vertical_longo: "Vertical longo",
  horizontal_ads: "Ads",
};

export default function CutCard({
  cut,
  jobId,
  active,
  onPlay,
}: {
  cut: Cut;
  jobId: string;
  active: boolean;
  onPlay: () => void;
}) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  async function handleExport() {
    setExporting(true);
    setError("");
    try {
      const res = await fetch(`/api/jobs/${jobId}/cuts/${cut.id}/export`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Falha ao exportar");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${cut.id}.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  }

  return (
    <article className={`${styles.card} ${active ? styles.active : ""}`}>
      <div className={styles.top}>
        <span className={styles.score} title="Prioridade (0-100)">
          {Math.round(cut.score)}
        </span>
        <div className={styles.meta}>
          <span className={styles.badge}>{FORMATO_LABEL[cut.formato_sugerido] ?? cut.formato_sugerido}</span>
          <span className={styles.time}>
            {fmt(cut.inicio_segundos)}–{fmt(cut.fim_segundos)} · {Math.round(cut.duracao_segundos)}s
          </span>
        </div>
      </div>

      <h3 className={styles.title}>{cut.titulo}</h3>
      {cut.hook && <p className={styles.hook}>“{cut.hook}”</p>}
      {cut.motivo && <p className={styles.motivo}>{cut.motivo}</p>}
      {cut.legenda_sugerida && (
        <details className={styles.legendaWrap}>
          <summary>Legenda sugerida</summary>
          <p className={styles.legenda}>{cut.legenda_sugerida}</p>
        </details>
      )}

      <div className={styles.actions}>
        <button className={styles.play} onClick={onPlay}>
          <Play size={14} strokeWidth={2.5} fill="currentColor" />
          {active ? "Tocando" : "Assistir"}
        </button>
        <button className={styles.export} onClick={handleExport} disabled={exporting}>
          <Download size={14} strokeWidth={2.5} />
          {exporting ? "Exportando…" : "Baixar .mp4"}
        </button>
      </div>
      {error && <div className={styles.errorBox}>{error}</div>}
    </article>
  );
}

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}
