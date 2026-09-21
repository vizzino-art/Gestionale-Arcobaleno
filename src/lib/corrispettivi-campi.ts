// Elenco dei campi della pagina "Corrispettivi" (punto 23, 20-21/9) — SOLO
// dati/etichette, nessuna dipendenza da googleapis: questo file viene
// importato sia dal componente client (il form) sia dalla logica server
// (src/lib/corrispettivi.ts), quindi deve restare "leggero" e senza nulla
// che giri solo su Node.
//
// Corrisponde esattamente ai campi inseriti a mano nel foglio Google
// "2026 - Corrispettivi IVA 10%" (verificato aprendo il file reale,
// colonna per colonna, mese per mese) — MAI una cella con formula, tranne
// "cassa" che è mostrata di proposito in sola lettura (richiesto da Mauro
// il 21/9 per un controllo visivo, resta comunque calcolata dal foglio,
// mai scritta da qui: vedi soloLettura più sotto e il controllo
// corrispondente in src/app/api/corrispettivi/salva/route.ts).
//
// "colore"/"badge"/"emoji"/"icona"/"logo" sono pure indicazioni grafiche
// (punto 23, 21/9, richieste da Mauro dopo aver visto la pagina la prima
// volta). "icona" indica un logo vettoriale con licenza sicura (Mastercard/
// Visa, da "Simple Icons", CC0) — il componente si sceglie in base a questo
// valore in CorrispettiviClient.tsx (vedi src/components/icone-pagamento.tsx).
// "logo" indica un'immagine (PNG ritagliata dagli screenshot dei loghi
// ufficiali che Mauro ha caricato in chat il 21/9, salvata in
// public/loghi-pagamento/) mostrata con un tag <img>. Per "f24" il logo non
// è quello ufficiale dell'Agenzia delle Entrate (che incorpora lo stemma
// della Repubblica Italiana, vincoli d'uso diversi da un marchio aziendale,
// evitato di proposito) ma un'iconcina neutra mandata da Mauro apposta al
// suo posto. "badge" è rimasto solo per i pochissimi campi senza logo/icona
// disponibile.
export type CampoCorrispettivo = {
  id: string;
  etichetta: string;
  tipo: "importo" | "intero";
  soloLettura?: boolean;
  colore?: "verde" | "rosso";
  badge?: { testo: string; classe: string };
  icona?: "mastercard" | "visa";
  logo?: string;
  emoji?: string;
};

export const CAMPI_CORRISPETTIVI: CampoCorrispettivo[] = [
  { id: "numero_chiusura", etichetta: "Numero chiusura registratore", tipo: "intero" },
  { id: "id_trasmissione", etichetta: "ID trasmissione", tipo: "intero" },
  { id: "trasmesso", etichetta: "Trasmesso", tipo: "importo", colore: "verde" },
  { id: "differite", etichetta: "Differite", tipo: "importo" },
  { id: "fatture", etichetta: "Fatture", tipo: "importo" },
  { id: "non_riscosso", etichetta: "Non riscosso", tipo: "importo", colore: "rosso" },
  { id: "bonifico", etichetta: "Bonifico", tipo: "importo" },
  {
    id: "satispay",
    etichetta: "Satispay",
    tipo: "importo",
    logo: "/loghi-pagamento/satispay.png",
  },
  {
    id: "eden",
    etichetta: "Eden (Edenred)",
    tipo: "importo",
    logo: "/loghi-pagamento/edenred.png",
  },
  {
    id: "f24",
    etichetta: "F24",
    tipo: "importo",
    logo: "/loghi-pagamento/agenzia-entrate.png",
  },
  {
    id: "sumup_lordo",
    etichetta: "SumUp (lordo)",
    tipo: "importo",
    logo: "/loghi-pagamento/sumup.png",
  },
  { id: "sumup_comm", etichetta: "SumUp - Commissioni", tipo: "importo" },
  { id: "acq_card_sumup", etichetta: "Acq. Card SumUp", tipo: "importo" },
  {
    // Etichetta accorciata su richiesta esplicita di Mauro il 21/9 ("attenzione
    // mastercard che si disallinea, eventualmente scrivi solo Master+Maestro"),
    // insieme al passaggio dal badge di testo al logo ufficiale vero.
    id: "mastercard",
    etichetta: "Master+Maestro",
    tipo: "importo",
    icona: "mastercard",
  },
  {
    id: "visa",
    etichetta: "Visa",
    tipo: "importo",
    icona: "visa",
  },
  {
    id: "bancomat",
    etichetta: "Bancomat",
    tipo: "importo",
    logo: "/loghi-pagamento/bancomat.png",
  },
  { id: "contanti_pagamento", etichetta: "Contanti (pagamento)", tipo: "importo", emoji: "💶" },
  {
    id: "versamento_1",
    etichetta: "Versamento conto 1",
    tipo: "importo",
    logo: "/loghi-pagamento/volksbank.png",
  },
  {
    id: "versamento_2",
    etichetta: "Versamento conto 2 (Mutuo)",
    tipo: "importo",
    logo: "/loghi-pagamento/volksbank.png",
  },
  { id: "cassa", etichetta: "Cassa", tipo: "importo", soloLettura: true, emoji: "🧮" },
];
