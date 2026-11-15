import { NextRequest, NextResponse } from "next/server";
import { createClient as createClientServizio } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  calcolaScadenzario,
  colore,
  formattaData,
  oggiRoma,
  type Corso,
  type Formazione,
  type Persona,
  type Stato,
  type Visita,
} from "@/lib/sicurezza";

// Modulo Sicurezza, passo 6 (15/11/2026): riepilogo settimanale via email.
// - GET: Vercel Cron, ogni lunedì mattina (vedi vercel.json), con CRON_SECRET.
// - POST: pulsante "Invia riepilogo di prova" nella pagina (solo admin);
//   la prova NON viene registrata, così il lunedì le novità restano segnate 🆕.
// L'email parte da uno script Apps Script (stesso sistema delle
// manutenzioni) il cui indirizzo /exec è in SICUREZZA_EMAIL_URL. I
// destinatari sono scritti nello script, non qui: chi conoscesse l'indirizzo
// potrebbe al massimo mandare un'email a voi tre.
// Se non c'è nulla di scaduto o in scadenza, l'email non parte.
export const runtime = "nodejs";
export const maxDuration = 60;

function clientServizio() {
  return createClientServizio(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

type Voce = {
  persona_id: string;
  persona: string;
  oggetto: string; // corso_id oppure "visita"
  cosa: string;
  stato: Stato;
  data: string | null;
  tipo_avviso: "scaduto" | "3_mesi";
  nuova: boolean;
};

// La tabella dei log vuole una data: per "mancante" (mai fatto, nessun
// termine) usiamo una data convenzionale fissa, così resta riconoscibile.
const SENZA_DATA = "2000-01-01";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function descriviStato(v: Voce): string {
  const d = formattaData(v.data);
  switch (v.stato) {
    case "scaduto":
      return `scaduto il ${d}`;
    case "mancante":
      return v.data ? `mancante (andava fatto entro il ${d})` : "mancante";
    case "in_scadenza":
      return `scade il ${d}`;
    case "da_fare":
      return `da fare entro il ${d}`;
    default:
      return d;
  }
}

async function preparaRiepilogo(oggi: string) {
  const db = clientServizio();
  const [persone, corsi, formazioni, visite, log] = await Promise.all([
    db.from("sic_persone").select("*").is("data_cessazione", null),
    db.from("sic_corsi").select("*"),
    db.from("sic_formazioni").select("*"),
    db.from("sic_visite").select("*"),
    db.from("sic_notifiche_log").select("persona_id, oggetto, tipo_avviso, scadenza"),
  ]);
  const errore = persone.error ?? corsi.error ?? formazioni.error ?? visite.error ?? log.error;
  if (errore) throw new Error(errore.message);

  const giaInviati = new Set(
    (log.data ?? []).map((r) => `${r.persona_id}|${r.oggetto}|${r.tipo_avviso}|${r.scadenza}`)
  );
  const nomeCorso = new Map((corsi.data as Corso[]).map((c) => [c.id, c.nome]));

  const righe = calcolaScadenzario(
    (persone.data ?? []) as Persona[],
    (corsi.data ?? []) as Corso[],
    (formazioni.data ?? []) as Formazione[],
    (visite.data ?? []) as Visita[],
    oggi
  );

  const voci: Voce[] = [];
  for (const r of righe) {
    for (const e of r.esiti) {
      const c = colore(e.stato);
      if (c !== "rosso" && c !== "giallo") continue;
      const tipo_avviso = c === "rosso" ? "scaduto" : "3_mesi";
      voci.push({
        persona_id: r.persona.id,
        persona: `${r.persona.cognome} ${r.persona.nome}`,
        oggetto: e.chiave,
        cosa: e.chiave === "visita" ? "Visita medica" : nomeCorso.get(e.chiave) ?? e.etichetta,
        stato: e.stato,
        data: e.data,
        tipo_avviso,
        nuova: !giaInviati.has(`${r.persona.id}|${e.chiave}|${tipo_avviso}|${e.data ?? SENZA_DATA}`),
      });
    }
  }
  const ordina = (a: Voce, b: Voce) =>
    a.persona.localeCompare(b.persona, "it") || (a.data ?? "").localeCompare(b.data ?? "");
  return {
    rossi: voci.filter((v) => v.tipo_avviso === "scaduto").sort(ordina),
    gialli: voci.filter((v) => v.tipo_avviso === "3_mesi").sort(ordina),
  };
}

function componiEmail(rossi: Voce[], gialli: Voce[], link: string, oggi: string, prova: boolean) {
  const nuove = [...rossi, ...gialli].filter((v) => v.nuova).length;
  const oggetto =
    `${prova ? "[PROVA] " : ""}Riepilogo ${formattaData(oggi)}: ` +
    `${rossi.length} scaduti/mancanti, ${gialli.length} in scadenza` +
    (nuove ? ` (${nuove} novità)` : "");

  const tabella = (titolo: string, colore: string, voci: Voce[]) =>
    voci.length === 0
      ? ""
      : `<h3 style="margin:18px 0 6px;color:${colore}">${titolo} (${voci.length})</h3>
<table style="border-collapse:collapse;font-size:14px">
${voci
  .map(
    (v) => `<tr>
<td style="padding:3px 10px 3px 0;white-space:nowrap">${v.nuova ? "🆕 " : ""}<b>${esc(v.persona)}</b></td>
<td style="padding:3px 10px 3px 0">${esc(v.cosa)}</td>
<td style="padding:3px 0;color:#555">${esc(descriviStato(v))}</td>
</tr>`
  )
  .join("\n")}
</table>`;

  const html = `<div style="font-family:Arial,sans-serif;color:#222">
${prova ? '<p style="background:#fef3c7;padding:6px 10px">Email di prova inviata dal pulsante nella pagina Sicurezza.</p>' : ""}
<p>Riepilogo settimanale di corsi e visite mediche del personale di Pizzeria Arcobaleno al ${formattaData(oggi)}.</p>
${tabella("🔴 Scaduti o mancanti", "#b91c1c", rossi)}
${tabella("🟡 In scadenza entro 3 mesi / da fare", "#92400e", gialli)}
<p style="margin-top:18px"><a href="${link}">Apri la pagina Sicurezza del gestionale</a> per registrare corsi e visite.</p>
<p style="color:#888;font-size:12px">🆕 = segnalato per la prima volta. Le voci restano nel riepilogo finché non vengono registrate.</p>
</div>`;

  const riga = (v: Voce) => `- ${v.nuova ? "[NUOVO] " : ""}${v.persona}: ${v.cosa}, ${descriviStato(v)}`;
  const testo = [
    `Riepilogo sicurezza al ${formattaData(oggi)}`,
    "",
    `SCADUTI O MANCANTI (${rossi.length})`,
    ...rossi.map(riga),
    "",
    `IN SCADENZA / DA FARE (${gialli.length})`,
    ...gialli.map(riga),
    "",
    `Pagina: ${link}`,
  ].join("\n");

  return { oggetto, html, testo };
}

async function inviaTramiteAppsScript(email: { oggetto: string; html: string; testo: string }) {
  const url = process.env.SICUREZZA_EMAIL_URL?.trim();
  if (!url) throw new Error("SICUREZZA_EMAIL_URL non configurata su Vercel");
  // Apps Script risponde con un redirect: fetch lo segue da solo.
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ app: "gestionale-arcobaleno-sicurezza", ...email }),
    redirect: "follow",
  });
  const corpo = await r.text();
  let dati: { ok?: boolean; errore?: string } | null = null;
  try {
    dati = JSON.parse(corpo);
  } catch {
    // Pagina HTML = di solito script non distribuito come "Chiunque".
  }
  if (!r.ok || !dati?.ok) {
    throw new Error(`Lo script email ha risposto con un errore: ${dati?.errore ?? `${r.status} ${corpo.slice(0, 150)}`}`);
  }
}

async function esegui(request: NextRequest, prova: boolean) {
  const oggi = oggiRoma();
  const { rossi, gialli } = await preparaRiepilogo(oggi);
  if (rossi.length + gialli.length === 0) {
    return { inviata: false, motivo: "Niente di scaduto o in scadenza: email non inviata." };
  }
  // Dominio di produzione (variabile fornita da Vercel), non quello del singolo deploy.
  const dominio = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const link = `${dominio ? `https://${dominio}` : request.nextUrl.origin}/sicurezza`;
  await inviaTramiteAppsScript(componiEmail(rossi, gialli, link, oggi, prova));

  if (!prova) {
    const nuove = [...rossi, ...gialli].filter((v) => v.nuova);
    if (nuove.length) {
      const { error } = await clientServizio()
        .from("sic_notifiche_log")
        .insert(
          nuove.map((v) => ({
            persona_id: v.persona_id,
            oggetto: v.oggetto,
            tipo_avviso: v.tipo_avviso,
            scadenza: v.data ?? SENZA_DATA,
          }))
        );
      if (error) throw new Error(`Email inviata, ma registro non aggiornato: ${error.message}`);
    }
  }
  return { inviata: true, scaduti: rossi.length, inScadenza: gialli.length };
}

// Vercel Cron
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ errore: "Non autorizzato" }, { status: 401 });
  }
  try {
    return NextResponse.json(await esegui(request, false));
  } catch (e) {
    return NextResponse.json({ errore: e instanceof Error ? e.message : "Errore" }, { status: 500 });
  }
}

// Pulsante di prova nella pagina (solo amministratori)
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
  if (!profilo?.is_admin) return NextResponse.json({ errore: "Riservato agli amministratori." }, { status: 403 });
  try {
    return NextResponse.json(await esegui(request, true));
  } catch (e) {
    return NextResponse.json({ errore: e instanceof Error ? e.message : "Errore" }, { status: 500 });
  }
}
