// Logica pura di supporto alla gestione prodotti in Pannello (modifica/aggiunta).
// Nessuna dipendenza da Supabase, per poterla testare facilmente.

import type { Prodotto } from "./types";

/**
 * Prezzo netto dopo sconti a cascata: listino -> sconto1 -> sconto2 -> sconto3.
 * Rispecchia esattamente il trigger `calcola_prezzo_unitario` nel database,
 * così l'anteprima nel form di modifica corrisponde a quello che verrà
 * salvato (il DB resta comunque l'unica fonte di verità, questo serve solo
 * a mostrare il risultato mentre si digita, prima di salvare).
 */
export function calcolaPrezzoNetto(
  prezzoListino: number | null,
  sconto1: number | null,
  sconto2: number | null,
  sconto3: number | null
): number {
  const listino = prezzoListino ?? 0;
  const s1 = sconto1 ?? 0;
  const s2 = sconto2 ?? 0;
  const s3 = sconto3 ?? 0;
  return listino * (1 - s1 / 100) * (1 - s2 / 100) * (1 - s3 / 100);
}

/**
 * Valore "ordine" da assegnare a un prodotto appena creato per un fornitore:
 * va in fondo alla lista esistente (un ulteriore riordino con le frecce ▲▼
 * è comunque sempre possibile).
 */
export function prossimoOrdine(prodottiFornitore: Prodotto[]): number {
  if (prodottiFornitore.length === 0) return 0;
  return Math.max(...prodottiFornitore.map((p) => p.ordine)) + 1;
}
