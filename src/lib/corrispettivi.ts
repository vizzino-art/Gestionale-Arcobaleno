import { google } from "googleapis";
import { CAMPI_CORRISPETTIVI } from "@/lib/corrispettivi-campi";

// Punto 23 (20/9): logica condivisa dalle due route API della pagina
// "Corrispettivi" (leggi/salva) — legge/scrive direttamente nel foglio
// Google "2026 - Corrispettivi IVA 10%" (stesso foglio già letto in sola
// lettura da "Importa incassi" in Prima Nota, vedi
// src/app/api/importa-incassi/route.ts per il contesto generale sul
// perché le colonne vanno sempre cercate per intestazione, mai per
// lettera fissa: cambiano da un mese all'altro).
//
// Analizzando il file reale colonna per colonna (Gennaio/Aprile/Maggio/
// Agosto/Settembre) sono emerse due particolarità in più rispetto a
// "Importa incassi", risolte così:
//
// 1. "Numero" (chiusura registratore) e "ID" (trasmissione) sono le uniche
//    due colonne a POSIZIONE FISSA: sempre le colonne A e B, cioè sempre
//    due posizioni prima della colonna "Data" (che a sua volta è sempre
//    una posizione prima di "IMPONIBILE", come già noto). Solo la scheda
//    di Agosto scrive per esteso le due intestazioni di testo ("Numero"/
//    "ID"); negli altri mesi le celle di intestazione sono vuote ma i
//    valori ci sono comunque — quindi qui si usa la posizione, mai il
//    testo, per queste due colonne.
// 2. Le due colonne "Versamento" (etichettate con un numero di conto, es.
//    1318683, non con del testo) e la colonna "Contanti" da compilare a
//    mano (sotto il gruppo "PAGAMENTO", da non confondere con l'altra
//    "Contanti" calcolata sotto "INCASSO") si trovano allo stesso modo:
//    sempre le tre colonne subito prima di "CASSA", qualunque sia la sua
//    posizione quel mese. Non si può usare la riga di intestazione di
//    gruppo sopra ("VERSAMENTO") perché è una cella unita (merge) su due
//    colonne — l'API Google restituisce il testo solo nella prima delle
//    due, la seconda arriverebbe vuota.
export const MESI_SCHEDE = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

export function schedaPerData(dataIso: string): string {
  const mese = parseInt(dataIso.slice(5, 7), 10);
  return MESI_SCHEDE[mese - 1];
}

export function clientSheets() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim();
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return google.sheets({ version: "v4", auth: oauth2Client });
}

export function norm(v: unknown): string {
  return (v ?? "").toString().trim().toLowerCase();
}

export function euroToNumber(v: unknown): number | null {
  const s = (v ?? "").toString().trim();
  if (!s) return null;
  const pulito = s.replace(/[€\s]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(pulito);
  return isNaN(n) ? null : n;
}

// Accetta gg/mm/aa o gg/mm/aaaa; restituisce YYYY-MM-DD o null se la cella
// non è una data (righe di riepilogo/vuote in fondo alla scheda) — stessa
// funzione di importa-incassi/route.ts.
export function parseDataItaliana(v: unknown): string | null {
  const s = (v ?? "").toString().trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return null;
  const [, gg, mm, aaRaw] = m;
  const aa = aaRaw.length === 2 ? `20${aaRaw}` : aaRaw;
  const giorno = gg.padStart(2, "0");
  const mese = mm.padStart(2, "0");
  const iso = `${aa}-${mese}-${giorno}`;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return iso;
}

export function formattaDataItaliana(iso: string): string {
  const [aaaa, mm, gg] = iso.split("-");
  return `${gg}/${mm}/${aaaa}`;
}

// Converte un indice di colonna 0-based nella lettera A1 corrispondente
// (0->A, 25->Z, 26->AA, 27->AB, ...).
export function letteraColonna(indice0: number): string {
  let n = indice0 + 1;
  let s = "";
  while (n > 0) {
    const resto = (n - 1) % 26;
    s = String.fromCharCode(65 + resto) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// Intestazioni di testo da cercare nella riga di intestazione, per i campi
// che NON sono a posizione fissa (tutti tranne Numero/ID/Contanti
// pagamento/Versamento, vedi sopra). Il testo è già normalizzato
// (minuscolo, spazi ai lati tolti) per il confronto con norm().
const INTESTAZIONI_TESTO: Record<string, string> = {
  trasmesso: "trasmesso",
  differite: "differite",
  fatture: "fatture",
  non_riscosso: "non riscos.",
  bonifico: "bonifico",
  satispay: "satispay",
  eden: "eden",
  f24: "f24",
  sumup_lordo: "sumup",
  sumup_comm: "sumup - comm",
  acq_card_sumup: "acq. card sumump",
  mastercard: "mastercard+maestro",
  visa: "visa",
  bancomat: "bancomat",
};

export type ColonneTrovate = {
  rigaIntestazione: number; // indice 0-based della riga di intestazione (quella con "IMPONIBILE")
  colData: number;
  perCampo: Record<string, number | undefined>;
  etichetteVersamento: [string | null, string | null];
};

export function trovaColonne(righe: string[][]): { colonne: ColonneTrovate | null; errore?: string } {
  const rigaIntestazione = righe.findIndex((r) => r.some((cella) => norm(cella) === "imponibile"));
  if (rigaIntestazione === -1) {
    return { colonne: null, errore: 'Intestazione "IMPONIBILE" non trovata nel foglio' };
  }
  const intestazioni = righe[rigaIntestazione];

  const colImponibile = intestazioni.findIndex((c) => norm(c) === "imponibile");
  const colData = colImponibile - 1;
  const colId = colData - 2;
  const colNumero = colData - 3;
  if (colNumero < 0) {
    return { colonne: null, errore: "Colonne Numero/ID non individuabili" };
  }

  const colCassa = intestazioni.findIndex((c) => norm(c) === "cassa");
  if (colCassa === -1) {
    return { colonne: null, errore: 'Intestazione "CASSA" non trovata nel foglio' };
  }
  const colContantiPagamento = colCassa - 3;
  const colVersamento1 = colCassa - 2;
  const colVersamento2 = colCassa - 1;

  const perCampo: Record<string, number | undefined> = {
    numero_chiusura: colNumero,
    id_trasmissione: colId,
    contanti_pagamento: colContantiPagamento,
    versamento_1: colVersamento1,
    versamento_2: colVersamento2,
  };
  for (const [id, testo] of Object.entries(INTESTAZIONI_TESTO)) {
    const indice = intestazioni.findIndex((c) => norm(c) === testo);
    perCampo[id] = indice === -1 ? undefined : indice;
  }

  const etichetteVersamento: [string | null, string | null] = [
    intestazioni[colVersamento1] != null ? intestazioni[colVersamento1].toString().trim() : null,
    intestazioni[colVersamento2] != null ? intestazioni[colVersamento2].toString().trim() : null,
  ];

  return { colonne: { rigaIntestazione, colData, perCampo, etichetteVersamento } };
}

// Trova l'indice di riga (0-based, dentro l'array "righe" già letto) del
// giorno richiesto, cercando la data nella colonna colData a partire dalla
// riga subito dopo l'intestazione. -1 se non trovata (es. giorno fuori dal
// mese, o scheda dell'anno prossimo non ancora creata).
export function trovaRigaData(righe: string[][], colonne: ColonneTrovate, dataIso: string): number {
  for (let i = colonne.rigaIntestazione + 1; i < righe.length; i++) {
    if (parseDataItaliana(righe[i][colonne.colData]) === dataIso) {
      return i;
    }
  }
  return -1;
}

export { CAMPI_CORRISPETTIVI };
