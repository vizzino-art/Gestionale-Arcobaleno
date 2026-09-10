// Logica pura di supporto alla gestione fornitori in Fornitori (modifica/aggiunta).
// Stesso criterio usato per i prodotti in Pannello (src/lib/prodotti.ts).

import type { Fornitore } from "./types";

/**
 * Valore "ordine" da assegnare a un fornitore appena creato: va in fondo
 * alla lista esistente (un riordino manuale resta comunque possibile in
 * futuro, come già avviene per i prodotti).
 */
export function prossimoOrdineFornitore(fornitori: Fornitore[]): number {
  if (fornitori.length === 0) return 0;
  return Math.max(...fornitori.map((f) => f.ordine)) + 1;
}
