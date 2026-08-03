/**
 * GET  /api/especialistas — lista todos (exceto generico e internos).
 * POST /api/especialistas — cria novo especialista.
 */

import { NextRequest, NextResponse } from "next/server";
import { listEspecialistas, saveEspecialista, especialistaExists, type EspecialistaRow } from "@/lib/db";

export async function GET() {
  try {
    return NextResponse.json(listEspecialistas());
  } catch (err) {
    console.error("[GET /api/especialistas]", err);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.slug || !/^[a-z0-9-]+$/.test(body.slug)) {
      return NextResponse.json(
        { error: "Slug inválido. Use apenas letras minúsculas, números e hífen." },
        { status: 400 },
      );
    }
    if (body.slug === "generico" || body.slug.startsWith("_")) {
      return NextResponse.json({ error: "Esse slug é reservado pelo sistema." }, { status: 400 });
    }
    if (especialistaExists(body.slug)) {
      return NextResponse.json({ error: "Já existe um especialista com esse slug." }, { status: 409 });
    }

    const data: EspecialistaRow = {
      slug: body.slug,
      nome: body.nome ?? "",
      cargo: body.cargo ?? "",
      nicho: body.nicho ?? "",
      publico_alvo: body.publico_alvo ?? "",
      tom_de_voz: body.tom_de_voz ?? "",
      objetivo: body.objetivo ?? "",
      vocabulario: body.vocabulario ?? "",
      brief_padrao: body.brief_padrao ?? "",
    };

    saveEspecialista(data);
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("[POST /api/especialistas]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
