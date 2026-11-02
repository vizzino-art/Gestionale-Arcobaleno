"use client";

import { useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { calcolaOrdine, unitaMagazzino } from "@/lib/ordina";
import { mappaColoriCategorie } from "@/lib/colori-categorie";
import { classeRiquadroMagazzino } from "@/lib/tipo-conservazione";
import { ModificaProdottoModal } from "./ModificaProdottoModal";
import type { ProdottoConCategoria } from "./PannelloClient";
import type { Categoria, ConfrontoCategoria, Fornitore, StoricoProdotto } from "@/lib/types";

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

// Stessa tavolozza di ripiego di Ordina/Riepilogo, per coerenza visiva.
const COLORI_RIGA = [
  "bg-red-100",
  "bg-orange-100",
  "bg-amber-100",
  "bg-lime-100",
  "bg-sky-100",
  "bg-violet-100",
];

// Pagina "Giro" (30/10): tutti i prodotti attivi di tutti i fornitori
// insieme, in UN SOLO ordine che Mauro decide (il giro fisico che fa nel
// locale) invece che diviso per fornitore come in Ordina. Ordina resta
// com'è, invariata — questa è solo un'altra vista sugli stessi dati, utile
// per aggiornare il Magazzino mentre si cammina senza dover cambiare tab
// fornitore ogni volta. Il messaggio WhatsApp resta solo in Riepilogo.
export function GiroClient({ fornitori, prodottiIniziali, confronto, storico, categorie }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [prodotti, setProdotti] = useState<ProdottoConCategoria[]>(prodottiIniziali);
  const [statoSalvataggio, setStatoSalvataggio] = useState<Record<string, StatoSalvataggio>>({});
  const [ricerca, setRicerca] = useState("");
  const [modaleModifica, setModaleModifica] = useState<ProdottoConCategoria | null>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const magazzinoRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const coloriCategorie = useMemo(() => mappaColoriCategorie(categorie), [categorie]);

  const fornitoreNomeDi = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of fornitori) m.set(f.id, f.nome);
    return m;
  }, [fornitori]);

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

  // Ordine del Giro: campo dedicato "ordine_giro" (separato da "ordine", che
  // resta solo per le frecce dentro le tab per fornitore di Ordina) — vedi
  // nota su src/lib/types.ts. A parità di valore, alfabetico per stabilità.
  const prodottiGiro = useMemo(
    () =>
      [...prodotti].sort(
        (a, b) => (a.ordine_giro ?? 0) - (b.ordine_giro ?? 0) || a.descrizione.localeCompare(b.descrizione, "it")
      ),
    [prodotti]
  );

  const ricercaAttiva = ricerca.trim().length > 0;
  const prodottiVisualizzati = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    if (!q) return prodottiGiro;
    return prodottiGiro.filter(
      (p) =>
        p.descrizione.toLowerCase().includes(q) ||
        (p.codice_articolo ?? "").toLowerCase().includes(q) ||
        (fornitoreNomeDi.get(p.fornitore_id) ?? "").toLowerCase().includes(q)
    );
  }, [prodottiGiro, ricerca, fornitoreNomeDi]);

  function aggiornaCampo(prodottoId: string, campo: "quantita_obiettivo" | "magazzino_attuale", valore: string) {
    const pulito = valore.trim().replace(",", ".");
    const numero = pulito === "" ? null : Number(pulito);
    if (numero !== null && Number.isNaN(numero)) return;

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
    if (valore === null) return;

    aggiornaCampo(p.id, "quantita_obiettivo", valore.trim());
  }

  // Frecce ▲▼: scambiano "ordine_giro" tra prodotti adiacenti nell'elenco
  // GLOBALE (tutti i fornitori insieme) — a differenza di Ordina, dove le
  // frecce scambiano "ordine" solo dentro la tab del fornitore corrente.
  async function spostaProdotto(prodottoId: string, direzione: "su" | "giu") {
    const idx = prodottiGiro.findIndex((p) => p.id === prodottoId);
    const altroIdx = direzione === "su" ? idx - 1 : idx + 1;
    if (idx === -1 || altroIdx < 0 || altroIdx >= prodottiGiro.length) return;

    const a = prodottiGiro[idx];
    const b = prodottiGiro[altroIdx];
    const ordineA = a.ordine_giro ?? 0;
    const ordineB = b.ordine_giro ?? 0;

    setProdotti((prev) =>
      prev.map((p) => {
        if (p.id === a.id) return { ...p, ordine_giro: ordineB };
        if (p.id === b.id) return { ...p, ordine_giro: ordineA };
        return p;
      })
    );

    await Promise.all([
      supabase.from("prodotti").update({ ordine_giro: ordineB }).eq("id", a.id),
      supabase.from("prodotti").update({ ordine_giro: ordineA }).eq("id", b.id),
    ]);
  }

  // Salto diretto a una posizione (30/10, richiesto da Mauro dopo aver
  // provato le sole frecce su centinaia di prodotti: spostare un prodotto
  // di molte posizioni a tap singoli è troppo lento). Ricalcola l'intero
  // elenco con il prodotto spostato, poi rinumera in sequenza 1..N —
  // aggiorna su Supabase solo le righe il cui ordine_giro è davvero
  // cambiato (di norma solo quelle comprese tra la vecchia e la nuova
  // posizione: le altre restano identiche e non generano query).
  function vaiAllaPosizione(prodottoId: string) {
    const idx = prodottiGiro.findIndex((p) => p.id === prodottoId);
    if (idx === -1) return;
    const p = prodottiGiro[idx];
    const totale = prodottiGiro.length;

    const valore = window.prompt(
      `Sposta "${p.descrizione}" in che posizione nel Giro? (1-${totale})`,
      String(idx + 1)
    );
    if (valore === null) return;
    const richiesta = Math.round(Number(valore.trim()));
    if (!Number.isFinite(richiesta) || richiesta < 1) return;
    const nuovoIdx = Math.min(richiesta, totale) - 1;
    if (nuovoIdx === idx) return;

    const riordinati = [...prodottiGiro];
    const [spostato] = riordinati.splice(idx, 1);
    riordinati.splice(nuovoIdx, 0, spostato);

    const aggiornamenti: { id: string; ordine_giro: number }[] = [];
    riordinati.forEach((prod, i) => {
      const nuovoValore = i + 1;
      if (prod.ordine_giro !== nuovoValore) aggiornamenti.push({ id: prod.id, ordine_giro: nuovoValore });
    });
    if (aggiornamenti.length === 0) return;

    const nuoviValori = new Map(aggiornamenti.map((a) => [a.id, a.ordine_giro]));
    setProdotti((prev) =>
      prev.map((prod) =>
        nuoviValori.has(prod.id) ? { ...prod, ordine_giro: nuoviValori.get(prod.id)! } : prod
      )
    );

    void Promise.all(
      aggiornamenti.map((a) => supabase.from("prodotti").update({ ordine_giro: a.ordine_giro }).eq("id", a.id))
    );
  }

  // "Togli dal giro": non disattiva né elimina il prodotto, solo smette di
  // mostrarlo qui — resta ordinabile come sempre da Ordina/Riepilogo.
  // Si rimette dentro dalla stessa casella in Pannello (ModificaProdottoModal).
  async function togliDalGiro(prodottoId: string) {
    setProdotti((prev) => prev.filter((p) => p.id !== prodottoId));
    await supabase.from("prodotti").update({ in_giro: false }).eq("id", prodottoId);
  }

  function prodottoSalvato(p: ProdottoConCategoria) {
    setProdotti((prev) =>
      // Se la modifica ha disattivato il prodotto o lo ha tolto dal giro,
      // sparisce subito da qui (questa vista mostra solo attivo+in_giro).
      p.attivo && p.in_giro ? prev.map((x) => (x.id === p.id ? p : x)) : prev.filter((x) => x.id !== p.id)
    );
    setModaleModifica(null);
  }

  function focusProssimoMagazzino(prodottoId: string) {
    const idx = prodottiVisualizzati.findIndex((p) => p.id === prodottoId);
    if (idx === -1) return;
    const prossimo = prodottiVisualizzati[idx + 1];
    if (!prossimo) return;
    magazzinoRefs.current[prossimo.id]?.focus();
  }

  return (
    <div>
      <p className="mb-3 text-sm text-neutral-500">
        Tutti i prodotti attivi di tutti i fornitori, nel tuo ordine — pensata per aggiornare il
        Magazzino mentre fai il giro del locale. Per il messaggio da inviare ai fornitori vai su{" "}
        <span className="font-medium text-neutral-700">Riepilogo</span>.
      </p>

      {prodottiGiro.length > 0 && (
        <input
          type="text"
          value={ricerca}
          onChange={(e) => setRicerca(e.target.value)}
          placeholder="🔍 Cerca per nome, codice o fornitore…"
          className="mb-3 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      )}

      {ricercaAttiva && (
        <p className="mb-2 text-xs text-neutral-400">
          Ricerca attiva: le frecce per riordinare sono disattivate finché non la cancelli.
        </p>
      )}

      {prodottiGiro.length === 0 && (
        <p className="text-sm text-neutral-500">
          Nessun prodotto nel giro al momento — aggiungine da Pannello (casella &quot;Fa parte del
          Giro&quot;).
        </p>
      )}

      {prodottiGiro.length > 0 && prodottiVisualizzati.length === 0 && (
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
              className="flex flex-col overflow-hidden rounded-xl border border-neutral-200 sm:flex-row sm:items-stretch"
            >
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
                    disabled={ricercaAttiva || i === prodottiGiro.length - 1}
                    aria-label="Sposta giù"
                    className="rounded px-1.5 py-1 text-neutral-500 hover:bg-white/70 hover:text-neutral-800 disabled:opacity-20"
                  >
                    ▼
                  </button>
                  <button
                    onClick={() => vaiAllaPosizione(p.id)}
                    disabled={ricercaAttiva}
                    title="Vai a una posizione precisa nel Giro"
                    className="rounded px-1 py-0.5 text-[9px] font-medium text-neutral-500 hover:bg-white/70 hover:text-neutral-800 disabled:opacity-20"
                  >
                    #{i + 1}
                  </button>
                </div>

                <label className="text-center text-[10px] leading-tight text-neutral-600">
                  Magazzino{unita && ` (${unita})`}
                  <div className="mt-1 flex items-center gap-1">
                    <input
                      ref={(el) => {
                        magazzinoRefs.current[p.id] = el;
                      }}
                      type="text"
                      inputMode="decimal"
                      enterKeyHint="next"
                      defaultValue={p.magazzino_attuale ?? ""}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          focusProssimoMagazzino(p.id);
                        }
                      }}
                      onChange={(e) => aggiornaCampo(p.id, "magazzino_attuale", e.target.value)}
                      className="block w-14 rounded-md border border-white/70 bg-white/80 px-1 py-2 text-center text-sm text-neutral-900 outline-none focus:border-neutral-500"
                    />
                    <button
                      type="button"
                      onClick={() => focusProssimoMagazzino(p.id)}
                      disabled={i === prodottiVisualizzati.length - 1}
                      title="Vai al campo Magazzino del prossimo prodotto"
                      aria-label="Vai al prossimo campo Magazzino"
                      className="rounded-md bg-white/70 px-1.5 py-2 text-xs text-neutral-600 hover:bg-white disabled:opacity-20"
                    >
                      ⏭
                    </button>
                  </div>
                </label>
              </div>

              <div className={`flex flex-1 items-start gap-2 p-3 ${colore}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="inline-block rounded-full border border-black/5 bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
                        {fornitoreNomeDi.get(p.fornitore_id) ?? "—"}
                      </span>
                      <p className="mt-0.5 text-sm font-medium text-neutral-900">{p.descrizione}</p>
                    </div>
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
                        onClick={() => togliDalGiro(p.id)}
                        title="Togli dal giro (resta ordinabile da Ordina/Riepilogo)"
                        className="rounded-md bg-white/70 px-1.5 py-1 text-xs text-red-700 hover:bg-white"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {p.note && (
                    <p className="mt-1 text-xs italic text-neutral-600">📝 {p.note}</p>
                  )}

                  {riga ? (
                    <p className="mt-1 text-sm font-medium text-neutral-900">
                      Ordina: {arrotonda(riga.quantitaOrdine)} {riga.unitaMostrata}
                      {riga.quantitaOmaggio > 0 && (
                        <span className="text-green-700"> (+{arrotonda(riga.quantitaOmaggio)} omaggio)</span>
                      )}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-neutral-400">Magazzino sufficiente</p>
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

      {modaleModifica && (
        <ModificaProdottoModal
          fornitoreId={modaleModifica.fornitore_id}
          categorie={categorie}
          prodotto={modaleModifica}
          prodottiFornitore={prodotti.filter((p) => p.fornitore_id === modaleModifica.fornitore_id)}
          onSalvato={prodottoSalvato}
          onChiudi={() => setModaleModifica(null)}
        />
      )}
    </div>
  );
}
