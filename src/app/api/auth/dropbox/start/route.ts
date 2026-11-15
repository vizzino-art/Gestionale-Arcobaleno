import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

// Modulo Sicurezza, passo 4 (15/11/2026): collegamento UNA TANTUM al
// Dropbox di Arcobaleno, per leggere le buste paga. Stesso schema di
// api/auth/google-drive/start: apre la pagina di consenso di Dropbox; il
// callback mostra il refresh token da salvare su Vercel come
// DROPBOX_REFRESH_TOKEN. Protetta dal login del gestionale (non è in
// PUBLIC_PATHS di proxy.ts). Va fatto col Dropbox che contiene la cartella
// "Arcobaleno" (quello della pizzeria, non quello personale).
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const appKey = process.env.DROPBOX_APP_KEY?.trim();
  if (!appKey) {
    return NextResponse.json({ errore: "DROPBOX_APP_KEY non configurata su Vercel" }, { status: 500 });
  }

  const state = randomBytes(16).toString("hex");
  const url = new URL("https://www.dropbox.com/oauth2/authorize");
  url.searchParams.set("client_id", appKey);
  url.searchParams.set("response_type", "code");
  // offline = refresh token che non scade (il cron gira ogni notte da solo)
  url.searchParams.set("token_access_type", "offline");
  url.searchParams.set("redirect_uri", `${request.nextUrl.origin}/api/auth/dropbox/callback`);
  url.searchParams.set("state", state);

  const response = NextResponse.redirect(url.toString());
  response.cookies.set("dropbox_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  });
  return response;
}
