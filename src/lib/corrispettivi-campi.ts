// Elenco dei campi della pagina "Corrispettivi" (punto 23, 20/9) — SOLO
// dati/etichette, nessuna dipendenza da googleapis: questo file viene
// importato sia dal componente client (il form) sia dalla logica server
// (src/lib/corrispettivi.ts), quindi deve restare "leggero" e senza nulla
// che giri solo su Node.
//
// Corrisponde esattamente ai campi inseriti a mano nel foglio Google
// "2026 - Corrispettivi IVA 10%" (verificato aprendo il file reale,
// colonna per colonna, mese per mese) — MAI una cella con formula, quelle
// restano calcolate dal foglio come sempre: IMPONIBILE, IVA, CONTROLLO,
// AGENZIA, TOTALE, CONTANTI (quella sotto "INCASSO"), CASSA, il progressivo
// di fine riga.
export type CampoCorrispettivo = {
  id: string;
  etichetta: string;
  tipo: "importo" | "intero";
};

export const CAMPI_CORRISPETTIVI: CampoCorrispettivo[] = [
  { id: "numero_chiusura", etichetta: "Numero chiusura registratore", tipo: "intero" },
  { id: "id_trasmissione", etichetta: "ID trasmissione", tipo: "intero" },
  { id: "trasmesso", etichetta: "Trasmesso", tipo: "importo" },
  { id: "differite", etichetta: "Differite", tipo: "importo" },
  { id: "fatture", etichetta: "Fatture", tipo: "importo" },
  { id: "non_riscosso", etichetta: "Non riscosso", tipo: "importo" },
  { id: "bonifico", etichetta: "Bonifico", tipo: "importo" },
  { id: "satispay", etichetta: "Satispay", tipo: "importo" },
  { id: "eden", etichetta: "Eden", tipo: "importo" },
  { id: "f24", etichetta: "F24", tipo: "importo" },
  { id: "sumup_lordo", etichetta: "SumUp (lordo)", tipo: "importo" },
  { id: "sumup_comm", etichetta: "SumUp - Commissioni", tipo: "importo" },
  { id: "acq_card_sumup", etichetta: "Acq. Card SumUp", tipo: "importo" },
  { id: "mastercard", etichetta: "Mastercard + Maestro", tipo: "importo" },
  { id: "visa", etichetta: "Visa", tipo: "importo" },
  { id: "bancomat", etichetta: "Bancomat", tipo: "importo" },
  { id: "contanti_pagamento", etichetta: "Contanti (pagamento)", tipo: "importo" },
  { id: "versamento_1", etichetta: "Versamento conto 1", tipo: "importo" },
  { id: "versamento_2", etichetta: "Versamento conto 2 (Mutuo)", tipo: "importo" },
];
