/**
 * GET  /api/especialistas — lista todos (exceto generico e internos).
 * POST /api/especialistas — cria novo especialista.
 */

import { NextRequest, NextResponse } from "next/server";
import { listEspecialistas, saveEspecialista, uniqueSlugFrom, type EspecialistaRow } from "@/lib/db";

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

    // O identificador (slug) é gerado automaticamente a partir do nome — o
    // usuário não precisa informá-lo. uniqueSlugFrom remove acentos/símbolos e
    // desambigua nomes repetidos ("dra-ana", "dra-ana-2"…). Se o nome não
    // gerar nenhum caractere válido, aí sim é erro de input.
    const slug = uniqueSlugFrom(body.nome ?? "");
    if (!slug) {
      return NextResponse.json(
        { error: "Informe um nome válido para o especialista." },
        { status: 400 },
      );
    }

    const data: EspecialistaRow = {
      slug,
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
