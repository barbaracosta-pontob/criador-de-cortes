/**
 * GET    /api/especialistas/[slug] — retorna um especialista.
 * PUT    /api/especialistas/[slug] — atualiza.
 * DELETE /api/especialistas/[slug] — remove.
 */

import { NextRequest, NextResponse } from "next/server";
import { getEspecialista, saveEspecialista, deleteEspecialista, type EspecialistaRow } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  const esp = getEspecialista(params.slug);
  if (!esp) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json(esp);
}

export async function PUT(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const body = await req.json();
    const existing = getEspecialista(params.slug);
    if (!existing) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    const data: EspecialistaRow = {
      ...existing,
      ...body,
      slug: params.slug, // slug é imutável
    };
    saveEspecialista(data);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[PUT /api/especialistas/:slug]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { slug: string } }) {
  if (params.slug === "generico") {
    return NextResponse.json({ error: "Não é possível remover o especialista genérico." }, { status: 400 });
  }
  deleteEspecialista(params.slug);
  return NextResponse.json({ ok: true });
}
