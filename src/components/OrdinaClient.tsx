"use client";

import { useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  calcolaOrdine,
  formattaDataBreve,
  formattaMessaggioWhatsApp,
  linkWhatsApp,
  prossimaConsegna,
  unitaMagazzino,
} from "@/lib/ordina";
import { mappaColoriCategorie } from "@/lib/colori-categorie";
import { classeRiquadroMagazzino } from "@/lib/tipo-conservazione";
import { ModificaProdottoModal } from "./ModificaProdottoModal";
import type { ProdottoConCategoria } from "./PannelloClient";
import type {
  Categoria,
  ConfrontoCategoria,
  Fornitore,
  StoricoProdotto,
} from "@/lib/types";

type Props = {
  fornitori: Fornitore[];
  prodottiIniziali: ProdottoConCategoria[];
  confronto: ConfrontoCategoria[];
  storico: StoricoProdotto[];
  categorie: Categoria[];
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

export function OrdinaClient({ fornitori, prodottiIniziali, confronto, storico, categorie }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [prodotti, setProdotti] = useState<ProdottoConCategoria[]>(prodottiIniziali);
  const [fornitoreId, setFornitoreId] = useState<string | undefined>(fornitori[0]?.id);
  const [statoSalvataggio, setStatoSalvataggio] = useState<Record<string, StatoSalvataggio>>({});
  const [copiato, setCopiato] = useState(false);
  const [ricerca, setRicerca] = useState("");
  const [modaleModifica, setModaleModifica] = useState<ProdottoConCategoria | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const coloriCategorie = useMemo(() => mappaColoriCategorie(categorie), [categorie]);

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

  // Solo un filtro visivo per trovare subito un prodotto: l'ordine reale
  // (frecce ▲▼), il messaggio WhatsApp e le quantità restano calcolati su
  // TUTTI i prodotti del fornitore, ricerca attiva o no — la ricerca non
  // esclude nulla dall'ordine, serve solo a scorrere meno per trovarlo.
  const ricercaAttiva = ricerca.trim().length > 0;
  const prodottiVisualizzati = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    if (!q) return prodottiFornitore;
    return prodottiFornitore.filter(
      (p) =>
        p.descrizione.toLowerCase().includes(q) ||
        (p.codice_articolo ?? "").toLowerCase().includes(q)
    );
  }, [prodottiFornitore, ricerca]);

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

  // L'obiettivo cambia raramente (a differenza del magazzino, che si
  // aggiorna spesso): per evitare modifiche accidentali toccandolo per
  // sbaglio, prima chiede conferma e solo poi apre il popup per il nuovo
  // valore, invece di essere un campo sempre pronto a scrivere come Magazzino.
  function modificaObiettivo(p: ProdottoConCategoria) {
    const unita = unitaMagazzino(p);
    const vuoleModificare = window.confirm(
      `Obiettivo attuale di "${p.descrizione}": ${p.quantita_obiettivo ?? "—"} ${unita}.\n\nVuoi modificarlo?`
    );
    if (!vuoleModificare) return;

    const valore = window.prompt(
      `Nuovo obiettivo per "${p.descrizione}"${unita ? ` (${unita})` : ""}:`,
      p.quantita_obiettivo != null ? String(p.quantita_obiettivo) : ""
    );
    if (valore === null) return; // annullato

    aggiornaCampo(p.id, "quantita_obiettivo", valore.trim());
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

  // Sposta il prodotto oltre l'ultimo della lista del fornitore corrente —
  // persistito come le frecce ▲▼ (resta così anche ricaricando la pagina),
  // per togliersi dagli occhi durante l'ordine ciò che si è già controllato,
  // senza dover scorrere uno per uno con le frecce fino in fondo.
  async function mandaInFondo(prodottoId: string) {
    const massimo = prodottiFornitore.reduce((m, p) => Math.max(m, p.ordine), 0);
    const nuovoOrdine = massimo + 1;

    setProdotti((prev) =>
      prev.map((p) => (p.id === prodottoId ? { ...p, ordine: nuovoOrdine } : p))
    );

    await supabase.from("prodotti").update({ ordine: nuovoOrdine }).eq("id", prodottoId);
  }

  function prodottoSalvato(p: ProdottoConCategoria) {
    setProdotti((prev) =>
      // Se la modifica ha disattivato il prodotto, sparisce subito
      // dall'ordine in corso (qui vengono mostrati solo i prodotti attivi).
      p.attivo ? prev.map((x) => (x.id === p.id ? p : x)) : prev.filter((x) => x.id !== p.id)
    );
    setModaleModifica(null);
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
            onClick={() => {
              setFornitoreId(f.id);
              setRicerca("");
            }}
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

      {prodottiFornitore.length > 0 && (
        <input
          type="text"
          value={ricerca}
          onChange={(e) => setRicerca(e.target.value)}
          placeholder="🔍 Cerca per nome o codice articolo…"
          className="mb-3 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      )}

      {ricercaAttiva && (
        <p className="mb-2 text-xs text-neutral-400">
          Ricerca attiva: le frecce per riordinare sono disattivate finché non la cancelli.
        </p>
      )}

      {prodottiFornitore.length === 0 && (
        <p className="text-sm text-neutral-500">Nessun prodotto attivo per questo fornitore.</p>
      )}

      {prodottiFornitore.length > 0 && prodottiVisualizzati.length === 0 && (
        <p className="text-sm text-neutral-500">Nessun prodotto trovato per &quot;{ricerca}&quot;.</p>
      )}

      <div className="space-y-2">
        {prodottiVisualizzati.map((p, i) => {
          const riga = calcolaOrdine(p);
          const propria = confrontoByProdotto.get(p.id);
          const migliore = p.categoria_id ? migliorPerCategoria.get(p.categoria_id) : undefined;
          const nonConviene =
            propria && migliore && propria.posizione !== 1 && migliore.fornitore_id !== p.fornitore_id;
          const conviene = propria && propria.posizione === 1;
          const st = storicoByProdotto.get(p.id);
          const stato = statoSalvataggio[p.id];
          const coloreCategoria = p.categoria_id ? coloriCategorie.get(p.categoria_id) : undefined;
          const colore = coloreCategoria ?? COLORI_RIGA[i % COLORI_RIGA.length];
          const unita = unitaMagazzino(p);

          return (
            <div
              key={p.id}
              className="flex items-stretch overflow-hidden rounded-xl border border-neutral-200"
            >
              {/* Blocco Magazzino: frecce di ordinamento + campo magazzino,
                  un blocco a sé, colorato per Fresco/Gelo/Ambiente — di
                  proposito staccato dal blocco prodotto (colorato per
                  categoria) invece di un'etichetta colorata dentro la riga,
                  per non mischiare i due colori. */}
              <div
                className={`flex shrink-0 items-center gap-1.5 p-2 ${classeRiquadroMagazzino(p.tipo_conservazione)}`}
              >
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => spostaProdotto(p.id, "su")}
                    disabled={ricercaAttiva || i === 0}
                    aria-label="Sposta su"
                    className="rounded px-1.5 py-1 text-neutral-500 hover:bg-white/70 hover:text-neutral-800 disabled:opacity-20"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => spostaProdotto(p.id, "giu")}
                    disabled={ricercaAttiva || i === prodottiFornitore.length - 1}
                    aria-label="Sposta giù"
                    className="rounded px-1.5 py-1 text-neutral-500 hover:bg-white/70 hover:text-neutral-800 disabled:opacity-20"
                  >
                    ▼
                  </button>
                </div>

                <label className="text-center text-[10px] leading-tight text-neutral-600">
                  Magazzino{unita && ` (${unita})`}
                  <input
                    type="number"
                    step="any"
                    defaultValue={p.magazzino_attuale ?? ""}
                    onChange={(e) => aggiornaCampo(p.id, "magazzino_attuale", e.target.value)}
                    className="mt-1 block w-14 rounded-md border border-white/70 bg-white/80 px-1 py-2 text-center text-sm text-neutral-900 outline-none focus:border-neutral-500"
                  />
                </label>
              </div>

              {/* Blocco prodotto: colorato per categoria, come prima. */}
              <div className={`flex flex-1 items-start gap-2 p-3 ${colore}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-neutral-900">{p.descrizione}</p>
                    <div className="flex shrink-0 items-center gap-1">
                      {stato && (
                        <span className="text-[10px] text-neutral-400">
                          {stato === "salvando" ? "salvataggio…" : "✓ salvato"}
                        </span>
                      )}
                      <button
                        onClick={() => setModaleModifica(p)}
                        title="Modifica prodotto"
                        className="rounded-md bg-white/70 px-1.5 py-1 text-xs hover:bg-white"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => mandaInFondo(p.id)}
                        title="Manda in fondo alla lista (finché non lo sposti tu)"
                        className="rounded-md bg-white/70 px-1.5 py-1 text-xs hover:bg-white"
                      >
                        ⬇
                      </button>
                    </div>
                  </div>

                  {riga && (
                    <p className="mt-1 text-sm font-medium text-neutral-900">
                      Ordina: {arrotonda(riga.quantitaOrdine)} {riga.unitaMostrata}
                      {riga.quantitaOmaggio > 0 && (
                        <span className="text-green-700"> (+{arrotonda(riga.quantitaOmaggio)} omaggio)</span>
                      )}
                    </p>
                  )}

                  {conviene && (
                    <p className="mt-1 text-xs text-green-700">✓ È il più conveniente in questa categoria</p>
                  )}
                  {nonConviene && migliore && (
                    <p className="mt-1 text-xs text-amber-700">
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

                {/* Obiettivo: cambia quasi mai, quindi è solo testo — tap apre
                    conferma + popup di modifica invece di un campo sempre editabile. */}
                <button
                  onClick={() => modificaObiettivo(p)}
                  title="Tocca per modificare l'obiettivo"
                  className="shrink-0 rounded-md px-2 py-1.5 text-right text-[10px] leading-tight text-neutral-500 hover:bg-white/70"
                >
                  Obiettivo
                  <br />
                  <span className="text-sm font-medium text-neutral-800">
                    {p.quantita_obiettivo ?? "—"}
                  </span>
                  {unita && <span> {unita}</span>}
                </button>
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

      {modaleModifica && fornitoreId && (
        <ModificaProdottoModal
          fornitoreId={fornitoreId}
          categorie={categorie}
          prodotto={modaleModifica}
          prodottiFornitore={prodottiFornitore}
          onSalvato={prodottoSalvato}
          onChiudi={() => setModaleModifica(null)}
        />
      )}
    </div>
  );
}
