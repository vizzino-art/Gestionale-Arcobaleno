"use client";

import { useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  calcolaOrdine,
  formattaDataBreve,
  formattaMessaggioWhatsApp,
  linkWhatsApp,
  prossimaConsegna,
} from "@/lib/ordina";
import type {
  ConfrontoCategoria,
  Fornitore,
  Prodotto,
  StoricoProdotto,
} from "@/lib/types";

type Props = {
  fornitori: Fornitore[];
  prodottiIniziali: Prodotto[];
  confronto: ConfrontoCategoria[];
  storico: StoricoProdotto[];
};

type StatoSalvataggio = "salvando" | "salvato" | null;

function arrotonda(n: number): number {
  return Math.round(n * 100) / 100;
}

// Colori tenui che si alternano riga per riga (tema "arcobaleno", ma smorzato)
// per distinguere a colpo d'occhio un prodotto dal successivo nell'elenco.
const COLORI_RIGA = [
  "bg-red-100",
  "bg-orange-100",
  "bg-amber-100",
  "bg-lime-100",
  "bg-sky-100",
  "bg-violet-100",
];

export function OrdinaClient({ fornitori, prodottiIniziali, confronto, storico }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [prodotti, setProdotti] = useState<Prodotto[]>(prodottiIniziali);
  const [fornitoreId, setFornitoreId] = useState<string | undefined>(fornitori[0]?.id);
  const [statoSalvataggio, setStatoSalvataggio] = useState<Record<string, StatoSalvataggio>>({});
  const [copiato, setCopiato] = useState(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const confrontoByProdotto = useMemo(() => {
    const m = new Map<string, ConfrontoCategoria>();
    for (const r of confronto) m.set(r.prodotto_id, r);
    return m;
  }, [confronto]);

  const migliorPerCategoria = useMemo(() => {
    const m = new Map<string, ConfrontoCategoria>();
    for (const r of confronto) if (r.posizione === 1) m.set(r.categoria_id, r);
    return m;
  }, [confronto]);

  const storicoByProdotto = useMemo(() => {
    const m = new Map<string, StoricoProdotto>();
    for (const s of storico) m.set(s.prodotto_id, s);
    return m;
  }, [storico]);

  const prodottiFornitore = useMemo(
    () =>
      prodotti
        .filter((p) => p.fornitore_id === fornitoreId)
        // Ordine personalizzato (frecce ▲▼); a parità di "ordine" (può
        // succedere sui dati migrati) l'ordine alfabetico rende il
        // risultato stabile invece di dipendere da un ordine casuale.
        .sort((a, b) => a.ordine - b.ordine || a.descrizione.localeCompare(b.descrizione, "it")),
    [prodotti, fornitoreId]
  );

  const fornitore = fornitori.find((f) => f.id === fornitoreId);

  const righeOrdine = useMemo(
    () => prodottiFornitore.map((p) => calcolaOrdine(p)).filter((r) => r !== null),
    [prodottiFornitore]
  );

  const testoWhatsApp = useMemo(() => {
    if (!fornitore || righeOrdine.length === 0) return "";
    return formattaMessaggioWhatsApp(fornitore.nome, fornitore.giorno_consegna, righeOrdine);
  }, [fornitore, righeOrdine]);

  function aggiornaCampo(prodottoId: string, campo: "quantita_obiettivo" | "magazzino_attuale", valore: string) {
    const numero = valore === "" ? null : Number(valore);
    setProdotti((prev) =>
      prev.map((p) => (p.id === prodottoId ? { ...p, [campo]: numero } : p))
    );

    setStatoSalvataggio((s) => ({ ...s, [prodottoId]: "salvando" }));
    if (timers.current[prodottoId]) clearTimeout(timers.current[prodottoId]);
    timers.current[prodottoId] = setTimeout(async () => {
      const { error } = await supabase
        .from("prodotti")
        .update({ [campo]: numero })
        .eq("id", prodottoId);
      setStatoSalvataggio((s) => ({ ...s, [prodottoId]: error ? null : "salvato" }));
      if (!error) {
        setTimeout(() => setStatoSalvataggio((s) => ({ ...s, [prodottoId]: null })), 1500);
      }
    }, 700);
  }

  async function spostaProdotto(prodottoId: string, direzione: "su" | "giu") {
    const idx = prodottiFornitore.findIndex((p) => p.id === prodottoId);
    const altroIdx = direzione === "su" ? idx - 1 : idx + 1;
    if (idx === -1 || altroIdx < 0 || altroIdx >= prodottiFornitore.length) return;

    const a = prodottiFornitore[idx];
    const b = prodottiFornitore[altroIdx];
    const ordineA = a.ordine;
    const ordineB = b.ordine;

    setProdotti((prev) =>
      prev.map((p) => {
        if (p.id === a.id) return { ...p, ordine: ordineB };
        if (p.id === b.id) return { ...p, ordine: ordineA };
        return p;
      })
    );

    await Promise.all([
      supabase.from("prodotti").update({ ordine: ordineB }).eq("id", a.id),
      supabase.from("prodotti").update({ ordine: ordineA }).eq("id", b.id),
    ]);
  }

  async function copiaMessaggio() {
    await navigator.clipboard.writeText(testoWhatsApp);
    setCopiato(true);
    setTimeout(() => setCopiato(false), 1500);
  }

  return (
    <div>
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-neutral-200 pb-2">
        {fornitori.map((f) => (
          <button
            key={f.id}
            onClick={() => setFornitoreId(f.id)}
            className={`shrink-0 rounded-md px-3 py-2.5 text-sm ${
              f.id === fornitoreId
                ? "bg-neutral-900 text-white"
                : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            {f.nome}
          </button>
        ))}
      </div>

      {prodottiFornitore.length === 0 && (
        <p className="text-sm text-neutral-500">Nessun prodotto attivo per questo fornitore.</p>
      )}

      <div className="space-y-2">
        {prodottiFornitore.map((p, i) => {
          const riga = calcolaOrdine(p);
          const propria = confrontoByProdotto.get(p.id);
          const migliore = p.categoria_id ? migliorPerCategoria.get(p.categoria_id) : undefined;
          const nonConviene =
            propria && migliore && propria.posizione !== 1 && migliore.fornitore_id !== p.fornitore_id;
          const conviene = propria && propria.posizione === 1;
          const st = storicoByProdotto.get(p.id);
          const stato = statoSalvataggio[p.id];
          const colore = COLORI_RIGA[i % COLORI_RIGA.length];

          return (
            <div
              key={p.id}
              className={`flex gap-3 rounded-xl border border-neutral-200 p-3 ${colore}`}
            >
              <div className="flex shrink-0 flex-col gap-0.5 pt-0.5">
                <button
                  onClick={() => spostaProdotto(p.id, "su")}
                  disabled={i === 0}
                  aria-label="Sposta su"
                  className="rounded px-1.5 py-1 text-neutral-400 hover:bg-white/70 hover:text-neutral-700 disabled:opacity-20"
                >
                  ▲
                </button>
                <button
                  onClick={() => spostaProdotto(p.id, "giu")}
                  disabled={i === prodottiFornitore.length - 1}
                  aria-label="Sposta giù"
                  className="rounded px-1.5 py-1 text-neutral-400 hover:bg-white/70 hover:text-neutral-700 disabled:opacity-20"
                >
                  ▼
                </button>
              </div>

              <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-start justify-between gap-4">
                <p className="text-sm font-medium text-neutral-900">{p.descrizione}</p>
                {stato && (
                  <span className="shrink-0 text-xs text-neutral-400">
                    {stato === "salvando" ? "salvataggio…" : "✓ salvato"}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-end gap-4">
                <label className="text-xs text-neutral-500">
                  Obiettivo ({p.um ?? "—"})
                  <input
                    type="number"
                    step="any"
                    defaultValue={p.quantita_obiettivo ?? ""}
                    onChange={(e) => aggiornaCampo(p.id, "quantita_obiettivo", e.target.value)}
                    className="mt-1 block w-24 rounded-md border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-neutral-500"
                  />
                </label>
                <label className="text-xs text-neutral-500">
                  Magazzino ({p.um ?? "—"})
                  <input
                    type="number"
                    step="any"
                    defaultValue={p.magazzino_attuale ?? ""}
                    onChange={(e) => aggiornaCampo(p.id, "magazzino_attuale", e.target.value)}
                    className="mt-1 block w-24 rounded-md border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-neutral-500"
                  />
                </label>

                {riga && (
                  <p className="text-sm font-medium text-neutral-900">
                    Ordina: {arrotonda(riga.quantitaOrdine)} {riga.unitaMostrata}
                    {riga.quantitaOmaggio > 0 && (
                      <span className="text-green-700"> (+{arrotonda(riga.quantitaOmaggio)} omaggio)</span>
                    )}
                  </p>
                )}
              </div>

              {conviene && (
                <p className="mt-2 text-xs text-green-700">✓ È il più conveniente in questa categoria</p>
              )}
              {nonConviene && migliore && (
                <p className="mt-2 text-xs text-amber-700">
                  In questa categoria conviene {migliore.fornitore_nome} (€{migliore.prezzo_per_kg?.toFixed(2)}/kg
                  {propria?.prezzo_per_kg != null && ` contro €${propria.prezzo_per_kg.toFixed(2)}/kg qui`})
                </p>
              )}
              {st && (
                <p className="mt-1 text-xs text-neutral-500">
                  Ultimo pagato: €{st.ultimo_pagato.toFixed(2)} ({new Date(st.ultimo_pagato_data).toLocaleDateString("it-IT")}) · Minimo: €
                  {st.prezzo_minimo.toFixed(2)}
                </p>
              )}
              </div>
            </div>
          );
        })}
      </div>

      {fornitore && righeOrdine.length > 0 && (
        <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium text-neutral-900">
              Messaggio ordine — {fornitore.nome}
              {fornitore.giorno_consegna &&
                ` (consegna ${formattaDataBreve(prossimaConsegna(fornitore.giorno_consegna))})`}
            </h2>
          </div>
          <textarea
            readOnly
            value={testoWhatsApp}
            rows={Math.min(righeOrdine.length + 3, 12)}
            className="mb-3 w-full resize-none rounded-lg border border-neutral-300 bg-white p-3 text-sm text-neutral-700"
          />
          <div className="flex gap-2">
            <button
              onClick={copiaMessaggio}
              className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              {copiato ? "Copiato ✓" : "Copia messaggio"}
            </button>
            {fornitore.telefono && (
              <a
                href={linkWhatsApp(fornitore.telefono, testoWhatsApp)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                Apri in WhatsApp
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
