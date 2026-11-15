// Accesso in sola lettura al Dropbox di Arcobaleno (passo 4 del modulo
// Sicurezza, 15/11/2026): serve a leggere le buste paga mensili.
//
// Stesso schema già usato per Google Drive (vedi api/auth/google-drive):
// un'app Dropbox con chiave e segreto (DROPBOX_APP_KEY / DROPBOX_APP_SECRET)
// e un refresh token ottenuto UNA volta da /api/auth/dropbox/start e salvato
// su Vercel come DROPBOX_REFRESH_TOKEN. Da lì ogni chiamata si rinnova da sola.
// Nessuna libreria esterna: bastano tre chiamate HTTP alle API di Dropbox.

export type VoceDropbox = {
  ".tag": "file" | "folder" | "deleted";
  name: string;
  path_lower: string;
  path_display: string;
  content_hash?: string;
};

function variabile(nome: string): string {
  // .trim(): stesso motivo spiegato in api/auth/google-drive/start (spazi
  // invisibili incollati per sbaglio nei campi di Vercel).
  const v = process.env[nome]?.trim();
  if (!v) throw new Error(`${nome} non configurata su Vercel`);
  return v;
}

export async function tokenDropbox(): Promise<string> {
  const risposta = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: variabile("DROPBOX_REFRESH_TOKEN"),
      client_id: variabile("DROPBOX_APP_KEY"),
      client_secret: variabile("DROPBOX_APP_SECRET"),
    }),
  });
  const dati = await risposta.json().catch(() => null);
  if (!risposta.ok || !dati?.access_token) {
    throw new Error(`Dropbox non ha dato l'accesso: ${dati?.error_description ?? dati?.error ?? risposta.status}`);
  }
  return dati.access_token as string;
}

// Elenca i file di una cartella. Se la cartella non esiste (es. l'anno
// nuovo non è ancora stato creato) restituisce una lista vuota.
export async function elencaCartella(token: string, percorso: string): Promise<VoceDropbox[]> {
  const voci: VoceDropbox[] = [];
  let risposta = await fetch("https://api.dropboxapi.com/2/files/list_folder", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ path: percorso, recursive: false }),
  });
  for (;;) {
    const dati = await risposta.json().catch(() => null);
    if (!risposta.ok) {
      if (JSON.stringify(dati ?? "").includes("not_found")) return [];
      throw new Error(`Errore Dropbox leggendo "${percorso}": ${dati?.error_summary ?? risposta.status}`);
    }
    voci.push(...(dati.entries as VoceDropbox[]));
    if (!dati.has_more) return voci;
    risposta = await fetch("https://api.dropboxapi.com/2/files/list_folder/continue", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ cursor: dati.cursor }),
    });
  }
}

export async function scaricaFile(token: string, percorso: string): Promise<Buffer> {
  const risposta = await fetch("https://content.dropboxapi.com/2/files/download", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      // L'header vuole JSON con i caratteri non ASCII "escapati" (es. "à").
      "Dropbox-API-Arg": JSON.stringify({ path: percorso }).replace(
        /[\u007f-￿]/g,
        (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0")
      ),
    },
  });
  if (!risposta.ok) {
    throw new Error(`Errore Dropbox scaricando "${percorso}": ${risposta.status} ${await risposta.text()}`);
  }
  return Buffer.from(await risposta.arrayBuffer());
}
