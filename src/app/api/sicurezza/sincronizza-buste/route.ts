import { NextRequest, NextResponse } from "next/server";
import { createClient as createClientServizio } from "@supabase/supabase-js";
// Stesso import interno usato in api/leggi-buste-paga (bug noto di pdf-parse).
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { createClient } from "@/lib/supabase/server";
import { elencaCartella, scaricaFile, tokenDropbox } from "@/lib/dropbox";
import {
  LEGGI_DAL,
  leggiPaginaBusta,
  meseDaNomeFile,
  pianificaAggiornamenti,
  type DatiBusta,
  type PersonaEsistente,
  type TestoPdf,
} from "@/lib/sicurezza-buste";

// Modulo Sicurezza, passo 4 (15/11/2026): legge le buste paga nuove da
// Dropbox e aggiorna l'anagrafica dello scadenzario (sic_persone).
// - GET: chiamata ogni giorno da Vercel Cron (vedi vercel.json), autenticata
//   con CRON_SECRET come /api/backup-drive (per questo è in PUBLIC_PATHS).
// - POST: pulsante "Leggi buste paga ora" nella pagina Sicurezza, solo admin.
// Le scritture usano la Service Role (le tabelle sic_* hanno RLS "solo
// admin" e il cron non ha un utente loggato), mai esposta al browser.
export const runtime = "nodejs";
export const maxDuration = 60;

function clientServizio() {
  return createClientServizio(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

async function leggiPdf(buffer: Buffer): Promise<DatiBusta[]> {
  const pagine: TestoPdf[][] = [];
  await pdfParse(buffer, {
    pagerender: (pageData: {
      getTextContent: (o: { normalizeWhitespace: boolean; disableCombineTextItems: boolean }) => Promise<{
        items: { str: string; transform: number[] }[];
      }>;
    }) =>
      pageData
        .getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false })
        .then((tc) => {
          pagine.push(tc.items.map((i) => ({ s: i.str, x: i.transform[4], y: i.transform[5] })));
          return "";
        }),
  });
  return pagine.map((p, i) => leggiPaginaBusta(p, i + 1));
}

async function sincronizza() {
  const db = clientServizio();
  const radice = process.env.DROPBOX_CARTELLA_ARCOBALENO?.trim() || "/Arcobaleno";
  const token = await tokenDropbox();

  // Anno corrente e precedente: la busta di dicembre arriva a gennaio.
  const anno = Number(new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", year: "numeric" }).format(new Date()));
  const candidati: { percorso: string; hash: string | undefined; anno: number; mese: number; nome: string }[] = [];
  for (const a of [anno - 1, anno]) {
    const voci = await elencaCartella(token, `${radice}/Anno ${a}/Buste Paghe ${a}`);
    for (const v of voci) {
      if (v[".tag"] !== "file") continue;
      const periodo = meseDaNomeFile(v.name);
      if (!periodo) continue;
      if (periodo.anno * 12 + periodo.mese < LEGGI_DAL.anno * 12 + LEGGI_DAL.mese) continue;
      candidati.push({ percorso: v.path_display, hash: v.content_hash, ...periodo, nome: v.name });
    }
  }

  const { data: giaLette, error: errLette } = await db.from("sic_buste_lette").select("percorso, content_hash");
  if (errLette) throw new Error(errLette.message);
  const lette = new Map((giaLette ?? []).map((r) => [r.percorso, r.content_hash]));
  const daLeggere = candidati
    .filter((c) => !lette.has(c.percorso) || (c.hash && lette.get(c.percorso) !== c.hash))
    .sort((a, b) => a.anno - b.anno || a.mese - b.mese || a.nome.localeCompare(b.nome));

  const risultati: { file: string; dipendenti: number; nuovi: string[]; aggiornati: string[]; avvisi: string[] }[] = [];

  for (const f of daLeggere) {
    const buste = await leggiPdf(await scaricaFile(token, f.percorso));
    const avvisi = buste.map((b) => b.avviso).filter((a): a is string => !!a);

    const { data: persone, error: errPersone } = await db
      .from("sic_persone")
      .select("id, tipo, cognome, nome, codice_busta, mansione, data_assunzione, data_cessazione, fine_contratto");
    if (errPersone) throw new Error(errPersone.message);

    const operazioni = pianificaAggiornamenti((persone ?? []) as PersonaEsistente[], buste);
    const nuovi: string[] = [];
    const aggiornati: string[] = [];
    for (const op of operazioni) {
      if (op.tipo === "nuovo") {
        const { error } = await db.from("sic_persone").insert({ ...op.campi, tipo: "dipendente", origine: "busta_paga" });
        if (error) throw new Error(error.message);
        nuovi.push(`${op.campi.cognome} ${op.campi.nome}`);
      } else {
        const { error } = await db
          .from("sic_persone")
          .update({ ...op.campi, updated_at: new Date().toISOString() })
          .eq("id", op.id);
        if (error) throw new Error(error.message);
        aggiornati.push(`${op.nome} (${Object.keys(op.campi).join(", ")})`);
      }
    }

    const { error: errReg } = await db.from("sic_buste_lette").upsert(
      {
        percorso: f.percorso,
        content_hash: f.hash ?? null,
        anno: f.anno,
        mese: f.mese,
        dipendenti: buste.filter((b) => b.codice).length,
        nuovi: nuovi.length,
        aggiornati: aggiornati.length,
        avvisi: avvisi.length ? avvisi.join("\n") : null,
        letta_il: new Date().toISOString(),
      },
      { onConflict: "percorso" }
    );
    if (errReg) throw new Error(errReg.message);

    risultati.push({ file: f.nome, dipendenti: buste.length, nuovi, aggiornati, avvisi });
  }

  return { fileTrovati: candidati.length, fileLetti: risultati.length, risultati };
}

// Vercel Cron
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ errore: "Non autorizzato" }, { status: 401 });
  }
  try {
    return NextResponse.json(await sincronizza());
  } catch (e) {
    return NextResponse.json({ errore: e instanceof Error ? e.message : "Errore" }, { status: 500 });
  }
}

// Pulsante nella pagina (solo amministratori)
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ errore: "Non autenticato" }, { status: 401 });
  const { data: profilo } = await supabase
    .from("profili_utente")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profilo?.is_admin) {
    return NextResponse.json({ errore: "Riservato agli amministratori." }, { status: 403 });
  }
  try {
    return NextResponse.json(await sincronizza());
  } catch (e) {
    return NextResponse.json({ errore: e instanceof Error ? e.message : "Errore" }, { status: 500 });
  }
}
