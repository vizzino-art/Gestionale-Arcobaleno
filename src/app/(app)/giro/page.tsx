import { createClient } from "@/lib/supabase/server";
import { GiroClient } from "@/components/GiroClient";
import type { ProdottoConCategoria } from "@/components/PannelloClient";
import type { Categoria, ConfrontoCategoria, Fornitore, StoricoProdotto } from "@/lib/types";

export default async function GiroPage() {
  const supabase = await createClient();

  const [
    { data: fornitori, error: erroreFornitori },
    { data: prodotti, error: erroreProdotti },
    { data: confronto },
    { data: storico },
    { data: categorie },
  ] = await Promise.all([
    supabase.from("fornitori").select("*").order("nome", { ascending: true }),
    supabase
      .from("prodotti")
      .select("*, categorie(nome)")
      .eq("attivo", true)
      .eq("in_giro", true)
      .order("ordine_giro", { ascending: true }),
    supabase.from("v_confronto_categorie").select("*"),
    supabase.from("v_storico_prodotto").select("*"),
    supabase.from("categorie").select("*"),
  ]);

  const errore = erroreFornitori || erroreProdotti;

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-neutral-900">Giro</h1>

      {errore && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Errore nel caricamento: {errore.message}
        </p>
      )}

      {!errore && (
        <GiroClient
          fornitori={(fornitori ?? []) as Fornitore[]}
          prodottiIniziali={(prodotti ?? []) as ProdottoConCategoria[]}
          confronto={(confronto ?? []) as ConfrontoCategoria[]}
          storico={(storico ?? []) as StoricoProdotto[]}
          categorie={(categorie ?? []) as Categoria[]}
        />
      )}
    </div>
  );
}
