"use client";

import { useMemo, useState } from "react";
import { ModificaDittaModal } from "./ModificaDittaModal";
import type { Controparte } from "@/lib/types";

type Props = {
  ditteIniziali: Controparte[];
};

export function DitteClient({ ditteIniziali }: Props) {
  const [ditte, setDitte] = useState<Controparte[]>(ditteIniziali);
  const [ricerca, setRicerca] = useState("");
  const [modale, setModale] = useState<{ modo: "nuovo" } | { modo: "modifica"; ditta: Controparte } | null>(
    null
  );

  const ditteVisualizzate = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    if (q === "") return ditte;
    return ditte.filter(
      (d) =>
        d.nome.toLowerCase().includes(q) ||
        (d.piva ?? "").toLowerCase().includes(q) ||
        (d.citta ?? "").toLowerCase().includes(q)
    );
  }, [ditte, ricerca]);

  function dittaSalvata(d: Controparte) {
    setDitte((prev) => {
      const esiste = prev.some((x) => x.id === d.id);
      const aggiornate = esiste ? prev.map((x) => (x.id === d.id ? d : x)) : [...prev, d];
      return [...aggiornate].sort((a, b) => a.nome.localeCompare(b.nome, "it"));
    });
    setModale(null);
  }

  return (
    <div>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          value={ricerca}
          onChange={(e) => setRicerca(e.target.value)}
          placeholder="🔍 Cerca per nome, P.IVA o città…"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm sm:max-w-sm"
        />
        <button
          onClick={() => setModale({ modo: "nuovo" })}
          className="shrink-0 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          + Nuova ditta
        </button>
      </div>

      <p className="mb-2 text-xs text-neutral-400">
        {ditteVisualizzate.length} di {ditte.length} ditte
      </p>

      {ditteVisualizzate.length === 0 && (
        <p className="text-sm text-neutral-500">Nessuna ditta trovata per &quot;{ricerca}&quot;.</p>
      )}

      <div className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
        {ditteVisualizzate.map((d) => (
          <div key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-neutral-900">{d.nome}</p>
              <p className="truncate text-sm text-neutral-500">
                {[d.piva, d.citta].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>
            <button
              onClick={() => setModale({ modo: "modifica", ditta: d })}
              className="shrink-0 rounded-md bg-neutral-100 px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-200"
              title="Modifica ditta"
            >
              ✏️ Modifica
            </button>
          </div>
        ))}
      </div>

      {modale && (
        <ModificaDittaModal
          ditta={modale.modo === "modifica" ? modale.ditta : null}
          onSalvato={dittaSalvata}
          onChiudi={() => setModale(null)}
        />
      )}
    </div>
  );
}
