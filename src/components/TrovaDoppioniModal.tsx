"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { trovaCoppieSospette, type CoppiaSospetta } from "@/lib/duplicati-prodotti";
import type { Fornitore, Prodotto } from "@/lib/types";

type Props = {
  prodotti: Prodotto[];
  fornitori: Fornitore[];
  onUnito: (idTenuto: string, idEliminato: string, codiceArticoloAggiornato: string | null) => void;
  onChiudi: () => void;
};

function chiaveCoppia(c: CoppiaSospetta): string {
  return c.a.id < c.b.id ? `${c.a.id}-${c.b.id}` : `${c.b.id}-${c.a.id}`;
}

export function TrovaDoppioniModal({ prodotti, fornitori, onUnito, onChiudi }: Props) {
  const [ignorate, setIgnorate] = useState<Set<string>>(new Set());
  const [confermaCoppia, setConfermaCoppia] = useState<string | null>(null);
  const [unendo, setUnendo] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const nomeFornitore = useMemo(() => {
    const mappa = new Map(fornitori.map((f) => [f.id, f.nome]));
    return (id: string) => mappa.get(id) ?? "?";
  }, [fornitori]);

  const coppie = useMemo(
    () => trovaCoppieSospette(prodotti).filter((c) => !ignorate.has(chiaveCoppia(c))),
    [prodotti, ignorate]
  );

  function ignora(c: CoppiaSospetta) {
    setIgnorate((prev) => new Set(prev).add(chiaveCoppia(c)));
    setConfermaCoppia(null);
  }

  async function unisci(tenuto: Prodotto, eliminato: Prodotto) {
    setUnendo(true);
    setErrore(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("unisci_prodotti", {
      id_da_tenere: tenuto.id,
      id_da_eliminare: eliminato.id,
    });
    setUnendo(false);
    setConfermaCoppia(null);
    if (error) {
      setErrore(`Errore nell'unione: ${error.message}`);
      return;
    }
    const codiceAggiornato =
      !tenuto.codice_articolo && eliminato.codice_articolo ? eliminato.codice_articolo : null;
    onUnito(tenuto.id, eliminato.id, codiceAggiornato);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onChiudi}>
      <div
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Prodotti doppi</h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              Coppie di prodotti dello stesso fornitore con nome molto simile: probabilmente lo
              stesso prodotto inserito due volte. Unendoli, lo storico prezzi e ordini del
              prodotto eliminato passa a quello tenuto — non si perde nulla. Se una coppia non è
              in realtà un doppione (es. due formati diversi), usa &quot;Non è un doppione&quot;.
            </p>
          </div>
          <button onClick={onChiudi} className="shrink-0 text-neutral-400 hover:text-neutral-700">
            ✕
          </button>
        </div>

        {errore && <p className="mb-3 rounded-md bg-red-50 p-2 text-xs text-red-700">{errore}</p>}

        {coppie.length === 0 && (
          <p className="text-sm text-neutral-500">Nessuna coppia sospetta trovata.</p>
        )}

        <div className="space-y-3">
          {coppie.map((c) => {
            const chiave = chiaveCoppia(c);
            return (
              <div key={chiave} className="rounded-lg border border-neutral-200 p-3">
                <div className="mb-2 flex items-center justify-between text-xs text-neutral-500">
                  <span>{nomeFornitore(c.a.fornitore_id)}</span>
                  <span>
                    {c.stessoPrezzo && (
                      <span className="mr-2 rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800">
                        stesso prezzo
                      </span>
                    )}
                    somiglianza {Math.round(c.punteggio * 100)}%
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {[c.a, c.b].map((p, i) => {
                    const altro = i === 0 ? c.b : c.a;
                    return (
                      <div key={p.id} className="rounded-md bg-neutral-50 p-2">
                        <p className="text-sm text-neutral-900">{p.descrizione}</p>
                        <p className="text-xs text-neutral-500">
                          {p.prezzo_unitario != null ? `€${p.prezzo_unitario.toFixed(4)}` : "—"}
                          {p.codice_articolo ? ` · cod. ${p.codice_articolo}` : ""}
                        </p>
                        <button
                          onClick={() => setConfermaCoppia(confermaCoppia === chiave ? null : chiave)}
                          className="mt-2 rounded-md bg-neutral-900 px-2 py-1 text-xs text-white hover:bg-neutral-700"
                        >
                          Tieni questo, elimina l&apos;altro
                        </button>
                        {confermaCoppia === chiave && (
                          <div className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-900">
                            Sicuro? &quot;{altro.descrizione}&quot; verrà eliminato e il suo
                            storico spostato qui. Non è reversibile.
                            <div className="mt-1.5 flex gap-1.5">
                              <button
                                disabled={unendo}
                                onClick={() => unisci(p, altro)}
                                className="rounded-md bg-red-600 px-2 py-1 text-white hover:bg-red-700 disabled:opacity-50"
                              >
                                {unendo ? "Unione…" : "Conferma"}
                              </button>
                              <button
                                disabled={unendo}
                                onClick={() => setConfermaCoppia(null)}
                                className="rounded-md bg-white px-2 py-1 text-neutral-700 ring-1 ring-neutral-300"
                              >
                                Annulla
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={() => ignora(c)}
                  className="mt-2 text-xs text-neutral-400 hover:text-neutral-600"
                >
                  Non è un doppione, ignora
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
