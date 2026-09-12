import { NextRequest, NextResponse } from "next/server";
import { parsaFatturaElettronica } from "@/lib/fattura-elettronica";

// Route Handler server-side: legge un file di fattura elettronica (XML o
// P7M) caricato da Mauro ed estrae i dati direttamente dai campi del
// tracciato FatturaPA — lettura esatta, non serve l'IA come per le bolle
// fotografate (qui i dati sono già scritti nei campi giusti dal software del
// fornitore).

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const contenutoBase64: string | undefined = body?.contenuto;
  const nomeFile: string | undefined = body?.nomeFile;

  if (!contenutoBase64 || !nomeFile) {
    return NextResponse.json({ errore: "File mancante nella richiesta." }, { status: 400 });
  }

  if (!/\.(xml|xml\.p7m)$/i.test(nomeFile)) {
    return NextResponse.json(
      { errore: "Formato non riconosciuto: carica un file .xml o .xml.p7m." },
      { status: 400 }
    );
  }

  try {
    const buffer = Buffer.from(contenutoBase64, "base64");
    const fattura = parsaFatturaElettronica(buffer, nomeFile);

    if (!fattura.numero || !fattura.data) {
      return NextResponse.json(
        {
          errore:
            "Il file è stato letto ma mancano numero o data fattura: probabilmente non è una fattura elettronica FatturaPA valida.",
        },
        { status: 422 }
      );
    }

    return NextResponse.json(fattura);
  } catch (e) {
    return NextResponse.json(
      {
        errore: `Non sono riuscito a leggere il file: ${
          e instanceof Error ? e.message : String(e)
        }`,
      },
      { status: 422 }
    );
  }
}
