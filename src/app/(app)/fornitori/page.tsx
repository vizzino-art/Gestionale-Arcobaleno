import { createClient } from "@/lib/supabase/server";
import { FornitoriClient } from "@/components/FornitoriClient";
import type { Fornitore } from "@/lib/types";

export default async function FornitoriPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fornitori")
    .select("*")
    .order("nome", { ascending: true });

  const fornitori = (data ?? []) as Fornitore[];

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold text-neutral-900">
        Fornitori
      </h1>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Errore nel caricamento: {error.message}
        </p>
      )}

      {!error && fornitori.length === 0 && (
        <p className="mb-4 text-sm text-neutral-500">Nessun fornitore ancora.</p>
      )}

      {!error && <FornitoriClient fornitoriIniziali={fornitori} />}
    </div>
  );
}
