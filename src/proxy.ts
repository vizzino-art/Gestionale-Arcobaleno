import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { leggiPermessi, paginaDaPercorso, PAGINE } from "@/lib/permessi";

// Pagine raggiungibili senza login. /api/backup-drive è qui perché a
// chiamarla è Vercel Cron (nessun cookie di sessione) — si autentica da
// sola controllando l'header Authorization contro CRON_SECRET, non tramite
// login utente.
const PUBLIC_PATHS = ["/login", "/api/backup-drive"];

// Raggiungibile da qualsiasi utente loggato qualunque sia il suo permesso,
// anche uno limitato a cui non è stata ancora concessa nessuna pagina —
// altrimenti si rischierebbe un loop di redirect (punto 13, 19/9).
const SEMPRE_RAGGIUNGIBILE = "/nessun-accesso";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.some((p) =>
    request.nextUrl.pathname.startsWith(p)
  );

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Permessi per pagina (punto 13, 19/9): applicati solo alle pagine vere
  // e proprie (non alle chiamate /api/..., che restano protette solo dal
  // login come oggi) e mai a chi è già escluso sopra.
  const percorso = request.nextUrl.pathname;
  if (
    user &&
    !isPublic &&
    percorso !== SEMPRE_RAGGIUNGIBILE &&
    !percorso.startsWith("/api/")
  ) {
    const permessi = await leggiPermessi(supabase, user.id);

    // "/utenti" è la pagina che gestisce i permessi altrui: mai
    // raggiungibile da chi non è amministratore, anche se ha accesso
    // pieno (non "limitato") a tutto il resto.
    const ePaginaUtenti = percorso === "/utenti" || percorso.startsWith("/utenti/");
    if (ePaginaUtenti && !permessi.isAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    if (!ePaginaUtenti && permessi.accessoLimitato && !permessi.isAdmin) {
      const pagina = paginaDaPercorso(percorso);
      const consentito = pagina !== null && permessi.pagineConsentite.includes(pagina);
      if (!consentito) {
        const primaConsentita = PAGINE.find((p) => permessi.pagineConsentite.includes(p.id));
        const url = request.nextUrl.clone();
        url.pathname = primaConsentita ? primaConsentita.href : SEMPRE_RAGGIUNGIBILE;
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
