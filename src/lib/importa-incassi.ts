// Logica condivisa per leggere gli incassi giornalieri dal foglio Google
// "2026 - Corrispettivi IVA 10%" e trasformarli in movimenti di Prima Nota.
//
// Estratta il 22/9 da src/app/api/importa-incassi/route.ts (il bottone
// "Importa incassi" di Prima Nota, che rilegge TUTTO il foglio, tutti i
// mesi) perché ora la stessa identica logica serve anche a
// src/app/api/corrispettivi/salva/route.ts, per sincronizzare in automatico
// Prima Nota subito dopo che Mauro salva la pagina Corrispettivi, senza
// dover premere "Importa incassi" a parte (richiesto da Mauro il 22/9).
// Tenerla in un solo posto evita che le due strade prendano scorciatoie
// diverse e finiscano per leggere gli incassi in modo leggermente diverso.
//
// ⚠️ IMPORTANTE — le colonne del foglio NON sono le stesse in tutti i mesi:
// verificato il 18/9 confrontando Gennaio/Aprile/Agosto colonna per
// colonna. Gennaio-Marzo non hanno affatto SumUp; da Aprile è stata
// aggiunta la coppia "SumUp"/"SumUp - Comm"; da Maggio anche "Acq. Card
// SumUmp" — ogni colonna successiva scivola quindi di una posizione da un
// mese all'altro. Per questo NON usiamo lettere di colonna fisse: cerchiamo
// ogni colonna per il testo della sua intestazione, scheda per scheda.
//
// C'è anche un'ambiguità reale nel foglio: esistono DUE colonne adiacenti
// intestate entrambe "CONTANTI". Controllando la riga sopra (l'intestazione
// "di gruppo"), una è sotto "INCASSO" (il contante incassato quel giorno —
// quello che vogliamo) e l'altra sotto "PAGAMENTO" (contante speso, tutt'altra
// cosa — confermato da Mauro il 18/9). Distinguiamo le due proprio guardando
// quella riga sopra, mai la sola scritta "CONTANTI".
//
// La colonna della data non ha una sua intestazione di testo (è sempre una
// cella vuota nella riga delle intestazioni), ma è sempre la colonna
// immediatamente a sinistra di "IMPONIBILE" — verificato vero sia a Gennaio
// che ad Agosto nonostante le altre differenze.

export const MESI = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

// Da gennaio al 18/9/2026 gli incassi giornalieri erano già stati scritti a
// mano da Mauro nel vecchio Excel Prima Nota, e sono quindi già dentro
// all'importazione storica del 17/9 (punto 23) — importarli di nuovo da qui
// creerebbe doppioni (successo il 19/9, corretto cancellando le righe con
// chiave_incasso). Da questa data in poi Mauro non scrive più a mano:
// "Importa incassi" è l'unica fonte, quindi si può ripremere il bottone
// tutte le volte che si vuole (gli incassi da questa data in poi si
// aggiornano via chiave_incasso invece di duplicarsi), ma va sempre
// ignorato tutto ciò che è precedente a questa soglia fissa.
export const DATA_INIZIO_IMPORT_AUTOMATICO = "2026-09-19";

// Le 5 colonne da importare: intestazione da cercare nella riga di
// intestazione della scheda, causale e conto Prima Nota di destinazione
// (concordati con Mauro il 18/9). "richiedeGruppo" si applica solo a
// CONTANTI, per prendere quella sotto "INCASSO" e non quella sotto
// "PAGAMENTO".
export const COLONNE_INCASSO: {
  tipo: string;
  intestazione: string;
  richiedeGruppo?: string;
  causale: string;
  conto: string;
}[] = [
  { tipo: "sumup", intestazione: "sumup - comm", causale: "Incasso SumUp", conto: "Sumup" },
  { tipo: "mastercard", intestazione: "mastercard+maestro", causale: "Incasso Mastercard", conto: "Trento" },
  { tipo: "visa", intestazione: "visa", causale: "Incasso Visa", conto: "Trento" },
  { tipo: "bancomat", intestazione: "bancomat", causale: "Incasso Bancomat", conto: "Trento" },
  {
    tipo: "contanti",
    intestazione: "contanti",
    richiedeGruppo: "incasso",
    causale: "Incasso Del Giorno",
    conto: "Cassa",
  },
];

export function norm(v: unknown): string {
  return (v ?? "").toString().trim().toLowerCase();
}

export function euroToNumero(v: unknown): number {
  const s = (v ?? "").toString().trim();
  if (!s) return 0;
  const pulito = s.replace(/[€\s]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(pulito);
  return isNaN(n) ? 0 : n;
}

// Accetta gg/mm/aa o gg/mm/aaaa; restituisce YYYY-MM-DD o null se la cella
// non è una data (righe di riepilogo/vuote in fondo alla scheda).
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

export function formattaDataPuntata(iso: string): string {
  const [aaaa, mm, gg] = iso.split("-");
  return `${gg}.${mm}.${aaaa.slice(2)}`;
}

export type MovimentoDaScrivere = {
  chiave_incasso: string;
  data: string;
  causale: string;
  conto_id: string;
  importo: number;
  stato: "effettivo";
  // Presente solo per i movimenti generati come trasferimento fra due
  // conti (es. i versamenti Cassa -> banca creati da corrispettivi/salva):
  // collega le due righe come fa già il trasferimento inserito a mano in
  // Prima Nota (PrimaNotaClient.tsx), così "Elimina" cancella entrambe le
  // righe insieme e l'interfaccia le mostra con l'etichetta "trasferimento".
  trasferimento_id?: string;
};

// Analizza una scheda (le righe grezze A1:AF400) e restituisce i movimenti
// da importare. Trova le colonne cercando i testi di intestazione, non per
// lettera fissa — vedi commento in cima al file.
export function estraiMovimentiScheda(
  righe: string[][],
  contoIdPerNome: (nome: string) => string | undefined
): { movimenti: MovimentoDaScrivere[]; errore?: string } {
  const rigaImponibile = righe.findIndex((r) => r.some((cella) => norm(cella) === "imponibile"));
  if (rigaImponibile === -1) {
    return { movimenti: [], errore: 'intestazione "IMPONIBILE" non trovata' };
  }
  const intestazioni = righe[rigaImponibile];
  const intestazioniGruppo = rigaImponibile > 0 ? righe[rigaImponibile - 1] : [];

  const colImponibile = intestazioni.findIndex((c) => norm(c) === "imponibile");
  const colData = colImponibile - 1;
  if (colData < 0) {
    return { movimenti: [], errore: "colonna data non individuabile" };
  }

  const colonneTrovate: { indice: number; tipo: string; causale: string; conto: string }[] = [];
  for (const col of COLONNE_INCASSO) {
    const indice = intestazioni.findIndex((c, i) => {
      if (norm(c) !== col.intestazione) return false;
      if (col.richiedeGruppo) {
        return norm(intestazioniGruppo[i]) === col.richiedeGruppo;
      }
      return true;
    });
    // Non tutte le schede hanno tutte le colonne (es. Gennaio-Marzo non
    // hanno SumUp): semplicemente non generiamo movimenti di quel tipo per
    // quella scheda, non è un errore.
    if (indice !== -1) {
      const contoId = contoIdPerNome(col.conto);
      if (!contoId) {
        return { movimenti: [], errore: `conto "${col.conto}" non trovato in Prima Nota` };
      }
      colonneTrovate.push({ indice, tipo: col.tipo, causale: col.causale, conto: col.conto });
    }
  }

  const movimenti: MovimentoDaScrivere[] = [];
  for (let i = rigaImponibile + 1; i < righe.length; i++) {
    const riga = righe[i];
    const dataIso = parseDataItaliana(riga[colData]);
    if (!dataIso) continue; // riga vuota, di riepilogo o non ancora compilata
    if (dataIso < DATA_INIZIO_IMPORT_AUTOMATICO) continue; // già coperto dallo storico, mai reimportare

    for (const col of colonneTrovate) {
      const importo = euroToNumero(riga[col.indice]);
      if (importo === 0) continue;
      movimenti.push({
        chiave_incasso: `incasso-${col.tipo}-${dataIso}`,
        data: dataIso,
        causale: `${col.causale} del ${formattaDataPuntata(dataIso)}`,
        conto_id: contoIdPerNome(col.conto)!,
        importo,
        stato: "effettivo",
      });
    }
  }

  return { movimenti };
}
