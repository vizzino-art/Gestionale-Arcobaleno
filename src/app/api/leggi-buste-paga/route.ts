import { NextRequest, NextResponse } from "next/server";
// Importato dal percorso interno "lib/pdf-parse.js" e non da "pdf-parse"
// stesso: l'index.js del pacchetto contiene un blocco di auto-test che gira
// al solo require() quando "module.parent" è vuoto (succede nel bundle di
// Next.js) e prova a leggere un PDF di esempio che non esiste in
// produzione, facendo fallire la build ("ENOENT ... 05-versions-space.pdf")
// — bug noto del pacchetto, bypassato così senza perdere nulla.
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { estraiBustePaga } from "@/lib/buste-paga";

// Route Handler server-side: legge il PDF con tutte le buste paga del mese
// (una pagina per dipendente, sempre lo stesso software/layout) ed estrae
// nome, periodo e netto a pagare direttamente dal testo del PDF — vedi
// src/lib/buste-paga.ts per i dettagli ed il perché nessuna IA è
// necessaria qui.

export const runtime = "nodejs";

// pdf-parse di default incolla senza spazio le parole di una stessa riga
// (vedi node_modules/pdf-parse/lib/pdf-parse.js, render_page): per le
// nostre ricerche nel testo serve uno spazio fra le parole, quindi lo
// personalizziamo. Le pagine restano comunque separate da "\n\n" dalla
// libreria stessa.
function renderPaginaConSpazi(pageData: {
  getTextContent: (opts: { normalizeWhitespace: boolean; disableCombineTextItems: boolean }) => Promise<{
    items: { str: string; transform: number[] }[];
  }>;
}) {
  return pageData
    .getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false })
    .then((textContent) => {
      let ultimaY: number | undefined;
      let testo = "";
      for (const item of textContent.items) {
        if (ultimaY === item.transform[5] || ultimaY === undefined) {
          testo += (testo ? " " : "") + item.str;
        } else {
          testo += "\n" + item.str;
        }
        ultimaY = item.transform[5];
      }
      return testo;
    });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const contenutoBase64: string | undefined = body?.contenuto;
  const nomeFile: string | undefined = body?.nomeFile;

  if (!contenutoBase64 || !nomeFile) {
    return NextResponse.json({ errore: "File mancante nella richiesta." }, { status: 400 });
  }

  if (!/\.pdf$/i.test(nomeFile)) {
    return NextResponse.json({ errore: "Carica un file .pdf." }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(contenutoBase64, "base64");
    const dati = await pdfParse(buffer, { pagerender: renderPaginaConSpazi });
    const paginesTesto = dati.text
      .split(/\n\n+/)
      .map((p: string) => p.trim())
      .filter(Boolean);

    if (paginesTesto.length === 0) {
      return NextResponse.json(
        { errore: "Il PDF è stato letto ma risulta vuoto: controlla che sia il file giusto." },
        { status: 422 }
      );
    }

    const righe = estraiBustePaga(paginesTesto);
    return NextResponse.json({ righe });
  } catch (e) {
    return NextResponse.json(
      { errore: e instanceof Error ? e.message : "Errore nella lettura del PDF." },
      { status: 500 }
    );
  }
}
