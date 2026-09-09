import { createClient } from "@/lib/supabase/server";
import type { Fornitore } from "@/lib/types";

export default async function FornitoriPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fornitori")
    .select("*")
    .order("ordine", { ascending: true });

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
        <p className="text-sm text-neutral-500">
          Nessun fornitore ancora. Verranno importati dal foglio Google
          durante la migrazione dati.
        </p>
      )}

      <div className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
        {fornitori.map((f) => (
          <div key={f.id} className="p-4">
            <p className="font-medium text-neutral-900">{f.nome}</p>
            <p className="text-sm text-neutral-500">
              {f.telefono ?? "—"} · {f.email ?? "—"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
