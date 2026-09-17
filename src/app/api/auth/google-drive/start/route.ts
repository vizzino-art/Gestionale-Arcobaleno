import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

// Punto 14 (backup Google Drive): i Service Account non hanno mai spazio
// di archiviazione proprio su Drive ("Service Accounts do not have storage
// quota"), quindi il backup deve scrivere usando l'account Google
// personale di Mauro invece che un Service Account. Questa pagina avvia il
// login OAuth: apre la schermata di consenso di Google, dove Mauro
// autorizza l'app a creare/gestire (solo) i file che l'app stessa crea
// (scope drive.file — non vede il resto del Drive).
//
// Protetta automaticamente dal login del gestionale: non è in
// PUBLIC_PATHS (vedi proxy.ts), quindi solo chi è già loggato può
// raggiungerla.
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { errore: "GOOGLE_OAUTH_CLIENT_ID non configurata su Vercel" },
      { status: 500 }
    );
  }

  const redirectUri = `${request.nextUrl.origin}/api/auth/google-drive/callback`;

  // "state" anti-CSRF: valore casuale generato ora, salvato in un cookie
  // temporaneo e ricontrollato nel callback, per essere sicuri che la
  // risposta di Google corrisponda a una richiesta partita davvero da qui.
  const state = randomBytes(16).toString("hex");

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  // access_type=offline + prompt=consent: senza questi due, Google spesso
  // non restituisce un refresh_token riutilizzabile (serve per poter
  // rinnovare l'accesso ogni notte senza richiedere login ogni volta).
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("scope", "https://www.googleapis.com/auth/drive.file");
  url.searchParams.set("state", state);

  const response = NextResponse.redirect(url.toString());
  response.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  });
  return response;
}
