import { redirect } from "next/navigation";
import { createClient as createClientServizio } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { leggiPermessi } from "@/lib/permessi";
import { UtentiClient, type UtenteConPermessi } from "@/components/UtentiClient";

// Pagina "Utenti" (punto 13, 19/9): solo amministratori. Il middleware
// (proxy.ts) già reindirizza chi non lo è, questo controllo qui è solo una
// seconda guardia (difesa in profondità, come per le altre route sensibili).
export default async function UtentiPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const permessi = await leggiPermessi(supabase, user.id);
  if (!permessi.isAdmin) redirect("/");

  const servizio = createClientServizio(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const [{ data: elencoAuth, error: erroreAuth }, { data: profili }, { data: permessiPagina }] =
    await Promise.all([
      servizio.auth.admin.listUsers({ perPage: 200 }),
      servizio.from("profili_utente").select("user_id, is_admin, accesso_limitato"),
      servizio.from("permessi_pagina").select("user_id, pagina"),
    ]);

  if (erroreAuth) {
    return (
      <div>
        <h1 className="mb-1 text-lg font-semibold text-neutral-900">Utenti</h1>
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Errore nel caricamento degli utenti: {erroreAuth.message}
        </p>
      </div>
    );
  }

  const utenti: UtenteConPermessi[] = (elencoAuth?.users ?? [])
    .map((u) => {
      const profilo = profili?.find((p) => p.user_id === u.id);
      return {
        id: u.id,
        email: u.email ?? "(senza email)",
        isAdmin: profilo?.is_admin ?? false,
        accessoLimitato: profilo?.accesso_limitato ?? false,
        pagineConsentite: (permessiPagina ?? [])
          .filter((r) => r.user_id === u.id)
          .map((r) => r.pagina),
      };
    })
    .sort((a, b) => a.email.localeCompare(b.email));

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-neutral-900">Utenti</h1>
      <p className="mb-4 text-sm text-neutral-500">
        Per default ogni utente vede tutto il gestionale. Limita l&apos;accesso di chi deve vedere solo alcune
        pagine (es. Corrispettivi) usando il bottone su ciascun utente.
      </p>
      <UtentiClient utentiIniziali={utenti} utenteAttualeId={user.id} />
    </div>
  );
}
