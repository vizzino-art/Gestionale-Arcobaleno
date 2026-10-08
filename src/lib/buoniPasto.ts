// Logica di abbinamento automatico tra un rendiconto di buoni pasto e un
// movimento di Prima Nota — stesso spirito di src/lib/bolle.ts (abbinamento
// automatico bolla ↔ fattura), ma qui il riferimento certo non è un numero
// di documento condiviso: è l'importo netto accreditato, che deve
// corrispondere quasi esattamente a un incasso reale in Prima Nota. Questa
// funzione è di sola lettura: non scrive mai né propone di scrivere in
// movimenti_prima_nota, serve solo a mostrare se un rendiconto risulta già
// incassato (vedi richiesta di Mauro dell'8/10: "può leggere i dati della
// prima nota ma non può sovrascrivere").

import type { RendicontoBuonoPasto } from "./types";

export type MovimentoMinimo = {
  id: string;
  data: string;
  causale: string;
  conto_id: string;
  importo: number;
};

// Tolleranza sull'importo: i centesimi devono corrispondere, ma lasciamo un
// filo di margine per eventuali arrotondamenti del gestore del buono pasto.
const TOLLERANZA_IMPORTO = 0.01;

export function trovaMovimentoAbbinato(
  rendiconto: RendicontoBuonoPasto,
  contoAttesoId: string | null,
  movimenti: MovimentoMinimo[]
): MovimentoMinimo | null {
  if (rendiconto.importo_netto == null) return null;

  const candidati = movimenti.filter((m) => {
    if (contoAttesoId && m.conto_id !== contoAttesoId) return false;
    return Math.abs(m.importo - rendiconto.importo_netto!) < TOLLERANZA_IMPORTO;
  });

  if (candidati.length === 0) return null;
  if (candidati.length === 1) return candidati[0];

  // Più movimenti con lo stesso importo (es. due rendiconti consecutivi per
  // caso identici): scegliamo quello con la data più vicina a quando il
  // pagamento era previsto, per non abbinare per sbaglio un incasso che in
  // realtà appartiene a un altro rendiconto.
  const riferimento = rendiconto.data_pagamento_prevista ?? rendiconto.data_documento;
  if (!riferimento) return candidati[0];

  const riferimentoMs = new Date(riferimento).getTime();
  let migliore = candidati[0];
  let distanzaMigliore = Math.abs(new Date(migliore.data).getTime() - riferimentoMs);
  for (const candidato of candidati.slice(1)) {
    const distanza = Math.abs(new Date(candidato.data).getTime() - riferimentoMs);
    if (distanza < distanzaMigliore) {
      migliore = candidato;
      distanzaMigliore = distanza;
    }
  }
  return migliore;
}
