import { createClient } from "@/lib/supabase/server";
import type { CambioMigliorFornitore, ConfrontoCategoria } from "@/lib/types";

function formattaData(iso: string) {
  return new Date(iso).toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function ConfrontaPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_confronto_categorie")
    .select("*")
    .order("categoria_nome", { ascending: true })
    .order("posizione", { ascending: true });

  const { data: cambiData, error: cambiError } = await supabase
    .from("storico_miglior_fornitore")
    .select("id, categoria_id, fornitore_id, prezzo_per_kg, rilevato_il, categorie(nome), fornitori(nome)")
    .order("rilevato_il", { ascending: false })
    .limit(15);

  const righe = (data ?? []) as ConfrontoCategoria[];
  const cambi = (cambiData ?? []) as unknown as CambioMigliorFornitore[];

  // Raggruppa per categoria
  const perCategoria = righe.reduce<Record<string, ConfrontoCategoria[]>>(
    (acc, r) => {
      (acc[r.categoria_nome] ??= []).push(r);
      return acc;
    },
    {}
  );

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-neutral-900">
        Confronta
      </h1>
      <p className="mb-4 text-sm text-neutral-500">
        Calcolato automaticamente dal prezzo al KG più aggiornato di ogni
        fornitore. Il primo di ogni categoria è il più conveniente.
      </p>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Errore nel caricamento: {error.message}
        </p>
      )}

      {!cambiError && cambi.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="mb-2 text-sm font-medium text-amber-900">
            Cambiamenti recenti del fornitore più conveniente
          </h2>
          <div className="space-y-1.5">
            {cambi.map((c) => (
              <p key={c.id} className="text-sm text-amber-800">
                <span className="text-amber-600">{formattaData(c.rilevato_il)}</span>
                {" — "}
                <span className="font-medium">{c.categorie?.nome ?? "—"}</span>
                {": ora conviene "}
                <span className="font-medium">{c.fornitori?.nome ?? "—"}</span>
                {c.prezzo_per_kg != null && ` (€${c.prezzo_per_kg.toFixed(2)}/kg)`}
              </p>
            ))}
          </div>
        </div>
      )}

      {!error && Object.keys(perCategoria).length === 0 && (
        <p className="text-sm text-neutral-500">
          Nessun dato ancora: verrà popolato durante la migrazione dei
          prodotti e delle categorie.
        </p>
      )}

      <div className="space-y-6">
        {Object.entries(perCategoria).map(([categoria, prodotti]) => (
          <div
            key={categoria}
            className="rounded-xl border border-neutral-200 bg-white p-4"
          >
            <h2 className="mb-2 font-medium text-neutral-900">{categoria}</h2>
            <div className="divide-y divide-neutral-100">
              {prodotti.map((p) => (
                <div
                  key={p.prodotto_id}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <span
                    className={
                      p.posizione === 1
                        ? "font-medium text-green-700"
                        : "text-neutral-600"
                    }
                  >
                    {p.posizione === 1 && "✓ "}
                    {p.fornitore_nome} — {p.descrizione}
                  </span>
                  <span className="text-neutral-500">
                    {p.prezzo_per_kg != null
                      ? `€${p.prezzo_per_kg.toFixed(2)}/kg`
                      : `€${p.prezzo_unitario?.toFixed(2) ?? "—"}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
