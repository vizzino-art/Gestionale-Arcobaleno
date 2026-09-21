import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { leggiPermessi, puoVedere } from "@/lib/permessi";
import {
  CAMPI_CORRISPETTIVI,
  clientSheets,
  formattaDataItaliana,
  letteraColonna,
  schedaPerData,
  trovaColonne,
  trovaRigaData,
} from "@/lib/corrispettivi";

// Punto 23 (20/9): scrive i valori inseriti nel form Corrispettivi
// direttamente nelle celle giuste del foglio Google, senza mai toccare le
// celle con formula (non sono nemmeno nell'elenco CAMPI_CORRISPETTIVI), e
// aggiunge una riga al "Log Inserimenti" — stesso log già usato dalla
// vecchia webapp sull'iPad, mai sovrascritto, sempre in append.
export const runtime = "nodejs";

type CorpoRichiesta = {
  data?: string;
  valori?: Record<string, number | null>;
};

export async function POST(request: NextRequest) {
  const sheetId = process.env.GOOGLE_CORRISPETTIVI_SHEET_ID;
  if (!sheetId) {
    return NextResponse.json(
      { errore: "GOOGLE_CORRISPETTIVI_SHEET_ID non configurata su Vercel" },
      { status: 500 }
    );
  }
  if (!process.env.GOOGLE_OAUTH_REFRESH_TOKEN) {
    return NextResponse.json(
      { errore: "Permesso Google non configurato: visita /api/auth/google-drive/start da loggato" },
      { status: 500 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ errore: "Non autenticato" }, { status: 401 });
  }

  // Difesa in profondità (stesso principio già usato per la pagina Utenti):
  // il menu e il middleware già nascondono/bloccano questa pagina a chi non
  // ha accesso, ma prima di scrivere davvero sul foglio Google ricontrolliamo
  // qui, non ci si fida mai solo del client.
  const permessi = await leggiPermessi(supabase, user.id);
  if (!puoVedere(permessi, "corrispettivi")) {
    return NextResponse.json({ errore: "Non hai accesso a questa pagina" }, { status: 403 });
  }

  let corpo: CorpoRichiesta;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ errore: "Corpo della richiesta non valido" }, { status: 400 });
  }

  const dataIso = corpo.data;
  const valori = corpo.valori ?? {};
  if (!dataIso || !/^\d{4}-\d{2}-\d{2}$/.test(dataIso)) {
    return NextResponse.json({ errore: "Data mancante o non valida" }, { status: 400 });
  }

  const scheda = schedaPerData(dataIso);

  try {
    const sheets = clientSheets();
    const risposta = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `'${scheda}'!A1:AF400`,
      valueRenderOption: "FORMATTED_VALUE",
    });
    const righe = (risposta.data.values ?? []) as string[][];

    const { colonne, errore } = trovaColonne(righe);
    if (errore || !colonne) {
      return NextResponse.json({ errore: errore ?? "Colonne non trovate" }, { status: 500 });
    }

    const rigaTrovataIndex = trovaRigaData(righe, colonne, dataIso);
    if (rigaTrovataIndex === -1) {
      return NextResponse.json(
        { errore: `Data non trovata nella scheda "${scheda}"` },
        { status: 404 }
      );
    }
    const numeroRiga = rigaTrovataIndex + 1; // Google Sheets è 1-based

    const dati: { range: string; values: (string | number)[][] }[] = [];
    for (const campo of CAMPI_CORRISPETTIVI) {
      if (!(campo.id in valori)) continue; // campo non inviato dal client, non toccarlo
      const col = colonne.perCampo[campo.id];
      if (col === undefined) continue; // questa scheda non ha questa colonna (es. SumUp prima di aprile)
      const valore = valori[campo.id];
      dati.push({
        range: `'${scheda}'!${letteraColonna(col)}${numeroRiga}`,
        values: [[valore === null || valore === undefined ? "" : valore]],
      });
    }

    if (dati.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: { valueInputOption: "RAW", data: dati },
      });
    }

    const adesso = new Date();
    const timestamp = `${adesso.toLocaleDateString("it-IT", { timeZone: "Europe/Rome" })} ${adesso.toLocaleTimeString(
      "it-IT",
      { timeZone: "Europe/Rome" }
    )}`;
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: "'Log Inserimenti'!A:C",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[timestamp, formattaDataItaliana(dataIso), user.email ?? ""]] },
    });

    return NextResponse.json({ ok: true, scheda, riga: numeroRiga });
  } catch (e) {
    return NextResponse.json(
      { errore: e instanceof Error ? e.message : "Errore sconosciuto durante il salvataggio" },
      { status: 500 }
    );
  }
}
