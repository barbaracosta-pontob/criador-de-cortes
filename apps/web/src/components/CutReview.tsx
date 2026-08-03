"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import type { Cut } from "@pontob/cut-schema";
import CutCard from "./CutCard";
import styles from "./CutReview.module.css";

type Job = {
  id: string;
  fileName: string;
  especialista_slug: string;
  brief?: string;
  video_source_duracao?: number;
  cortes: Cut[];
};

export default function CutReview({
  job,
  onNewVideo,
  onJobUpdate,
}: {
  job: Job;
  onNewVideo: () => void;
  onJobUpdate: (job: Job) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loop, setLoop] = useState(true);
  const [refinePrompt, setRefinePrompt] = useState("");
  const [refining, setRefining] = useState(false);
  const [error, setError] = useState("");

  // Janela do corte tocando agora — lida pelo listener de timeupdate.
  const windowRef = useRef<{ inicio: number; fim: number } | null>(null);

  const cortes = job.cortes;
  const activeCut = useMemo(() => cortes.find((c) => c.id === activeId) ?? null, [cortes, activeId]);

  const playCut = useCallback(
    (cut: Cut) => {
      const v = videoRef.current;
      if (!v) return;
      windowRef.current = { inicio: cut.inicio_segundos, fim: cut.fim_segundos };
      setActiveId(cut.id);
      // Se o usuário mexeu no volume/mute do controle nativo, o browser mantém
      // esse estado em plays subsequentes. Forçamos áudio ligado a cada play
      // pra evitar preview mudo silencioso.
      v.muted = false;
      if (v.volume === 0) v.volume = 1;
      v.currentTime = cut.inicio_segundos;
      void v.play().catch(() => {});
    },
    [],
  );

  // Pausa (ou loopa) o vídeo ao chegar no fim do corte ativo.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      const w = windowRef.current;
      if (!w) return;
      if (v.currentTime >= w.fim) {
        if (loop) {
          v.currentTime = w.inicio;
        } else {
          v.pause();
        }
      }
    };
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, [loop]);

  async function handleRefine(e: React.FormEvent) {
    e.preventDefault();
    if (!refinePrompt.trim() || refining) return;
    setRefining(true);
    setError("");
    try {
      const res = await fetch(`/api/jobs/${job.id}/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: refinePrompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao refinar");
      onJobUpdate(data as Job);
      setRefinePrompt("");
      setActiveId(null);
      windowRef.current = null;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRefining(false);
    }
  }

  return (
    <main className={styles.wrap}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>{cortes.length} cortes encontrados</h1>
          <p className={styles.sub}>{job.fileName}</p>
        </div>
        <button className={styles.ghost} onClick={onNewVideo}>
          <ArrowLeft size={14} strokeWidth={2.5} /> Novo vídeo
        </button>
      </header>

      <div className={styles.grid}>
        <div className={styles.player}>
          <video
            ref={videoRef}
            className={styles.video}
            src={`/api/jobs/${job.id}/video`}
            controls
            playsInline
          />
          <label className={styles.loopToggle}>
            <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
            Repetir corte em loop
          </label>
          {activeCut && (
            <div className={styles.nowPlaying}>
              <span className={styles.npLabel}>Tocando</span>
              <strong>{activeCut.titulo}</strong>
              <span className={styles.npTime}>
                {fmt(activeCut.inicio_segundos)} → {fmt(activeCut.fim_segundos)} ·{" "}
                {Math.round(activeCut.duracao_segundos)}s
              </span>
            </div>
          )}
        </div>

        <div className={styles.list}>
          {cortes.map((cut) => (
            <CutCard
              key={cut.id}
              cut={cut}
              jobId={job.id}
              active={cut.id === activeId}
              onPlay={() => playCut(cut)}
            />
          ))}
        </div>
      </div>

      <form className={styles.refine} onSubmit={handleRefine}>
        <span className={styles.refineLabel}>Refinar os cortes</span>
        <div className={styles.refineRow}>
          <input
            className={styles.refineInput}
            placeholder="Ex: junta o corte 2 e 3, foca em objeções, quero só os 3 melhores…"
            value={refinePrompt}
            disabled={refining}
            onChange={(e) => setRefinePrompt(e.target.value)}
          />
          <button className={styles.refineBtn} disabled={refining || !refinePrompt.trim()}>
            <Sparkles size={14} strokeWidth={2.5} />
            {refining ? "Refinando…" : "Refinar"}
          </button>
        </div>
        {error && <div className={styles.errorBox}>{error}</div>}
      </form>
    </main>
  );
}

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}
