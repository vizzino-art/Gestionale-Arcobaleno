"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PALETTE_COLORI_CATEGORIA } from "@/lib/colori-categorie";
import type { Categoria } from "@/lib/types";

type Props = {
  categorie: Categoria[];
  onAggiornata: (categoria: Categoria) => void;
  onChiudi: () => void;
};

export function ColoriCategorieModal({ categorie, onAggiornata, onChiudi }: Props) {
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  async function scegli(categoria: Categoria, colore: string | null) {
    setSalvandoId(categoria.id);
    setErrore(null);
    const supabase = createClient();
    const { error } = await supabase.from("categorie").update({ colore }).eq("id", categoria.id);
    setSalvandoId(null);
    if (error) {
      setErrore(`Errore nel salvataggio: ${error.message}`);
      return;
    }
    onAggiornata({ ...categoria, colore });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onChiudi}>
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Colori categorie</h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              Scegli un colore per ogni categoria: le righe dei prodotti di quella categoria
              useranno sempre quel colore in Pannello, Ordina e Riepilogo. Le categorie senza
              colore scelto continuano ad alternare i colori automaticamente come prima.
            </p>
          </div>
          <button onClick={onChiudi} className="shrink-0 text-neutral-400 hover:text-neutral-700">
            ✕
          </button>
        </div>

        {errore && <p className="mb-3 rounded-md bg-red-50 p-2 text-xs text-red-700">{errore}</p>}

        <div className="space-y-3">
          {categorie.length === 0 && <p className="text-sm text-neutral-500">Nessuna categoria a sistema.</p>}
          {categorie.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-3"
            >
              <span className="text-sm text-neutral-900">{c.nome}</span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => scegli(c, null)}
                  disabled={salvandoId === c.id}
                  title="Nessun colore (alternanza automatica)"
                  className={`flex h-6 w-6 items-center justify-center rounded-full border-2 bg-white text-[10px] leading-none text-neutral-400 ${
                    c.colore ? "border-neutral-300" : "border-neutral-900"
                  }`}
                >
                  ✕
                </button>
                {PALETTE_COLORI_CATEGORIA.map((colore) => (
                  <button
                    key={colore}
                    onClick={() => scegli(c, colore)}
                    disabled={salvandoId === c.id}
                    title={colore}
                    className={`h-6 w-6 rounded-full border-2 ${colore} ${
                      c.colore === colore ? "border-neutral-900" : "border-transparent"
                    }`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
