"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles, ListVideo, Users } from "lucide-react";
import styles from "./page.module.css";

type Especialista = { slug: string; nome: string; cargo: string };

export default function Home() {
  const router = useRouter();
  const [especialistas, setEspecialistas] = useState<Especialista[]>([]);
  const [slug, setSlug] = useState("generico");
  const [brief, setBrief] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/especialistas")
      .then((r) => r.json())
      .then((list) => Array.isArray(list) && setEspecialistas(list))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError("");

    const form = new FormData();
    form.append("video", file);
    form.append("especialista_slug", slug);
    form.append("brief", brief);

    try {
      const res = await fetch("/api/jobs", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok || !data.jobId) throw new Error(data.error ?? "Falha ao enviar");
      // Redireciona pra página do job — progresso persiste mesmo se fechar o browser.
      router.push(`/jobs/${data.jobId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setUploading(false);
    }
  }

  return (
    <main className={styles.wrap}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>Cut Creator</h1>
          <p className={styles.sub}>
            Sobe o vídeo. A IA acha os melhores cortes para Reels, Shorts e ads.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link href="/jobs" className={styles.ghost}>
            <ListVideo size={14} strokeWidth={2.5} /> Jobs
          </Link>
          <Link href="/especialistas" className={styles.ghost}>
            <Users size={14} strokeWidth={2.5} /> Especialistas
          </Link>
        </div>
      </header>

      <form className={styles.card} onSubmit={handleSubmit}>
        <label className={styles.field}>
          <span className={styles.label}>Vídeo</span>
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            disabled={uploading}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className={styles.file}
          />
          {file && file.size > 300 * 1024 * 1024 && (
            <span className={styles.hint}>
              Arquivo de {(file.size / 1024 / 1024).toFixed(0)}MB. Aulas longas
              podem levar horas com <code>WHISPER_MODEL=large-v3</code> na CPU.
              Troque pra <code>WHISPER_MODEL=small</code> no <code>.env</code> —
              5-10x mais rápido e ainda pega os cortes bem.
            </span>
          )}
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Especialista</span>
          <select
            className={styles.select}
            value={slug}
            disabled={uploading}
            onChange={(e) => setSlug(e.target.value)}
          >
            <option value="generico">Genérico</option>
            {especialistas.map((e) => (
              <option key={e.slug} value={e.slug}>
                {e.nome} {e.cargo ? `— ${e.cargo}` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>
            Prompt-guia <span className={styles.opt}>(opcional)</span>
          </span>
          <textarea
            className={styles.textarea}
            rows={3}
            disabled={uploading}
            placeholder="Ex: cortes que atraiam psiquiatras para a mentoria. Foca em objeções e casos clínicos."
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
          />
        </label>

        <button type="submit" className={styles.primary} disabled={!file || uploading}>
          <Sparkles size={16} strokeWidth={2.5} />
          {uploading ? "Enviando…" : "Detectar cortes"}
        </button>

        <p className={styles.warn}>
          Deixe o servidor aberto até o fim. Se fechar durante o processamento,
          o job é marcado como <strong>Interrompido</strong> e não retoma sozinho —
          você precisa abrir o job em <a href="/jobs">Jobs</a> e clicar em
          Reprocessar. O vídeo já fica salvo, então não é preciso reenviar.
        </p>

        {error && <div className={styles.errorBox}>{error}</div>}
      </form>

      <p className={styles.foot}>
        Depois de aprovar, baixe cada corte em .mp4 e suba no editor de vídeos para
        finalizar (headline, legenda, formatos).
      </p>
    </main>
  );
}
