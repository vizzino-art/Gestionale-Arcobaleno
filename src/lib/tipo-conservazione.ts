// Fresco / Gelo / Ambiente: colora il blocco "Magazzino" in Ordina come un
// riquadro a sé, staccato dal blocco prodotto (colorato per categoria, vedi
// colori-categorie.ts) — due blocchi affiancati, non un'etichetta colorata
// dentro la riga, per evitare che i due colori si mischino. Colori scelti
// apposta diversi dalla tavolozza categorie (rosso/arancio/ambra/lime/
// smeraldo/tiglio/cielo/viola/fucsia/rosa) per restare distinguibili.

export type TipoConservazione = "fresco" | "gelo" | "ambiente";

export const ETICHETTE_TIPO_CONSERVAZIONE: Record<TipoConservazione, string> = {
  fresco: "Fresco",
  gelo: "Gelo",
  ambiente: "Ambiente",
};

// Classi di sfondo/bordo del riquadro Magazzino per ciascun tipo, usate sia
// per il blocco pieno in Ordina sia per i pulsanti di scelta in Pannello.
export const COLORI_TIPO_CONSERVAZIONE: Record<TipoConservazione, string> = {
  fresco: "bg-green-200 border-green-500",
  gelo: "bg-blue-200 border-blue-500",
  ambiente: "bg-stone-200 border-stone-500",
};

// Blocco Magazzino in Ordina: un prodotto senza tipo scelto resta su un
// grigio neutro (comunque un blocco pieno, non solo un bordo) così i due
// blocchi restano visivamente separati anche prima di classificare tutto.
export function classeRiquadroMagazzino(tipo: TipoConservazione | null | undefined): string {
  if (!tipo) return "bg-neutral-100 border-neutral-300";
  return COLORI_TIPO_CONSERVAZIONE[tipo];
}
