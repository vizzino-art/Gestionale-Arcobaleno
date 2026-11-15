// Logica pura per l'ordine Frutta e Verdura (15/11, portata dalla pagina
// HTML a sé stante che Mauro e suo padre usavano prima di questa
// integrazione) — nessuna dipendenza da Supabase qui dentro, solo tipi e
// funzioni testabili, stesso stile di src/lib/ordina.ts.

export type UnitaFV = "kg" | "cassa" | "pz" | "mazzo";

// Stessa forma dei dati salvati prima in localStorage dalla pagina
// originale — ora è il contenuto condiviso (vedi tabella
// bozza_frutta_verdura) invece che separato per telefono.
export type BozzaFruttaVerdura = {
  qty: Record<string, number>;
  unit: Record<string, UnitaFV>;
  extra: string[];
  note: string;
};

export const BOZZA_VUOTA: BozzaFruttaVerdura = { qty: {}, unit: {}, extra: [], note: "" };

// Numero del fornitore per il link WhatsApp — fisso qui come nella pagina
// originale; se cambia basta modificare questa riga (nessun record
// fornitore su Supabase per questo, a differenza degli altri fornitori).
export const TELEFONO_FORNITORE_FV = "39336376672";

export const UNITA_FV: UnitaFV[] = ["kg", "cassa", "pz", "mazzo"];

// Liste fisse, stesso identico ordine della pagina originale. Per
// aggiungere/togliere un prodotto dalla lista fissa serve modificare
// queste due righe (nessuna gestione da Pannello, per restare semplice).
export const VERDURA_FV = [
  "Asparagi",
  "Carote",
  "Ciliegino",
  "Cipolle",
  "Gentile",
  "Limoni",
  "Melanzane",
  "Patate",
  "Peperoni gialli",
  "Peperoni rossi",
  "Prezzemolo",
  "Radicchio",
  "Radicchio TV",
  "Ramato",
  "Rucola",
  "Sedano",
  "Zucchine",
];

export const FRUTTA_FV = ["Ananas", "Ciliegie", "Kiwi", "Meloni", "Pesche", "Uva"];

export function tuttiINomiFV(bozza: BozzaFruttaVerdura): string[] {
  return VERDURA_FV.concat(FRUTTA_FV, bozza.extra);
}

export function formattaQuantitaFV(n: number): string {
  return String(Math.round(n * 10) / 10).replace(".", ",");
}

export function parseQuantitaFV(v: string): number {
  const n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) || n < 0 ? 0 : n;
}

export function costruisciMessaggioFV(bozza: BozzaFruttaVerdura, oggi: Date = new Date()): string {
  const righe = tuttiINomiFV(bozza)
    .filter((n) => (bozza.qty[n] || 0) > 0)
    .map((n) => `- ${n}: ${formattaQuantitaFV(bozza.qty[n])} ${bozza.unit[n] || "kg"}`);
  if (righe.length === 0) return "";

  const giorniSettimana = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
  let messaggio =
    `Ordine Pizzeria Arcobaleno – ${giorniSettimana[oggi.getDay()]} ${oggi.getDate()}/${oggi.getMonth() + 1}\n\n` +
    righe.join("\n");
  if (bozza.note.trim()) messaggio += `\n\nNote: ${bozza.note.trim()}`;
  return messaggio + "\n\nGrazie!";
}

export function linkWhatsAppFV(messaggio: string): string {
  return `https://wa.me/${TELEFONO_FORNITORE_FV}?text=${encodeURIComponent(messaggio)}`;
}
