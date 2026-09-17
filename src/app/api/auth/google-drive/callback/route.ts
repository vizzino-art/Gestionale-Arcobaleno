import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

// Vedi start/route.ts per il contesto. Questa pagina riceve la risposta di
// Google dopo il consenso, scambia il "code" per un refresh_token e lo
// mostra a schermo UNA TANTUM: va copiato e salvato su Vercel come
// variabile d'ambiente GOOGLE_OAUTH_REFRESH_TOKEN. Non viene salvato da
// nessuna parte automaticamente (niente tabella nuova su Supabase, per
// restare coerenti con come sono gestiti tutti gli altri segreti
// dell'app: variabili d'ambiente su Vercel).
export const runtime = "nodejs";

function pagina(messaggioHtml: string) {
  return new NextResponse(
    `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><title>Google Drive - autorizzazione</title>
     <style>body{font-family:system-ui,sans-serif;max-width:640px;margin:40px auto;padding:0 16px;line-height:1.5;color:#222}
     textarea{width:100%;height:90px;font-family:monospace;font-size:13px;padding:8px}
     a{color:#0645ad}</style></head><body>${messaggioHtml}</body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

export async function GET(request: NextRequest) {
  const erroreGoogle = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieState = request.cookies.get("google_oauth_state")?.value;

  if (erroreGoogle) {
    return pagina(`<p>Autorizzazione annullata da Google: <b>${erroreGoogle}</b>.</p>
      <p><a href="/api/auth/google-drive/start">Riprova</a></p>`);
  }

  if (!code) {
    return pagina(`<p>Manca il parametro "code" nella risposta di Google.</p>
      <p><a href="/api/auth/google-drive/start">Riprova</a></p>`);
  }

  if (!state || !cookieState || state !== cookieState) {
    return pagina(`<p>Richiesta scaduta o non valida (lo "state" non corrisponde). Riprova da capo.</p>
      <p><a href="/api/auth/google-drive/start">Riprova</a></p>`);
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return pagina(`<p>GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET non configurate su Vercel.</p>`);
  }

  const redirectUri = `${request.nextUrl.origin}/api/auth/google-drive/callback`;
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  try {
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      return pagina(`
        <p>Google non ha restituito un <code>refresh_token</code> riutilizzabile — succede quando questa
        app ha già ricevuto l'autorizzazione in passato.</p>
        <p>Per ottenerne uno nuovo: vai su
        <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener">myaccount.google.com/permissions</a>,
        rimuovi l'accesso concesso all'app del gestionale, poi
        <a href="/api/auth/google-drive/start">riprova da qui</a>.</p>
      `);
    }

    const response = pagina(`
      <p><b>Autorizzazione riuscita.</b></p>
      <p>Copia il valore qui sotto e salvalo su Vercel (Settings → Environment Variables) come nuova variabile
      chiamata <code>GOOGLE_OAUTH_REFRESH_TOKEN</code>:</p>
      <textarea readonly onclick="this.select()">${tokens.refresh_token}</textarea>
      <p>Dopo averlo salvato su Vercel puoi chiudere questa pagina.</p>
    `);
    response.cookies.delete("google_oauth_state");
    return response;
  } catch (e) {
    return pagina(`<p>Errore durante lo scambio del codice con Google: ${
      e instanceof Error ? e.message : "errore sconosciuto"
    }</p><p><a href="/api/auth/google-drive/start">Riprova</a></p>`);
  }
}
