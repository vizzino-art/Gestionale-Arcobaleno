import { createClient } from "@/lib/supabase/server";
import { PannelloClient, type ProdottoConCategoria } from "@/components/PannelloClient";
import type { Fornitore } from "@/lib/types";

export default async function PannelloPage() {
  const supabase = await createClient();

  const [{ data: fornitori, error: erroreFornitori }, { data: prodotti, error: erroreProdotti }] =
    await Promise.all([
      supabase.from("fornitori").select("*").order("ordine", { ascending: true }),
      supabase
        .from("prodotti")
        .select("*, categorie(nome)")
        .eq("attivo", true)
        .order("fornitore_id", { ascending: true })
        .order("ordine", { ascending: true }),
    ]);

  const errore = erroreFornitori || erroreProdotti;

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-neutral-900">Pannello</h1>
      <p className="mb-4 text-sm text-neutral-500">
        Catalogo prodotti per fornitore. Apri lo storico prezzi (📈) per vedere tutte le
        fatture passate con gli aumenti (▲ rosso) e le diminuzioni (▼ verde).
      </p>

      {errore && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Errore nel caricamento: {errore.message}
        </p>
      )}

      {!errore && (
        <PannelloClient
          fornitori={(fornitori ?? []) as Fornitore[]}
          prodotti={(prodotti ?? []) as ProdottoConCategoria[]}
        />
      )}
    </div>
  );
}
