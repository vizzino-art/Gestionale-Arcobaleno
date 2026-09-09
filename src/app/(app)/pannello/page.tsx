import { createClient } from "@/lib/supabase/server";
import { PannelloClient, type ProdottoConCategoria } from "@/components/PannelloClient";
import type { Categoria, Fornitore } from "@/lib/types";

export default async function PannelloPage() {
  const supabase = await createClient();

  const [
    { data: fornitori, error: erroreFornitori },
    { data: prodotti, error: erroreProdotti },
    { data: categorie, error: erroreCategorie },
  ] = await Promise.all([
    supabase.from("fornitori").select("*").order("ordine", { ascending: true }),
    // Niente filtro "attivo": qui si vedono e si gestiscono anche i prodotti
    // disattivati (restano in fondo alla lista), per poterli riattivare in
    // futuro se il prezzo torna conveniente.
    supabase
      .from("prodotti")
      .select("*, categorie(nome)")
      .order("fornitore_id", { ascending: true })
      .order("ordine", { ascending: true }),
    supabase.from("categorie").select("*").order("nome", { ascending: true }),
  ]);

  const errore = erroreFornitori || erroreProdotti || erroreCategorie;

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-neutral-900">Pannello</h1>
      <p className="mb-4 text-sm text-neutral-500">
        Catalogo prodotti per fornitore: modifica prezzo/sconti, aggiungi nuovi prodotti,
        attiva/disattiva. Apri lo storico prezzi (📈) per vedere tutte le fatture passate
        con gli aumenti (▲ rosso) e le diminuzioni (▼ verde).
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
          categorie={(categorie ?? []) as Categoria[]}
        />
      )}
    </div>
  );
}
