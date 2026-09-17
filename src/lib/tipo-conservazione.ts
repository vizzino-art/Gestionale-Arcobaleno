// Fresco / Gelo / Ambiente: colora solo il riquadro "Magazzino" in Ordina,
// indipendentemente dal colore di riga per categoria (vedi colori-categorie.ts).
// Colori scelti apposta diversi dalla tavolozza categorie (rosso/arancio/ambra/
// lime/smeraldo/tiglio/cielo/viola/fucsia/rosa) per restare distinguibili anche
// quando il riquadro si trova sopra una riga già colorata.

export type TipoConservazione = "fresco" | "gelo" | "ambiente";

export const ETICHETTE_TIPO_CONSERVAZIONE: Record<TipoConservazione, string> = {
  fresco: "Fresco",
  gelo: "Gelo",
  ambiente: "Ambiente",
};

// Classi di sfondo/bordo del riquadro Magazzino per ciascun tipo. Un
// prodotto senza tipo scelto resta col bordo neutro di sempre (nessuna
// classe extra).
export const COLORI_TIPO_CONSERVAZIONE: Record<TipoConservazione, string> = {
  fresco: "bg-green-200 border-green-500",
  gelo: "bg-blue-200 border-blue-500",
  ambiente: "bg-stone-200 border-stone-500",
};

export function classeRiquadroMagazzino(tipo: TipoConservazione | null | undefined): string {
  if (!tipo) return "border-neutral-300";
  return COLORI_TIPO_CONSERVAZIONE[tipo];
}
