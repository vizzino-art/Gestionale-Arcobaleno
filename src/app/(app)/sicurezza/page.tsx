import { createClient } from "@/lib/supabase/server";
import { SicurezzaClient } from "@/components/SicurezzaClient";
import { leggiPermessi } from "@/lib/permessi";
import { oggiRoma, type Corso, type Formazione, type Persona, type Visita } from "@/lib/sicurezza";

// Modulo Sicurezza + HACCP (15/11/2026): scadenzario corsi e visite.
// Le tabelle sic_* sono leggibili SOLO dagli amministratori (RLS, vedi
// supabase/crea-sicurezza-haccp.sql): a un utente non admin le query
// tornerebbero vuote, quindi glielo diciamo esplicitamente.
export default async function SicurezzaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const permessi = user ? await leggiPermessi(supabase, user.id) : null;

  if (!permessi?.isAdmin) {
    return (
      <div>
        <h1 className="mb-1 text-lg font-semibold text-neutral-900">Sicurezza e HACCP</h1>
        <p className="text-sm text-neutral-500">Questa pagina è riservata agli amministratori.</p>
      </div>
    );
  }

  const [persone, corsi, formazioni, visite] = await Promise.all([
    supabase.from("sic_persone").select("*"),
    supabase.from("sic_corsi").select("*"),
    supabase.from("sic_formazioni").select("*"),
    supabase.from("sic_visite").select("*"),
  ]);
  const errore = persone.error ?? corsi.error ?? formazioni.error ?? visite.error;

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-neutral-900">Sicurezza e HACCP</h1>
      <p className="mb-4 text-sm text-neutral-500">
        Scadenze di corsi e visite mediche per chi lavora in pizzeria. Clicca su una persona per vedere tutti i
        corsi, le visite e gli attestati.
      </p>

      {errore && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Errore nel caricamento: {errore.message}
        </p>
      )}

      {!errore && (
        <SicurezzaClient
          persone={(persone.data ?? []) as Persona[]}
          corsi={(corsi.data ?? []) as Corso[]}
          formazioni={(formazioni.data ?? []) as Formazione[]}
          visite={(visite.data ?? []) as Visita[]}
          oggi={oggiRoma()}
        />
      )}
    </div>
  );
}
