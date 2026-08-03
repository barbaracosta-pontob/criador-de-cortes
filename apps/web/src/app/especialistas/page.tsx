"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

type Especialista = {
  slug: string;
  nome: string;
  cargo: string;
  nicho: string;
  publico_alvo: string;
  tom_de_voz: string;
  objetivo: string;
  vocabulario: string;
  brief_padrao: string;
};

const EMPTY: Especialista = {
  slug: "",
  nome: "",
  cargo: "",
  nicho: "",
  publico_alvo: "",
  tom_de_voz: "",
  objetivo: "",
  vocabulario: "",
  brief_padrao: "",
};

export default function EspecialistasPage() {
  const [list, setList] = useState<Especialista[]>([]);
  const [form, setForm] = useState<Especialista>(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    fetch("/api/especialistas")
      .then((r) => r.json())
      .then((l) => Array.isArray(l) && setList(l))
      .catch(() => {});
  }
  useEffect(load, []);

  function edit(e: Especialista) {
    setForm(e);
    setEditing(e.slug);
    setError("");
  }
  function resetForm() {
    setForm(EMPTY);
    setEditing(null);
    setError("");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const isEdit = Boolean(editing);
      const url = isEdit ? `/api/especialistas/${editing}` : "/api/especialistas";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao salvar");
      resetForm();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(slug: string) {
    if (!confirm(`Remover ${slug}?`)) return;
    await fetch(`/api/especialistas/${slug}`, { method: "DELETE" });
    if (editing === slug) resetForm();
    load();
  }

  const set = (k: keyof Especialista) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <main className={styles.wrap}>
      <header className={styles.head}>
        <h1 className={styles.title}>Especialistas</h1>
        <Link href="/" className={styles.ghost}>
          ← Voltar
        </Link>
      </header>

      <div className={styles.grid}>
        <form className={styles.card} onSubmit={save}>
          <h2 className={styles.cardTitle}>{editing ? `Editar: ${editing}` : "Novo especialista"}</h2>

          {!editing && (
            <Field label="Slug (id único, ex: dra-denise)">
              <input className={styles.input} value={form.slug} onChange={set("slug")} placeholder="dra-denise" required />
            </Field>
          )}
          <Field label="Nome">
            <input className={styles.input} value={form.nome} onChange={set("nome")} required />
          </Field>
          <Field label="Cargo">
            <input className={styles.input} value={form.cargo} onChange={set("cargo")} placeholder="Psiquiatra" />
          </Field>
          <Field label="Nicho">
            <input className={styles.input} value={form.nicho} onChange={set("nicho")} placeholder="Saúde mental" />
          </Field>
          <Field label="Público-alvo">
            <textarea className={styles.textarea} rows={2} value={form.publico_alvo} onChange={set("publico_alvo")} placeholder="Quem assiste os vídeos" />
          </Field>
          <Field label="Tom de voz">
            <input className={styles.input} value={form.tom_de_voz} onChange={set("tom_de_voz")} placeholder="Técnico, direto" />
          </Field>
          <Field label="Objetivo dos cortes">
            <input className={styles.input} value={form.objetivo} onChange={set("objetivo")} placeholder="Atrair alunos para a mentoria" />
          </Field>
          <Field label="Vocabulário (termos técnicos, separados por vírgula)">
            <textarea className={styles.textarea} rows={2} value={form.vocabulario} onChange={set("vocabulario")} />
          </Field>
          <Field label="Prompt-guia padrão (opcional)">
            <textarea className={styles.textarea} rows={2} value={form.brief_padrao} onChange={set("brief_padrao")} />
          </Field>

          {error && <div className={styles.errorBox}>{error}</div>}

          <div className={styles.formActions}>
            <button type="submit" className={styles.primary} disabled={saving}>
              {saving ? "Salvando…" : editing ? "Salvar alterações" : "Criar"}
            </button>
            {editing && (
              <button type="button" className={styles.ghostBtn} onClick={resetForm}>
                Cancelar
              </button>
            )}
          </div>
        </form>

        <div className={styles.listCol}>
          {list.length === 0 && <p className={styles.empty}>Nenhum especialista cadastrado ainda.</p>}
          {list.map((e) => (
            <div key={e.slug} className={styles.item}>
              <div className={styles.itemInfo}>
                <strong>{e.nome}</strong>
                <span className={styles.itemSub}>
                  {e.cargo} {e.nicho ? `· ${e.nicho}` : ""}
                </span>
              </div>
              <div className={styles.itemActions}>
                <button className={styles.ghostBtn} onClick={() => edit(e)}>
                  Editar
                </button>
                <button className={styles.dangerBtn} onClick={() => remove(e.slug)}>
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      {children}
    </label>
  );
}
