import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { leggiPermessi, puoVedere } from "@/lib/permessi";
import {
  CAMPI_CORRISPETTIVI,
  clientSheets,
  euroToNumber,
  schedaPerData,
  trovaColonne,
  trovaRigaData,
} from "@/lib/corrispettivi";

// Punto 23 (20/9): legge i valori già presenti per un giorno, per
// precompilare il form di Corrispettivi invece di farlo scrivere alla
// cieca — vedi src/lib/corrispettivi.ts per come si individuano scheda,
// riga e colonne.
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
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
  const permessi = await leggiPermessi(supabase, user.id);
  if (!puoVedere(permessi, "corrispettivi")) {
    return NextResponse.json({ errore: "Non hai accesso a questa pagina" }, { status: 403 });
  }

  const dataIso = request.nextUrl.searchParams.get("data");
  if (!dataIso || !/^\d{4}-\d{2}-\d{2}$/.test(dataIso)) {
    return NextResponse.json({ errore: "Parametro data mancante o non valido" }, { status: 400 });
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
    const riga = righe[rigaTrovataIndex];

    const valori: Record<string, number | null> = {};
    for (const campo of CAMPI_CORRISPETTIVI) {
      const col = colonne.perCampo[campo.id];
      if (col === undefined) {
        valori[campo.id] = null;
        continue;
      }
      const grezzo = riga[col];
      valori[campo.id] =
        campo.tipo === "intero"
          ? grezzo
            ? parseInt(grezzo.toString().replace(/\D/g, ""), 10) || null
            : null
          : euroToNumber(grezzo);
    }

    return NextResponse.json({
      scheda,
      valori,
      etichetteVersamento: colonne.etichetteVersamento,
      campiDisponibili: CAMPI_CORRISPETTIVI.filter((c) => colonne.perCampo[c.id] !== undefined).map(
        (c) => c.id
      ),
    });
  } catch (e) {
    return NextResponse.json(
      { errore: e instanceof Error ? e.message : "Errore sconosciuto durante la lettura" },
      { status: 500 }
    );
  }
}
