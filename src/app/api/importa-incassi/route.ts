import { NextResponse } from "next/server";
import { google, sheets_v4 } from "googleapis";
import { createClient } from "@/lib/supabase/server";

// Punto 23 (18/9): "Importa incassi" in Prima Nota. Legge il foglio Google
// personale di Mauro "2026 - Corrispettivi IVA 10%" (una scheda per mese,
// Gennaio…Dicembre) e crea/aggiorna in movimenti_prima_nota un movimento
// per ogni incasso giornaliero diverso da zero: SumUp, Mastercard, Visa,
// Bancomat, Contanti.
//
// ⚠️ IMPORTANTE — le colonne del foglio NON sono le stesse in tutti i mesi:
// verificato l'18/9 confrontando Gennaio/Aprile/Agosto colonna per colonna.
// Gennaio-Marzo non hanno affatto SumUp; da Aprile è stata aggiunta la
// coppia "SumUp"/"SumUp - Comm"; da Maggio anche "Acq. Card SumUmp" — ogni
// colonna successiva scivola quindi di una posizione da un mese all'altro.
// Per questo NON usiamo lettere di colonna fisse: cerchiamo ogni colonna
// per il testo della sua intestazione, scheda per scheda.
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
export const runtime = "nodejs";

const MESI = [
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
const DATA_INIZIO_IMPORT_AUTOMATICO = "2026-09-19";

// Le 5 colonne da importare: intestazione da cercare nella riga di
// intestazione della scheda, causale e conto Prima Nota di destinazione
// (concordati con Mauro il 18/9). "richiedeIncasso" si applica solo a
// CONTANTI, per prendere quella sotto "INCASSO" e non quella sotto
// "PAGAMENTO".
const COLONNE_INCASSO: {
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

function norm(v: unknown): string {
  return (v ?? "").toString().trim().toLowerCase();
}

function euroToNumber(v: unknown): number {
  const s = (v ?? "").toString().trim();
  if (!s) return 0;
  const pulito = s.replace(/[€\s]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(pulito);
  return isNaN(n) ? 0 : n;
}

// Accetta gg/mm/aa o gg/mm/aaaa; restituisce YYYY-MM-DD o null se la cella
// non è una data (righe di riepilogo/vuote in fondo alla scheda).
function parseDataItaliana(v: unknown): string | null {
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

function formattaDataPuntata(iso: string): string {
  const [aaaa, mm, gg] = iso.split("-");
  return `${gg}.${mm}.${aaaa.slice(2)}`;
}

function clientSheets() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim();
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return google.sheets({ version: "v4", auth: oauth2Client });
}

type MovimentoDaScrivere = {
  chiave_incasso: string;
  data: string;
  causale: string;
  conto_id: string;
  importo: number;
  stato: "effettivo";
};

// Analizza una scheda (le righe grezze A1:AF400) e restituisce i movimenti
// da importare. Trova le colonne cercando i testi di intestazione, non per
// lettera fissa — vedi commento in cima al file.
function estraiMovimentiScheda(
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
      const importo = euroToNumber(riga[col.indice]);
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

export async function POST() {
  const sheetId = process.env.GOOGLE_CORRISPETTIVI_SHEET_ID;
  if (!sheetId) {
    return NextResponse.json(
      { errore: "GOOGLE_CORRISPETTIVI_SHEET_ID non configurata su Vercel" },
      { status: 500 }
    );
  }
  if (!process.env.GOOGLE_OAUTH_REFRESH_TOKEN) {
    return NextResponse.json(
      {
        errore:
          "Permesso Google non configurato: visita /api/auth/google-drive/start da loggato per autorizzare anche la lettura dei fogli",
      },
      { status: 500 }
    );
  }

  try {
    const supabase = await createClient();
    const { data: conti, error: erroreConti } = await supabase.from("conti").select("id, nome");
    if (erroreConti || !conti) {
      return NextResponse.json(
        { errore: erroreConti?.message ?? "Impossibile leggere i conti di Prima Nota" },
        { status: 500 }
      );
    }
    const contoIdPerNome = (nome: string) =>
      conti.find((c) => c.nome.toLowerCase() === nome.toLowerCase())?.id;

    const sheets = clientSheets();

    const metadati = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
      fields: "sheets.properties.title",
    });
    const schede = (metadati.data.sheets ?? [])
      .map((s: sheets_v4.Schema$Sheet) => s.properties?.title ?? "")
      .filter((titolo) => MESI.includes(titolo.trim().toLowerCase()));

    const risultati: { scheda: string; movimenti: number; errore?: string }[] = [];
    let totaleMovimenti = 0;

    for (const scheda of schede) {
      try {
        const risposta = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: `'${scheda}'!A1:AF400`,
          valueRenderOption: "FORMATTED_VALUE",
        });
        const righe = (risposta.data.values ?? []) as string[][];

        const { movimenti, errore } = estraiMovimentiScheda(righe, contoIdPerNome);
        if (errore) {
          risultati.push({ scheda, movimenti: 0, errore });
          continue;
        }

        if (movimenti.length > 0) {
          const { error: erroreUpsert } = await supabase
            .from("movimenti_prima_nota")
            .upsert(movimenti, { onConflict: "chiave_incasso" });
          if (erroreUpsert) {
            risultati.push({ scheda, movimenti: 0, errore: erroreUpsert.message });
            continue;
          }
        }
        risultati.push({ scheda, movimenti: movimenti.length });
        totaleMovimenti += movimenti.length;
      } catch (e) {
        risultati.push({
          scheda,
          movimenti: 0,
          errore: e instanceof Error ? e.message : "errore sconosciuto",
        });
      }
    }

    const fallite = risultati.filter((r) => r.errore);
    return NextResponse.json(
      { totaleMovimenti, risultati },
      { status: fallite.length > 0 ? 207 : 200 }
    );
  } catch (e) {
    return NextResponse.json(
      { errore: e instanceof Error ? e.message : "Errore sconosciuto durante l'importazione" },
      { status: 500 }
    );
  }
}
