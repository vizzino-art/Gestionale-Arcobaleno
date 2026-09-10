import { createClient } from "@/lib/supabase/server";
import { OrdinaClient } from "@/components/OrdinaClient";
import type {
  ConfrontoCategoria,
  Fornitore,
  Prodotto,
  StoricoProdotto,
} from "@/lib/types";

export default async function OrdinaPage() {
  const supabase = await createClient();

  const [{ data: fornitori, error: erroreFornitori }, { data: prodotti, error: erroreProdotti }, { data: confronto }, { data: storico }] =
    await Promise.all([
      supabase.from("fornitori").select("*").order("nome", { ascending: true }),
      supabase
        .from("prodotti")
        .select("*")
        .eq("attivo", true)
        .order("fornitore_id", { ascending: true })
        .order("ordine", { ascending: true }),
      supabase.from("v_confronto_categorie").select("*"),
      supabase.from("v_storico_prodotto").select("*"),
    ]);

  const errore = erroreFornitori || erroreProdotti;

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold text-neutral-900">Ordina</h1>

      {errore && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Errore nel caricamento: {errore.message}
        </p>
      )}

      {!errore && (
        <OrdinaClient
          fornitori={(fornitori ?? []) as Fornitore[]}
          prodottiIniziali={(prodotti ?? []) as Prodotto[]}
          confronto={(confronto ?? []) as ConfrontoCategoria[]}
          storico={(storico ?? []) as StoricoProdotto[]}
        />
      )}
    </div>
  );
}
