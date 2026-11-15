import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Modulo Sicurezza, passo 5 (15/11/2026): registrazioni a mano dalla pagina
// (visite, corsi anche di gruppo, nuovo assunto / dati persona) e loro
// modifica o cancellazione.
// Usa il client con la sessione dell'utente: le tabelle sic_* hanno RLS
// "solo admin", quindi è il database stesso a rifiutare chi non è admin.
// Il controllo qui sotto serve solo a dare un messaggio chiaro.
export const runtime = "nodejs";

type Corpo = Record<string, unknown>;

const TIPI_VISITA = ["preventiva", "periodica", "su_richiesta", "rientro"];
const GIUDIZI = ["idoneo", "idoneo_con_prescrizioni", "non_idoneo_temporaneo", "non_idoneo_permanente"];

function testo(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

function data(v: unknown, campo: string): string | null {
  const t = testo(v);
  if (t === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) throw new Error(`Data non valida: ${campo}`);
  return t;
}

function numero(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  if (!Number.isFinite(n) || n < 0) throw new Error("Numero di ore non valido");
  return n;
}

function obbligatorio<T>(v: T | null, campo: string): T {
  if (v === null) throw new Error(`Manca: ${campo}`);
  return v;
}

export async function POST(request: NextRequest) {
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
    return NextResponse.json({ errore: "Solo un amministratore può modificare lo scadenzario." }, { status: 403 });
  }

  let corpo: Corpo;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ errore: "Richiesta non valida" }, { status: 400 });
  }

  try {
    const azione = corpo.azione;
    const id = testo(corpo.id);

    // ---------------- VISITE ----------------
    if (azione === "salva_visita") {
      const tipo = testo(corpo.tipo) ?? "periodica";
      if (!TIPI_VISITA.includes(tipo)) throw new Error("Tipo di visita non valido");
      const giudizio = testo(corpo.giudizio);
      if (giudizio && !GIUDIZI.includes(giudizio)) throw new Error("Giudizio non valido");
      const campi = {
        tipo,
        data_visita: obbligatorio(data(corpo.data_visita, "data visita"), "data della visita"),
        giudizio,
        prossima_scadenza: data(corpo.prossima_scadenza, "prossima scadenza"),
        note: testo(corpo.note),
      };
      const q = id
        ? supabase.from("sic_visite").update(campi).eq("id", id)
        : supabase.from("sic_visite").insert({ ...campi, persona_id: obbligatorio(testo(corpo.persona_id), "persona") });
      const { error } = await q;
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }

    if (azione === "elimina_visita") {
      const { error } = await supabase.from("sic_visite").delete().eq("id", obbligatorio(id, "id"));
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }

    // ---------------- CORSI (anche di gruppo) ----------------
    if (azione === "salva_formazione") {
      const stato = testo(corpo.stato) === "in_corso" ? "in_corso" : "completato";
      const campi = {
        corso_id: obbligatorio(testo(corpo.corso_id), "corso"),
        stato,
        data_corso: data(corpo.data_corso, "data corso"),
        // Vuota = calcolata dall'app (data corso + validità del corso).
        scadenza: data(corpo.scadenza, "scadenza"),
        ente: testo(corpo.ente),
        ore: numero(corpo.ore),
        attestato_path: testo(corpo.attestato_path),
        note: testo(corpo.note),
      };
      if (stato === "completato" && !campi.data_corso) throw new Error("Manca: data del corso");

      if (id) {
        const { error } = await supabase.from("sic_formazioni").update(campi).eq("id", id);
        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true, inseriti: 0 });
      }
      const persone = Array.isArray(corpo.persona_ids)
        ? corpo.persona_ids.filter((x): x is string => typeof x === "string" && x !== "")
        : [];
      if (persone.length === 0) throw new Error("Scegli almeno una persona");
      const { error } = await supabase
        .from("sic_formazioni")
        .insert(persone.map((persona_id) => ({ ...campi, persona_id })));
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, inseriti: persone.length });
    }

    if (azione === "elimina_formazione") {
      const { error } = await supabase.from("sic_formazioni").delete().eq("id", obbligatorio(id, "id"));
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }

    // ---------------- PERSONE (nuovo assunto / modifica dati e incarichi) ----------------
    if (azione === "salva_persona") {
      const campi = {
        tipo: testo(corpo.tipo) === "socio_titolare" ? "socio_titolare" : "dipendente",
        cognome: obbligatorio(testo(corpo.cognome), "cognome"),
        nome: obbligatorio(testo(corpo.nome), "nome"),
        // Il codice della busta paga permette al lettore delle buste di
        // riconoscere la persona; se manca la abbina per nome e cognome.
        codice_busta: testo(corpo.codice_busta),
        mansione: testo(corpo.mansione),
        data_assunzione: data(corpo.data_assunzione, "data assunzione"),
        fine_contratto: data(corpo.fine_contratto, "fine contratto"),
        data_cessazione: data(corpo.data_cessazione, "data cessazione"),
        datore_lavoro: Boolean(corpo.datore_lavoro),
        addetto_antincendio: Boolean(corpo.addetto_antincendio),
        addetto_primo_soccorso: Boolean(corpo.addetto_primo_soccorso),
        rls: Boolean(corpo.rls),
        contratto_dropbox: testo(corpo.contratto_dropbox),
        note: testo(corpo.note),
        updated_at: new Date().toISOString(),
      };
      if (campi.codice_busta && !/^\d{5}$/.test(campi.codice_busta)) {
        throw new Error("Il codice busta paga è di 5 cifre (es. 00069)");
      }
      const q = id
        ? supabase.from("sic_persone").update(campi).eq("id", id)
        : supabase.from("sic_persone").insert({ ...campi, origine: "manuale" });
      const { error } = await q;
      if (error) {
        if (error.code === "23505") throw new Error("Questo codice busta paga è già di un'altra persona");
        throw new Error(error.message);
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ errore: "Azione sconosciuta" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ errore: e instanceof Error ? e.message : "Errore" }, { status: 400 });
  }
}
