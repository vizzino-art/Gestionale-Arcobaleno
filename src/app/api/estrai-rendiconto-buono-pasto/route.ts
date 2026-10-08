import { NextRequest, NextResponse } from "next/server";

// Route Handler server-side: legge un rendiconto/fattura di buoni pasto
// (Edenred e, in futuro, altri gestori come Satispay) e ne estrae i totali
// tramite l'API di Claude (vision) — stesso schema di /api/estrai-bolla,
// ma con un prompt molto più semplice: a differenza di una bolla qui non
// serve leggere riga per riga, solo i totali del documento (deciso con
// Mauro l'8/10: per il controllo in Buoni Pasto basta il totale, non il
// dettaglio taglio per taglio dei singoli ticket).

export const runtime = "nodejs";

const PROMPT_SISTEMA = `Sei un assistente che legge rendiconti/fatture di gestori di buoni pasto (es. Edenred, Satispay) — documenti che riepilogano un periodo di ticket raccolti da un'attività di ristorazione — da una foto o da un PDF, e ne estrae i dati in JSON.

Questi documenti hanno tipicamente: un numero di documento (es. "12EDEN" o un numero fattura), una data di emissione, un periodo di riferimento (dal/al), il numero totale di ticket raccolti, un importo lordo (il valore facciale totale dei ticket, es. "Totale Complessivo"), un importo netto che il gestore pagherà davvero dopo aver trattenuto la propria commissione (es. "Importo Scontato", spesso IVA incluso), e una data di pagamento/valuta prevista (quando i soldi arriveranno in banca).

Rispondi SOLO con un oggetto JSON valido, senza testo prima o dopo, in questo formato esatto:
{
  "numero_documento": "numero del documento cosi' come scritto, es. \\"12EDEN\\", o null se non leggibile",
  "data_documento": "data di emissione del documento in formato YYYY-MM-DD, o null",
  "periodo_da": "inizio del periodo di riferimento in formato YYYY-MM-DD, o null se non indicato",
  "periodo_a": "fine del periodo di riferimento in formato YYYY-MM-DD, o null se non indicato",
  "numero_ticket": 0,
  "totale_lordo": 0,
  "importo_netto": 0,
  "data_pagamento_prevista": "data in cui il pagamento e' previsto/valuta, in formato YYYY-MM-DD, o null se non indicata"
}

Regole importanti:
- Estrai SOLO i dati visibili nel documento, non inventare né arrotondare in modo creativo.
- "totale_lordo" è il valore facciale totale dei ticket (es. "Totale Complessivo"), PRIMA di qualsiasi commissione/sconto applicata dal gestore.
- "importo_netto" è l'importo che arriverà davvero in banca (dopo la commissione del gestore), es. la voce "Importo Scontato" o "Netto a pagare" — quello che poi confronteremo con il movimento in banca.
- Se il documento mostra sia un imponibile che un'IVA separati per l'importo netto, usa il totale IVA incluso (quello che arriva davvero sul conto).
- I numeri nel JSON vanno scritti col punto decimale (es. 254.00), anche se nel documento sono scritti con la virgola.
- Se un valore non è leggibile o non è presente nel documento, usa null per quel campo (0 solo se il documento mostra letteralmente 0).
- Se il documento non sembra un rendiconto/fattura di buoni pasto, rispondi con tutti i campi a null (numero_ticket, totale_lordo, importo_netto compresi).`;

type RispostaEstrazione = {
  numero_documento: string | null;
  data_documento: string | null;
  periodo_da: string | null;
  periodo_a: string | null;
  numero_ticket: number | null;
  totale_lordo: number | null;
  importo_netto: number | null;
  data_pagamento_prevista: string | null;
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { errore: "Chiave API Anthropic non configurata sul server (variabile ANTHROPIC_API_KEY mancante su Vercel)." },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  const immagineBase64: string | undefined = body?.immagine;
  const mediaType: string | undefined = body?.mediaType;

  if (!immagineBase64 || !mediaType) {
    return NextResponse.json({ errore: "Immagine mancante nella richiesta." }, { status: 400 });
  }

  try {
    const risposta = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: PROMPT_SISTEMA,
        messages: [
          {
            role: "user",
            content: [
              mediaType === "application/pdf"
                ? {
                    type: "document",
                    source: { type: "base64", media_type: mediaType, data: immagineBase64 },
                  }
                : {
                    type: "image",
                    source: { type: "base64", media_type: mediaType, data: immagineBase64 },
                  },
              {
                type: "text",
                text: "Estrai i dati da questo rendiconto di buoni pasto secondo le istruzioni del sistema.",
              },
            ],
          },
        ],
      }),
    });

    if (!risposta.ok) {
      const testo = await risposta.text();
      return NextResponse.json(
        { errore: `Errore dall'API Claude (${risposta.status}): ${testo.slice(0, 300)}` },
        { status: 502 }
      );
    }

    const dati = await risposta.json();
    const testoRisposta: string = dati?.content?.[0]?.text ?? "";

    let estratto: RispostaEstrazione;
    try {
      // Il modello a volte racchiude comunque il JSON in un blocco ```json — lo ripuliamo.
      const pulito = testoRisposta
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      estratto = JSON.parse(pulito);
    } catch {
      return NextResponse.json(
        {
          errore:
            "Non sono riuscito a interpretare la risposta. Se era una foto, riprova con un'inquadratura più chiara, a fuoco e con buona luce.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json(estratto);
  } catch (e) {
    return NextResponse.json(
      { errore: `Errore di rete verso l'API Claude: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 }
    );
  }
}
