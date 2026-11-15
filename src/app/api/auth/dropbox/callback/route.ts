import { NextRequest, NextResponse } from "next/server";

// Vedi start/route.ts. Scambia il "code" con un refresh token e lo mostra
// a schermo una volta sola: va copiato su Vercel come DROPBOX_REFRESH_TOKEN
// (come per Google Drive, nessun segreto viene salvato su Supabase).
export const runtime = "nodejs";

function pagina(html: string) {
  return new NextResponse(
    `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><title>Dropbox - autorizzazione</title>
     <style>body{font-family:system-ui,sans-serif;max-width:640px;margin:40px auto;padding:0 16px;line-height:1.5;color:#222}
     textarea{width:100%;height:90px;font-family:monospace;font-size:13px;padding:8px}a{color:#0645ad}</style>
     </head><body>${html}</body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

export async function GET(request: NextRequest) {
  const errore = request.nextUrl.searchParams.get("error_description") ?? request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieState = request.cookies.get("dropbox_oauth_state")?.value;
  const riprova = `<p><a href="/api/auth/dropbox/start">Riprova</a></p>`;

  if (errore) return pagina(`<p>Autorizzazione annullata da Dropbox: <b>${errore}</b>.</p>${riprova}`);
  if (!code) return pagina(`<p>Manca il parametro "code" nella risposta di Dropbox.</p>${riprova}`);
  if (!state || !cookieState || state !== cookieState) {
    return pagina(`<p>Richiesta scaduta o non valida. Riprova da capo.</p>${riprova}`);
  }

  const appKey = process.env.DROPBOX_APP_KEY?.trim();
  const appSecret = process.env.DROPBOX_APP_SECRET?.trim();
  if (!appKey || !appSecret) {
    return pagina(`<p>DROPBOX_APP_KEY / DROPBOX_APP_SECRET non configurate su Vercel.</p>`);
  }

  const risposta = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: appKey,
      client_secret: appSecret,
      redirect_uri: `${request.nextUrl.origin}/api/auth/dropbox/callback`,
    }),
  });
  const dati = await risposta.json().catch(() => null);

  if (!risposta.ok || !dati?.refresh_token) {
    return pagina(
      `<p>Errore durante lo scambio del codice con Dropbox: ${dati?.error_description ?? dati?.error ?? risposta.status}</p>${riprova}`
    );
  }

  const response = pagina(`
    <p><b>Autorizzazione riuscita.</b></p>
    <p>Copia il valore qui sotto e salvalo su Vercel (Settings → Environment Variables) come nuova variabile
    chiamata <code>DROPBOX_REFRESH_TOKEN</code>, poi rifai il deploy:</p>
    <textarea readonly onclick="this.select()">${dati.refresh_token}</textarea>
    <p>Dopo averlo salvato puoi chiudere questa pagina.</p>
  `);
  response.cookies.delete("dropbox_oauth_state");
  return response;
}
