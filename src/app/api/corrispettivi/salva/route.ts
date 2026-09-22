import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
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
import { estraiMovimentiScheda, type MovimentoDaScrivere } from "@/lib/importa-incassi";

// Punto 23 (20/9): scrive i valori inseriti nel form Corrispettivi
// direttamente nelle celle giuste del foglio Google, senza mai toccare le
// celle con formula (non sono nemmeno nell'elenco CAMPI_CORRISPETTIVI), e
// aggiunge una riga al "Log Inserimenti" — stesso log già usato dalla
// vecchia webapp sull'iPad, mai sovrascritto, sempre in append.
//
// Punto 23 (22/9): dopo aver salvato sul foglio, sincronizza in automatico
// anche Prima Nota, senza che Mauro debba più premere "Importa incassi" a
// parte — cose diverse:
// - Incassi (SumUp, Mastercard, Visa, Bancomat, Contanti dell'INCASSO):
//   stessa identica logica di "Importa incassi" (src/lib/importa-incassi.ts,
//   condivisa apposta per non rischiare di leggerli in modo diverso), solo
//   applicata subito e limitata al giorno appena salvato invece che
//   rileggendo tutto il foglio ogni volta.
// - Versamenti (Volksbank/Mutuo): creano un trasferimento Cassa → banca in
//   Prima Nota, così la Cassa lì resta allineata da sola (prima andava
//   registrato a mano ogni volta, causa di uno scarto scoperto il 22/9).
// - "Contanti (pagamento)" NON genera nessun movimento: è contante che
//   resta fisicamente in cassa, non esce da nessuna parte — l'incasso del
//   giorno lo conta già una volta sola tramite l'import qui sopra.
// Se questa sincronizzazione fallisce, il salvataggio sul foglio Google
// (la fonte di verità) resta comunque valido: si segnala solo un "avviso"
// nella risposta, non si trasforma in un errore che farebbe credere a
// Mauro che il salvataggio non sia andato a buon fine.
export const runtime = "nodejs";

const CONTO_VERSAMENTO: Record<string, string> = {
  versamento_1: "Volksbank",
  versamento_2: "Mutuo",
};

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
      if (campo.soloLettura) continue; // es. "Cassa": mostrata ma mai scrivibile, è una formula
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

    // Da qui in poi, se qualcosa va storto, il salvataggio sul foglio (già
    // fatto sopra) resta comunque valido: si raccoglie solo un avviso da
    // restituire, non si fa fallire la richiesta.
    let avvisoPrimaNota: string | undefined;
    try {
      const { data: conti, error: erroreConti } = await supabase.from("conti").select("id, nome");
      if (erroreConti || !conti) {
        throw new Error(erroreConti?.message ?? "impossibile leggere i conti di Prima Nota");
      }
      const contoIdPerNome = (nome: string) =>
        conti.find((c) => c.nome.toLowerCase() === nome.toLowerCase())?.id;

      // Incassi (SumUp/Mastercard/Visa/Bancomat/Contanti): rilegge la
      // scheda appena scritta (i valori formattati potrebbero differire da
      // come li ha mandati il client, es. separatori) e riusa la stessa
      // funzione di "Importa incassi", limitata al solo giorno di oggi.
      const rilettura = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `'${scheda}'!A1:AF400`,
        valueRenderOption: "FORMATTED_VALUE",
      });
      const righeAggiornate = (rilettura.data.values ?? []) as string[][];
      const { movimenti: movimentiIncasso, errore: erroreIncasso } = estraiMovimentiScheda(
        righeAggiornate,
        contoIdPerNome
      );
      if (erroreIncasso) throw new Error(erroreIncasso);

      const movimentiDaScrivere: MovimentoDaScrivere[] = movimentiIncasso.filter(
        (m) => m.data === dataIso
      );

      // Versamenti: trasferimento Cassa -> conto di destinazione, usando i
      // valori appena inviati dal client (già numeri puliti, non serve
      // rileggerli dal foglio). La causale del conto 1 usa il numero di
      // conto vero letto dall'intestazione del foglio (colonne.
      // etichetteVersamento, calcolata a inizio funzione), come fa già il
      // form in CorrispettiviClient.tsx — il conto 2 resta "Mutuo" fisso,
      // stessa scelta già fatta lì su richiesta di Mauro il 21/9.
      const contoCassaId = contoIdPerNome("Cassa");
      const etichetteCausale: Record<string, string> = {
        versamento_1: colonne.etichetteVersamento[0]
          ? `Versamento Volksbank ${colonne.etichetteVersamento[0]}`
          : "Versamento Volksbank",
        versamento_2: "Versamento Volksbank (Mutuo)",
      };
      for (const [campoId, contoNome] of Object.entries(CONTO_VERSAMENTO)) {
        const valore = valori[campoId];
        if (!valore || valore === 0) continue; // niente versamento quel giorno, non creiamo nulla
        const contoDestinazioneId = contoIdPerNome(contoNome);
        if (!contoCassaId || !contoDestinazioneId) continue; // conto non trovato, salta senza bloccare il resto
        const trasferimentoId = randomUUID();
        const causale = `${etichetteCausale[campoId]} del ${formattaDataItaliana(dataIso)}`;
        movimentiDaScrivere.push(
          {
            chiave_incasso: `${campoId}-uscita-${dataIso}`,
            data: dataIso,
            causale,
            conto_id: contoCassaId,
            importo: -valore,
            stato: "effettivo",
            trasferimento_id: trasferimentoId,
          },
          {
            chiave_incasso: `${campoId}-entrata-${dataIso}`,
            data: dataIso,
            causale,
            conto_id: contoDestinazioneId,
            importo: valore,
            stato: "effettivo",
            trasferimento_id: trasferimentoId,
          }
        );
      }

      if (movimentiDaScrivere.length > 0) {
        const { error: erroreUpsert } = await supabase
          .from("movimenti_prima_nota")
          .upsert(movimentiDaScrivere, { onConflict: "chiave_incasso" });
        if (erroreUpsert) throw new Error(erroreUpsert.message);
      }
    } catch (e) {
      avvisoPrimaNota =
        "Salvato sul foglio, ma la sincronizzazione con Prima Nota non è riuscita: " +
        (e instanceof Error ? e.message : "errore sconosciuto") +
        ". Puoi comunque premere \"Importa incassi\" in Prima Nota per recuperare gli incassi (i versamenti vanno registrati a mano).";
    }

    return NextResponse.json({ ok: true, scheda, riga: numeroRiga, avvisoPrimaNota });
  } catch (e) {
    return NextResponse.json(
      { errore: e instanceof Error ? e.message : "Errore sconosciuto durante il salvataggio" },
      { status: 500 }
    );
  }
}
