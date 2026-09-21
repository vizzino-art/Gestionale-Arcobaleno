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
// "colore"/"badge"/"emoji" sono pure indicazioni grafiche (punto 23, 21/9,
// richieste da Mauro dopo aver visto la pagina la prima volta) — badge sono
// piccole etichette colorate scritte a mano (non i loghi ufficiali veri e
// propri, per restare autonomi da file/icone esterne da scaricare e
// mantenere), pensate solo per riconoscere il metodo di pagamento a colpo
// d'occhio, con il colore indicativo del marchio.
export type CampoCorrispettivo = {
  id: string;
  etichetta: string;
  tipo: "importo" | "intero";
  soloLettura?: boolean;
  colore?: "verde" | "rosso";
  badge?: { testo: string; classe: string };
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
    badge: { testo: "Satispay", classe: "bg-[#F2445B] text-white" },
  },
  {
    id: "eden",
    etichetta: "Eden (Edenred)",
    tipo: "importo",
    badge: { testo: "Edenred", classe: "bg-[#FF6600] text-white" },
  },
  {
    id: "f24",
    etichetta: "F24",
    tipo: "importo",
    badge: { testo: "Agenzia Entrate", classe: "bg-slate-700 text-white" },
  },
  {
    id: "sumup_lordo",
    etichetta: "SumUp (lordo)",
    tipo: "importo",
    badge: { testo: "SumUp", classe: "bg-[#00C2B2] text-neutral-900" },
  },
  { id: "sumup_comm", etichetta: "SumUp - Commissioni", tipo: "importo" },
  { id: "acq_card_sumup", etichetta: "Acq. Card SumUp", tipo: "importo" },
  {
    id: "mastercard",
    etichetta: "Mastercard + Maestro",
    tipo: "importo",
    badge: { testo: "Mastercard", classe: "bg-[#EB001B] text-white" },
  },
  {
    id: "visa",
    etichetta: "Visa",
    tipo: "importo",
    badge: { testo: "VISA", classe: "bg-[#1A1F71] text-white" },
  },
  {
    id: "bancomat",
    etichetta: "Bancomat",
    tipo: "importo",
    badge: { testo: "Bancomat", classe: "bg-blue-900 text-white" },
  },
  { id: "contanti_pagamento", etichetta: "Contanti (pagamento)", tipo: "importo", emoji: "💶" },
  {
    id: "versamento_1",
    etichetta: "Versamento conto 1",
    tipo: "importo",
    badge: { testo: "Volksbank", classe: "bg-blue-900 text-white" },
  },
  {
    id: "versamento_2",
    etichetta: "Versamento conto 2 (Mutuo)",
    tipo: "importo",
    badge: { testo: "Volksbank", classe: "bg-blue-900 text-white" },
  },
  { id: "cassa", etichetta: "Cassa", tipo: "importo", soloLettura: true, emoji: "🧮" },
];
