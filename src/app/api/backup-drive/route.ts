import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";

// Backup automatico (punto 14): chiamata ogni notte da Vercel Cron (vedi
// vercel.json), esporta tutte le tabelle principali del gestionale come
// file JSON in una cartella con la data, dentro la cartella Google Drive
// indicata da GOOGLE_DRIVE_BACKUP_FOLDER_ID. Nessun dato viene mai
// cancellato da Supabase: è un'esportazione di sola lettura.
export const runtime = "nodejs";

// Tutte le tabelle del gestionale (schema.sql + crea-registro-fatture.sql).
// Aggiungere qui qualsiasi nuova tabella futura perché venga inclusa nel
// backup — altrimenti passerebbe inosservata.
const TABELLE = [
  "fornitori",
  "categorie",
  "prodotti",
  "storico_prezzi_fatture",
  "storico_ordini",
  "storico_miglior_fornitore",
  "file_elaborati",
  "prodotti_doppioni_ignorati",
  "fatture_ricevute",
  "righe_fatture_ricevute",
  "rate_pagamento_fatture",
];

function autenticato(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function clientSupabaseServizio() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// I Service Account non hanno mai spazio di archiviazione proprio su Drive
// ("Service Accounts do not have storage quota"): per questo l'autenticazione
// usa invece l'account Google personale di chi ha fatto il login OAuth una
// tantum su /api/auth/google-drive/start (vedi quella route per i dettagli).
// Il refresh_token ottenuto lì è salvato come variabile d'ambiente e viene
// usato qui per rinnovare l'accesso automaticamente ogni notte.
function clientDrive() {
  // .trim(): vedi start/route.ts — protegge da spazi/a-capo invisibili
  // finiti per sbaglio nel valore incollato su Vercel.
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN?.trim();
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return google.drive({ version: "v3", auth: oauth2Client });
}

export async function GET(request: NextRequest) {
  if (!autenticato(request)) {
    return NextResponse.json({ errore: "Non autorizzato" }, { status: 401 });
  }

  const cartellaPadre = process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID;
  if (!cartellaPadre) {
    return NextResponse.json({ errore: "GOOGLE_DRIVE_BACKUP_FOLDER_ID non configurata" }, { status: 500 });
  }
  if (!process.env.GOOGLE_OAUTH_REFRESH_TOKEN) {
    return NextResponse.json(
      {
        errore:
          "GOOGLE_OAUTH_REFRESH_TOKEN non configurata: serve autorizzare l'app visitando /api/auth/google-drive/start da loggati",
      },
      { status: 500 }
    );
  }

  // Tutto il resto (credenziali Google, chiamate a Drive/Supabase) può
  // fallire per mille motivi diversi — una chiave incollata male, un
  // permesso mancante sulla cartella, un problema di rete. Un errore qui
  // non deve mai restare un 500 muto: meglio un messaggio chiaro nella
  // risposta, utile per capire cosa sistemare guardando i log di Vercel o
  // chiamando la route a mano dal browser.
  try {
    const supabase = clientSupabaseServizio();
    const drive = clientDrive();

    const oggi = new Date().toISOString().slice(0, 10); // es. 2026-09-14

    // Una sottocartella per ogni esecuzione: se lo stesso giorno il backup
    // gira più di una volta (es. rilancio manuale dopo un errore), riusa la
    // cartella di oggi invece di crearne una nuova vuota accanto.
    const esistente = await drive.files.list({
      q: `'${cartellaPadre}' in parents and name = '${oggi}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "files(id)",
    });
    const cartellaOggiId =
      esistente.data.files?.[0]?.id ??
      (
        await drive.files.create({
          requestBody: { name: oggi, mimeType: "application/vnd.google-apps.folder", parents: [cartellaPadre] },
          fields: "id",
        })
      ).data.id!;

    const risultati: { tabella: string; righe?: number; errore?: string }[] = [];

    for (const tabella of TABELLE) {
      const { data, error } = await supabase.from(tabella).select("*");
      if (error) {
        risultati.push({ tabella, errore: error.message });
        continue;
      }
      try {
        await drive.files.create({
          requestBody: { name: `${tabella}.json`, parents: [cartellaOggiId] },
          media: { mimeType: "application/json", body: JSON.stringify(data, null, 2) },
          fields: "id",
        });
        risultati.push({ tabella, righe: data?.length ?? 0 });
      } catch (e) {
        risultati.push({ tabella, errore: e instanceof Error ? e.message : "errore sconosciuto nel caricamento su Drive" });
      }
    }

    const fallite = risultati.filter((r) => r.errore);
    return NextResponse.json(
      { cartella: oggi, cartellaId: cartellaOggiId, risultati },
      { status: fallite.length > 0 ? 207 : 200 }
    );
  } catch (e) {
    return NextResponse.json(
      { errore: e instanceof Error ? e.message : "Errore sconosciuto durante il backup" },
      { status: 500 }
    );
  }
}
