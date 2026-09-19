import { NextRequest, NextResponse } from "next/server";
import { createClient as createClientServizio } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { PAGINE, type PaginaId } from "@/lib/permessi";

// Salva/aggiorna i permessi di un utente (pagina Utenti, punto 13, 19/9).
// Chi chiama deve essere lui stesso amministratore — controllato qui con
// il client "normale" (cookie di sessione, RLS attiva, ognuno legge solo
// il proprio profilo). Le scritture su ALTRI utenti usano poi la Service
// Role, che bypassa la RLS — mai esposta al browser, letta solo qui.
export const runtime = "nodejs";

function clientServizio() {
  return createClientServizio(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

const PAGINE_VALIDE = new Set<string>(PAGINE.map((p) => p.id));

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ errore: "Non autenticato" }, { status: 401 });
  }

  const { data: profiloChiamante } = await supabase
    .from("profili_utente")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profiloChiamante?.is_admin) {
    return NextResponse.json({ errore: "Solo un amministratore può modificare i permessi." }, { status: 403 });
  }

  const corpo = await request.json();
  const userId: string | undefined = corpo.userId;
  const email: string | undefined = corpo.email;
  const isAdmin: boolean = Boolean(corpo.isAdmin);
  const accessoLimitato: boolean = Boolean(corpo.accessoLimitato);
  const pagine: unknown[] = Array.isArray(corpo.pagine) ? corpo.pagine : [];

  if (!userId || !email) {
    return NextResponse.json({ errore: "userId ed email sono obbligatori" }, { status: 400 });
  }
  const pagineValide = pagine.filter(
    (p): p is PaginaId => typeof p === "string" && PAGINE_VALIDE.has(p)
  );

  const servizio = clientServizio();

  const { error: erroreProfilo } = await servizio
    .from("profili_utente")
    .upsert(
      { user_id: userId, email, is_admin: isAdmin, accesso_limitato: accessoLimitato },
      { onConflict: "user_id" }
    );
  if (erroreProfilo) {
    return NextResponse.json({ errore: erroreProfilo.message }, { status: 500 });
  }

  // Risincronizza per intero l'elenco pagine consentite: più semplice e
  // meno soggetto a errori che calcolare un diff, e il volume (poche righe
  // per utente) rende il costo trascurabile.
  const { error: erroreCancella } = await servizio.from("permessi_pagina").delete().eq("user_id", userId);
  if (erroreCancella) {
    return NextResponse.json({ errore: erroreCancella.message }, { status: 500 });
  }
  if (pagineValide.length > 0) {
    const { error: erroreInserisci } = await servizio
      .from("permessi_pagina")
      .insert(pagineValide.map((pagina) => ({ user_id: userId, pagina })));
    if (erroreInserisci) {
      return NextResponse.json({ errore: erroreInserisci.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
