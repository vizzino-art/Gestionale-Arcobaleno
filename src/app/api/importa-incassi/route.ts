import { NextResponse } from "next/server";
import { google, sheets_v4 } from "googleapis";
import { createClient } from "@/lib/supabase/server";
import { MESI, estraiMovimentiScheda } from "@/lib/importa-incassi";

// Punto 23 (18/9): "Importa incassi" in Prima Nota. Legge il foglio Google
// personale di Mauro "2026 - Corrispettivi IVA 10%" (una scheda per mese,
// Gennaio…Dicembre) e crea/aggiorna in movimenti_prima_nota un movimento
// per ogni incasso giornaliero diverso da zero: SumUp, Mastercard, Visa,
// Bancomat, Contanti.
//
// La logica di lettura scheda (colonne cercate per intestazione, non per
// lettera fissa, e le due particolarità del foglio: colonna data senza
// intestazione propria, e le due colonne "CONTANTI" da distinguere per
// gruppo) è condivisa con src/app/api/corrispettivi/salva/route.ts — vedi
// src/lib/importa-incassi.ts per tutti i dettagli e il perché.
export const runtime = "nodejs";

function clientSheets() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim();
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return google.sheets({ version: "v4", auth: oauth2Client });
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
