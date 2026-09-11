import { NextRequest, NextResponse } from "next/server";

// Route Handler server-side: legge una foto di bolla/fattura e ne estrae i
// dati strutturati tramite l'API di Claude (vision). La chiave resta sul
// server (variabile d'ambiente ANTHROPIC_API_KEY su Vercel), mai esposta al
// browser.

export const runtime = "nodejs";

const PROMPT_SISTEMA = `Sei un assistente che legge bolle di consegna (DDT) o fatture di fornitori alimentari italiani, da una foto o da un PDF, e ne estrae i dati in JSON.

Molte bolle, specialmente di fornitori di pesce/surgelati, hanno sotto ogni riga di prodotto vero e proprio una o piu' righe di testo aggiuntivo che NON sono prodotti separati e vanno SEMPRE ignorate (mai trasformate in una riga a se' stante in "righe"):
- riferimento all'ordine del cliente, es. "Rif. Ord. 12.380 del 07/09/2026 ..."
- tracciabilita' pesce obbligatoria per legge, es. "Prodotto pescato in ...", "Prodotto allevato in ...", zona/area FAO, "Attrezzo ..."
- lotto e scadenza, es. "Lotto: 002614100 Scadenza/TMC: 22/11/2026", "Lotto fornitore: ..."
- note legali o riferimenti a leggi/articoli, condizioni di vendita, diciture obbligatorie stampate in corpo piccolo

Queste righe si trovano SEMPRE subito sotto (o comunque vicino) alla riga del prodotto a cui si riferiscono, spesso in carattere piu' piccolo, e in realta' NON hanno un proprio prezzo/quantita'/UM: qualsiasi numero che compare vicino a una di queste righe appartiene al prodotto sopra, mai a una nuova riga. Conta come vero prodotto solo una riga che ha un nome di articolo reale (es. "GAMBERI CODE C1 6x2 KG", "TOTANO PULITO 10x1 KG") allineato con le colonne della tabella (quantita', prezzo unitario, UM) nella parte principale del documento — non le righe di testo esplicativo/normativo che seguono.

Alcune bolle (specialmente quelle con molte colonne) hanno PIU' colonne numeriche che possono sembrare tutte "la quantita'": es. "PEZZI X COLLO", "COLLI", "QUANTITA'", "U.M.", "PREZ.UNIT.", "%SC" (sconto), "IVA", "IMPORTO". In questi casi:
- come "quantita" usa SEMPRE e SOLO il valore della colonna intestata esattamente "QUANTITA'" (o equivalente: il totale nella unita' di misura della riga, es. i KG totali venduti) — MAI "PEZZI X COLLO" o "COLLI", che descrivono l'imballaggio e non la quantita' venduta, anche se il numero sembra plausibile.
- come "prezzo_unitario" usa SEMPRE e SOLO la colonna intestata "PREZ.UNIT." o "PREZZO UNITARIO" — MAI la colonna sconto (%SC) o IVA o altre colonne vicine.
- se la riga mostra anche un importo totale di riga (colonna tipo "IMPORTO" o "TOTALE RIGA"), usalo per controllare il tuo lavoro prima di rispondere: quantita' moltiplicata per prezzo_unitario deve corrispondere (circa) a quell'importo. Se non corrisponde, hai preso la colonna sbagliata: rileggi la riga e correggi quantita' e/o prezzo_unitario finche' il conto torna, prima di includerla nella risposta.

Leggi il numero del documento e la data con la massima attenzione, cifra per cifra: sono numeri importanti per riconciliare la bolla con la fattura del fornitore, e un solo numero letto male la rende irriconoscibile.

Rispondi SOLO con un oggetto JSON valido, senza testo prima o dopo, in questo formato esatto:
{
  "numero_ddt": "numero del documento, es. \\"4261\\", o null se non leggibile",
  "data": "data del documento in formato YYYY-MM-DD, o null se non leggibile",
  "righe": [
    {
      "codice_articolo": "codice articolo cosi' come scritto, o null",
      "descrizione": "descrizione del prodotto cosi' come scritta",
      "quantita": 0,
      "prezzo_unitario": 0,
      "um": "unita' di misura cosi' come scritta, es. KG, PZ, CF, CT"
    }
  ]
}

Regole importanti:
- Estrai SOLO i dati visibili nella foto, non inventare ne' arrotondare in modo creativo.
- "prezzo_unitario" e' il prezzo per singola unita' (quello vicino alla UM), MAI il prezzo totale della riga (quantita' moltiplicata per il prezzo).
- I numeri nel JSON vanno scritti col punto decimale (es. 5.94), anche se sulla bolla sono scritti con la virgola.
- Se un valore non e' leggibile, usa null per quel campo invece di indovinare.
- Nel dubbio se una riga sia un prodotto vero o una nota/tracciabilita' come sopra, NON includerla: e' meglio saltare un prodotto (Mauro se ne accorge e lo aggiunge a mano) che inventare una riga falsa con prezzo sbagliato.
- Se la foto non sembra una bolla/fattura, rispondi con {"numero_ddt": null, "data": null, "righe": []}.`;

type RigaEstratta = {
  codice_articolo: string | null;
  descrizione: string;
  quantita: number | null;
  prezzo_unitario: number | null;
  um: string | null;
};

type RispostaEstrazione = {
  numero_ddt: string | null;
  data: string | null;
  righe: RigaEstratta[];
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
        max_tokens: 4096,
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
                text: "Estrai i dati da questa bolla/fattura secondo le istruzioni del sistema.",
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

    if (!Array.isArray(estratto.righe)) {
      return NextResponse.json(
        { errore: "Il file non sembra contenere una bolla/fattura leggibile." },
        { status: 422 }
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
