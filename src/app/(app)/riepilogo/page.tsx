import { createClient } from "@/lib/supabase/server";
import { RiepilogoClient } from "@/components/RiepilogoClient";
import type { Fornitore, Prodotto } from "@/lib/types";

export default async function RiepilogoPage() {
  const supabase = await createClient();

  const [{ data: fornitori, error: erroreFornitori }, { data: prodotti, error: erroreProdotti }] =
    await Promise.all([
      supabase.from("fornitori").select("*").order("ordine", { ascending: true }),
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
      <h1 className="mb-1 text-lg font-semibold text-neutral-900">Riepilogo</h1>
      <p className="mb-4 text-sm text-neutral-500">
        Vista d&apos;insieme: tutti i fornitori che hanno bisogno di un ordine adesso, con il
        messaggio pronto per ciascuno.
      </p>

      {errore && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Errore nel caricamento: {errore.message}
        </p>
      )}

      {!errore && (
        <RiepilogoClient
          fornitori={(fornitori ?? []) as Fornitore[]}
          prodotti={(prodotti ?? []) as Prodotto[]}
        />
      )}
    </div>
  );
}
