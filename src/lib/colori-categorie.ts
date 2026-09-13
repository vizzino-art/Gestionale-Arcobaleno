// Tavolozza di colori pastello scelti da Mauro per ogni categoria (bottone
// "🎨 Colori categorie" in Pannello). Usata anche in Ordina e Riepilogo per
// colorare le righe in modo coerente con la categoria del prodotto, invece
// che con la sola posizione nell'elenco.
export const PALETTE_COLORI_CATEGORIA: string[] = [
  "bg-red-100",
  "bg-orange-100",
  "bg-amber-100",
  "bg-lime-100",
  "bg-emerald-100",
  "bg-teal-100",
  "bg-sky-100",
  "bg-violet-100",
  "bg-fuchsia-100",
  "bg-rose-100",
];

// Mappa categoria_id -> classe colore, solo per le categorie a cui Mauro ha
// assegnato un colore (le altre restano `undefined`: chi la usa applica la
// stessa alternanza automatica di sempre come ripiego).
export function mappaColoriCategorie(
  categorie: { id: string; colore: string | null }[]
): Map<string, string> {
  const mappa = new Map<string, string>();
  for (const c of categorie) {
    if (c.colore) mappa.set(c.id, c.colore);
  }
  return mappa;
}
