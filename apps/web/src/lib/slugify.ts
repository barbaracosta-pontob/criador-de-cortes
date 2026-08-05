/**
 * Gera um slug estavel a partir de um texto livre (ex: nome do especialista).
 * Puro (sem I/O) para poder ser usado tanto no client (formulario) quanto no
 * server (API/db). Ex: "Dra. Denise Carvalho" -> "dra-denise-carvalho".
 */
export function slugify(input: string): string {
  return (input ?? "")
    .normalize("NFD") // separa acentos dos caracteres base
    .replace(/[\u0300-\u036f]/g, "") // remove os acentos (marcas combinantes)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // qualquer coisa nao-alfanumerica vira hifen
    .replace(/-{2,}/g, "-") // colapsa hifens repetidos
    .replace(/^-+|-+$/g, ""); // tira hifens das pontas
}
