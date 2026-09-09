"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ModificaProdottoModal } from "./ModificaProdottoModal";
import type { Categoria, Fornitore, Prodotto } from "@/lib/types";

export type ProdottoConCategoria = Prodotto & { categorie: { nome: string } | null };

// Stessa tavolozza tenue usata in Ordina, per coerenza visiva tra le pagine.
const COLORI_RIGA = [
  "bg-red-100",
  "bg-orange-100",
  "bg-amber-100",
  "bg-lime-100",
  "bg-sky-100",
  "bg-violet-100",
];

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
  categorie: Categoria[];
};

export function PannelloClient({ fornitori, prodotti: prodottiIniziali, categorie }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [prodotti, setProdotti] = useState<ProdottoConCategoria[]>(prodottiIniziali);
  const [fornitoreId, setFornitoreId] = useState<string | undefined>(fornitori[0]?.id);
  const [modaleProdotto, setModaleProdotto] = useState<ProdottoConCategoria | null>(null);
  const [storico, setStorico] = useState<RigaStorico[]>([]);
  const [caricando, setCaricando] = useState(false);
  const [modaleModifica, setModaleModifica] = useState<
    { modo: "nuovo" } | { modo: "modifica"; prodotto: ProdottoConCategoria } | null
  >(null);

  const prodottiFornitore = useMemo(
    () =>
      prodotti
        .filter((p) => p.fornitore_id === fornitoreId)
        // I prodotti disattivati vanno in fondo (restano comunque visibili e
        // modificabili qui, per poterli riattivare in futuro se il prezzo
        // torna conveniente). A parità, tiebreak su "ordine" e poi
        // alfabetico (alcuni prodotti migrati condividono lo stesso valore).
        .sort(
          (a, b) =>
            Number(a.attivo === false) - Number(b.attivo === false) ||
            a.ordine - b.ordine ||
            a.descrizione.localeCompare(b.descrizione, "it")
        ),
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

  function prodottoSalvato(p: ProdottoConCategoria) {
    setProdotti((prev) => {
      const esiste = prev.some((x) => x.id === p.id);
      return esiste ? prev.map((x) => (x.id === p.id ? p : x)) : [...prev, p];
    });
    setModaleModifica(null);
  }

  return (
    <div>
      <div className="mb-3 flex gap-1 overflow-x-auto border-b border-neutral-200 pb-2">
        {fornitori.map((f) => (
          <button
            key={f.id}
            onClick={() => setFornitoreId(f.id)}
            className={`shrink-0 rounded-md px-3 py-2.5 text-sm ${
              f.id === fornitoreId ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            {f.nome}
          </button>
        ))}
      </div>

      {fornitoreId && (
        <div className="mb-3 flex justify-end">
          <button
            onClick={() => setModaleModifica({ modo: "nuovo" })}
            className="shrink-0 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            + Nuovo prodotto
          </button>
        </div>
      )}

      {prodottiFornitore.length === 0 && (
        <p className="text-sm text-neutral-500">Nessun prodotto per questo fornitore.</p>
      )}

      <div className="space-y-2">
        {prodottiFornitore.map((p, i) => {
          const colore = COLORI_RIGA[i % COLORI_RIGA.length];
          return (
            <div
              key={p.id}
              className={`flex items-center justify-between gap-4 rounded-xl border border-neutral-200 p-3 ${
                p.attivo ? colore : "bg-neutral-100 opacity-60"
              }`}
            >
              <div>
                <p className="text-sm font-medium text-neutral-900">
                  {p.descrizione}
                  {!p.attivo && <span className="ml-2 text-xs text-neutral-500">(disattivato)</span>}
                </p>
                <p className="text-xs text-neutral-500">
                  {p.categorie?.nome ?? "senza categoria"} · €{p.prezzo_unitario?.toFixed(2) ?? "—"} /{p.um ?? "—"}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => setModaleModifica({ modo: "modifica", prodotto: p })}
                  className="rounded-md bg-white/70 px-3 py-2 text-sm text-neutral-500 hover:bg-white"
                  title="Modifica prodotto"
                >
                  ✏️ Modifica
                </button>
                <button
                  onClick={() => apriStorico(p)}
                  className="rounded-md bg-white/70 px-3 py-2 text-sm text-neutral-500 hover:bg-white"
                  title="Storico prezzi"
                >
                  📈 Storico
                </button>
              </div>
            </div>
          );
        })}
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

      {modaleModifica && fornitoreId && (
        <ModificaProdottoModal
          fornitoreId={fornitoreId}
          categorie={categorie}
          prodotto={modaleModifica.modo === "modifica" ? modaleModifica.prodotto : null}
          prodottiFornitore={prodottiFornitore}
          onSalvato={prodottoSalvato}
          onChiudi={() => setModaleModifica(null)}
        />
      )}
    </div>
  );
}
