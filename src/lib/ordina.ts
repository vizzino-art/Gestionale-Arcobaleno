// Logica di composizione ordine: conversione in unità di confezione,
// calcolo omaggi, data di consegna, messaggio WhatsApp.
// Funzioni pure, senza dipendenze da Supabase, per poterle testare facilmente.

import type { Prodotto } from "./types";

export type RigaOrdine = {
  prodotto: Prodotto;
  fabbisogno: number; // in unità base (um), obiettivo - magazzino, mai negativo
  quantitaOrdine: number; // quantità da ordinare (pagata), nell'unità mostrata
  quantitaOmaggio: number; // quantità in più ricevuta gratis, stessa unità
  unitaMostrata: string; // um_confezione se presente, altrimenti um
};

/**
 * Calcola cosa ordinare per un prodotto dato obiettivo/magazzino/omaggi.
 * Ritorna null se non c'è fabbisogno (magazzino già sufficiente) o dati insufficienti.
 */
export function calcolaOrdine(prodotto: Prodotto): RigaOrdine | null {
  const obiettivo = prodotto.quantita_obiettivo ?? 0;
  const magazzino = prodotto.magazzino_attuale ?? 0;
  const fabbisogno = Math.max(obiettivo - magazzino, 0);

  if (fabbisogno <= 0) return null;

  const unitaMostrata = prodotto.um_confezione || prodotto.um || "";

  // Passo 1: se c'è una vera conversione in confezioni (es. PZ -> CT),
  // arrotonda sempre per eccesso (mai ordinare meno di quanto serve).
  // Se il prodotto si ordina già nella sua unità finale (es. KG, CS),
  // lascia il fabbisogno com'è, decimali compresi.
  let necessario = fabbisogno;
  if (prodotto.pezzi_per_confezione && prodotto.pezzi_per_confezione > 0) {
    necessario = Math.ceil(fabbisogno / prodotto.pezzi_per_confezione);
  }

  // Passo 2: se c'è un accordo omaggio ("ogni X ordinate, Y gratis"),
  // sfrutta al massimo i blocchi completi per minimizzare quanto si paga,
  // e paga a prezzo pieno solo il resto che non completa un blocco.
  const ogni = prodotto.omaggio_ogni ?? 0;
  const gratis = prodotto.omaggio_gratis ?? 0;

  if (ogni > 0 && gratis > 0) {
    const blocco = ogni + gratis;
    const blocchiCompleti = Math.floor(necessario / blocco);
    const resto = necessario - blocchiCompleti * blocco;
    const quantitaOrdine = blocchiCompleti * ogni + resto;
    const quantitaOmaggio = blocchiCompleti * gratis;
    return { prodotto, fabbisogno, quantitaOrdine, quantitaOmaggio, unitaMostrata };
  }

  return { prodotto, fabbisogno, quantitaOrdine: necessario, quantitaOmaggio: 0, unitaMostrata };
}

const GIORNI_NOME = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];

/**
 * Prossima data di consegna per un fornitore, dato giorno_consegna (1=lunedì...7=domenica).
 * Sempre nel futuro, mai la data di oggi stessa.
 */
export function prossimaConsegna(giornoConsegna: number, oggi: Date = new Date()): Date {
  const targetJs = giornoConsegna === 7 ? 0 : giornoConsegna; // JS: 0=domenica
  const d = new Date(oggi);
  d.setHours(0, 0, 0, 0);
  let diff = (targetJs - d.getDay() + 7) % 7;
  if (diff === 0) diff = 7; // mai oggi stesso
  d.setDate(d.getDate() + diff);
  return d;
}

export function formattaDataBreve(d: Date): string {
  return `${GIORNI_NOME[d.getDay()]} ${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;
}

/**
 * Testo del messaggio WhatsApp per l'ordine a un fornitore.
 * Formato "quantità UM descrizione", senza codice articolo.
 */
export function formattaMessaggioWhatsApp(
  fornitoreNome: string,
  giornoConsegna: number | null,
  righe: RigaOrdine[]
): string {
  const intestazione = giornoConsegna
    ? `Ordine ${fornitoreNome} - consegna ${formattaDataBreve(prossimaConsegna(giornoConsegna))}`
    : `Ordine ${fornitoreNome}`;

  const corpo = righe
    .map((r) => {
      const base = `${r.quantitaOrdine} ${r.unitaMostrata} ${r.prodotto.descrizione}`;
      return r.quantitaOmaggio > 0 ? `${base} (+${r.quantitaOmaggio} omaggio)` : base;
    })
    .join("\n");

  return `${intestazione}\n\n${corpo}`;
}

/**
 * Normalizza un numero di telefono italiano per un link wa.me
 * (aggiunge il prefisso internazionale 39 se manca).
 */
export function numeroWhatsApp(telefono: string): string {
  const cifre = telefono.replace(/\D/g, "");
  if (cifre.startsWith("39")) return cifre;
  return `39${cifre}`;
}

export function linkWhatsApp(telefono: string, testo: string): string {
  return `https://wa.me/${numeroWhatsApp(telefono)}?text=${encodeURIComponent(testo)}`;
}
