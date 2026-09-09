"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Fornitore, Prodotto } from "@/lib/types";

export type ProdottoConCategoria = Prodotto & { categorie: { nome: string } | null };

type RigaStorico = {
  id: string;
  data: string;
  numero_fattura: string | null;
  prezzo: number;
  quantita: number | null;
};

type Props = {
  fornitori: Fornitore[];
  prodotti: ProdottoConCategoria[];
};

export function PannelloClient({ fornitori, prodotti }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [fornitoreId, setFornitoreId] = useState<string | undefined>(fornitori[0]?.id);
  const [modaleProdotto, setModaleProdotto] = useState<ProdottoConCategoria | null>(null);
  const [storico, setStorico] = useState<RigaStorico[]>([]);
  const [caricando, setCaricando] = useState(false);

  const prodottiFornitore = useMemo(
    () =>
      prodotti
        .filter((p) => p.fornitore_id === fornitoreId)
        .sort((a, b) => a.ordine - b.ordine),
    [prodotti, fornitoreId]
  );

  async function apriStorico(p: ProdottoConCategoria) {
    setModaleProdotto(p);
    setCaricando(true);
    const { data } = await supabase
      .from("storico_prezzi_fatture")
      .select("id, data, numero_fattura, prezzo, quantita")
      .eq("prodotto_id", p.id)
      .gt("prezzo", 0)
      .order("data", { ascending: true })
      .order("created_at", { ascending: true });
    setStorico((data ?? []) as RigaStorico[]);
    setCaricando(false);
  }

  function chiudiStorico() {
    setModaleProdotto(null);
    setStorico([]);
  }

  return (
    <div>
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-neutral-200 pb-2">
        {fornitori.map((f) => (
          <button
            key={f.id}
            onClick={() => setFornitoreId(f.id)}
            className={`shrink-0 rounded-md px-3 py-1.5 text-sm ${
              f.id === fornitoreId ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            {f.nome}
          </button>
        ))}
      </div>

      {prodottiFornitore.length === 0 && (
        <p className="text-sm text-neutral-500">Nessun prodotto attivo per questo fornitore.</p>
      )}

      <div className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
        {prodottiFornitore.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-4 p-3">
            <div>
              <p className="text-sm font-medium text-neutral-900">{p.descrizione}</p>
              <p className="text-xs text-neutral-500">
                {p.categorie?.nome ?? "senza categoria"} · €{p.prezzo_unitario?.toFixed(2) ?? "—"} /{p.um ?? "—"}
              </p>
            </div>
            <button
              onClick={() => apriStorico(p)}
              className="shrink-0 rounded-md px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100"
              title="Storico prezzi"
            >
              📈 Storico
            </button>
          </div>
        ))}
      </div>

      {modaleProdotto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={chiudiStorico}
        >
          <div
            className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-4">
              <h2 className="text-sm font-semibold text-neutral-900">{modaleProdotto.descrizione}</h2>
              <button onClick={chiudiStorico} className="text-neutral-400 hover:text-neutral-700">
                ✕
              </button>
            </div>

            {caricando && <p className="text-sm text-neutral-500">Caricamento…</p>}

            {!caricando && storico.length === 0 && (
              <p className="text-sm text-neutral-500">Nessuna fattura storica per questo prodotto.</p>
            )}

            {!caricando && storico.length > 0 && (
              <div className="divide-y divide-neutral-100">
                {storico.map((r, i) => {
                  // "data" qui è la fattura del mese del fornitore, non un giorno preciso:
                  // più righe possono condividere la stessa data con prezzi diversi (consegne
                  // diverse nello stesso mese). La freccia ha senso solo tra un mese e il
                  // successivo (confrontando l'ultimo prezzo di ciascun mese), non tra righe
                  // dello stesso mese, il cui ordine reciproco non è affidabile.
                  const ultimaRigaDelMese = i === storico.length - 1 || storico[i + 1].data !== r.data;
                  let differenza: number | null = null;
                  if (ultimaRigaDelMese) {
                    let j = i - 1;
                    while (j >= 0 && storico[j].data === r.data) j--;
                    if (j >= 0) differenza = r.prezzo - storico[j].prezzo;
                  }
                  return (
                    <div key={r.id} className="flex items-center justify-between py-2 text-sm">
                      <div>
                        <p className="text-neutral-900">
                          {new Date(r.data).toLocaleDateString("it-IT")}
                          {r.numero_fattura && <span className="text-neutral-400"> · {r.numero_fattura}</span>}
                        </p>
                        {r.quantita != null && <p className="text-xs text-neutral-400">Qtà {r.quantita}</p>}
                      </div>
                      <p className="font-medium text-neutral-900">
                        €{r.prezzo.toFixed(2)}
                        {differenza != null && differenza > 0 && <span className="ml-1 text-red-600">▲</span>}
                        {differenza != null && differenza < 0 && <span className="ml-1 text-green-600">▼</span>}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
