import { createClient } from "@/lib/supabase/server";
import { RegistraBollaClient } from "@/components/RegistraBollaClient";
import type { Fornitore, Prodotto } from "@/lib/types";

export default async function RegistraBollaPage() {
  const supabase = await createClient();

  const [{ data: fornitori, error: erroreFornitori }, { data: prodotti, error: erroreProdotti }] =
    await Promise.all([
      supabase.from("fornitori").select("*").order("nome", { ascending: true }),
      supabase
        .from("prodotti")
        .select("*")
        .eq("attivo", true)
        .order("fornitore_id", { ascending: true })
        .order("ordine", { ascending: true }),
    ]);

  const errore = erroreFornitori || erroreProdotti;

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-neutral-900">Registra bolla</h1>
      <p className="mb-4 text-sm text-neutral-500">
        Fai una foto della bolla di consegna: i dati vengono letti in automatico. Controlla,
        correggi se serve e salva — aggiorna subito lo storico prezzi e il confronto.
      </p>

      {errore && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Errore nel caricamento: {errore.message}
        </p>
      )}

      {!errore && (
        <RegistraBollaClient
          fornitori={(fornitori ?? []) as Fornitore[]}
          prodotti={(prodotti ?? []) as Prodotto[]}
        />
      )}
    </div>
  );
}
