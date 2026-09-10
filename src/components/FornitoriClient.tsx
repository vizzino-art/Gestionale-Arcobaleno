"use client";

import { useState } from "react";
import { ModificaFornitoreModal } from "./ModificaFornitoreModal";
import type { Fornitore } from "@/lib/types";

type Props = {
  fornitoriIniziali: Fornitore[];
};

export function FornitoriClient({ fornitoriIniziali }: Props) {
  const [fornitori, setFornitori] = useState<Fornitore[]>(fornitoriIniziali);
  const [modale, setModale] = useState<{ modo: "nuovo" } | { modo: "modifica"; fornitore: Fornitore } | null>(
    null
  );

  function fornitoreSalvato(f: Fornitore) {
    setFornitori((prev) => {
      const esiste = prev.some((x) => x.id === f.id);
      return esiste ? prev.map((x) => (x.id === f.id ? f : x)) : [...prev, f];
    });
    setModale(null);
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button
          onClick={() => setModale({ modo: "nuovo" })}
          className="shrink-0 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          + Nuovo fornitore
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fornitori.map((f) => (
          <div
            key={f.id}
            className="flex flex-col justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4"
          >
            <div>
              <p className="font-medium text-neutral-900">{f.nome}</p>
              <p className="mt-1 text-sm text-neutral-500">{f.telefono ?? "—"}</p>
              <p className="text-sm text-neutral-500">{f.email ?? "—"}</p>
            </div>
            <button
              onClick={() => setModale({ modo: "modifica", fornitore: f })}
              className="shrink-0 self-start rounded-md bg-neutral-100 px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-200"
              title="Modifica fornitore"
            >
              ✏️ Modifica
            </button>
          </div>
        ))}
      </div>

      {modale && (
        <ModificaFornitoreModal
          fornitori={fornitori}
          fornitore={modale.modo === "modifica" ? modale.fornitore : null}
          onSalvato={fornitoreSalvato}
          onChiudi={() => setModale(null)}
        />
      )}
    </div>
  );
}
