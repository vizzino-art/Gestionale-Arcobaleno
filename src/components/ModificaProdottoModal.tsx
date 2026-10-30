"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { calcolaPrezzoNetto, prossimoOrdine } from "@/lib/prodotti";
import { ETICHETTE_TIPO_CONSERVAZIONE, type TipoConservazione } from "@/lib/tipo-conservazione";
import type { Categoria, Prodotto } from "@/lib/types";
import type { ProdottoConCategoria } from "./PannelloClient";

type Props = {
  fornitoreId: string;
  categorie: Categoria[];
  prodotto: ProdottoConCategoria | null; // null = nuovo prodotto
  prodottiFornitore: Prodotto[]; // per calcolare l'ordine del nuovo prodotto
  onSalvato: (p: ProdottoConCategoria) => void;
  onChiudi: () => void;
};

// Etichette proposte per il pezzo quando "conta_a_pezzi" è attivo; "Altro…"
// apre un campo libero, così non serve prevedere fin da subito ogni
// etichetta possibile (richiesto da Mauro il 23/10, per evitare errori di
// battitura rispetto a un campo di testo libero).
const UM_PEZZO_PRESET = ["pz", "Bt", "Sc", "Ct", "Kg", "CF"];

type Form = {
  descrizione: string;
  note: string;
  codice_articolo: string;
  categoria_id: string; // "" = nessuna
  um: string;
  um_confezione: string;
  pezzi_per_confezione: string;
  magazzino_in_confezione: boolean;
  peso_confezione_fisso: string;
  conta_a_pezzi: boolean;
  um_pezzo: string;
  peso_kg_per_unita: string;
  tipo_conservazione: "" | TipoConservazione;
  prezzo_listino: string;
  sconto1: string;
  sconto2: string;
  sconto3: string;
  omaggio_ogni: string;
  omaggio_gratis: string;
  attivo: boolean;
};

function formIniziale(p: ProdottoConCategoria | null): Form {
  return {
    descrizione: p?.descrizione ?? "",
    note: p?.note ?? "",
    codice_articolo: p?.codice_articolo ?? "",
    categoria_id: p?.categoria_id ?? "",
    um: p?.um ?? "",
    um_confezione: p?.um_confezione ?? "",
    pezzi_per_confezione: p?.pezzi_per_confezione?.toString() ?? "",
    magazzino_in_confezione: p?.magazzino_in_confezione ?? false,
    peso_confezione_fisso: p?.peso_confezione_fisso?.toString() ?? "",
    conta_a_pezzi: p?.conta_a_pezzi ?? false,
    um_pezzo: p?.um_pezzo ?? "",
    peso_kg_per_unita: p?.peso_kg_per_unita?.toString() ?? "",
    tipo_conservazione: p?.tipo_conservazione ?? "",
    prezzo_listino: p?.prezzo_listino?.toString() ?? "",
    sconto1: p?.sconto1?.toString() ?? "",
    sconto2: p?.sconto2?.toString() ?? "",
    sconto3: p?.sconto3?.toString() ?? "",
    omaggio_ogni: p?.omaggio_ogni?.toString() ?? "",
    omaggio_gratis: p?.omaggio_gratis?.toString() ?? "",
    attivo: p?.attivo ?? true,
  };
}

function numOrNull(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

export function ModificaProdottoModal({
  fornitoreId,
  categorie,
  prodotto,
  prodottiFornitore,
  onSalvato,
  onChiudi,
}: Props) {
  const supabase = createClient();
  const [form, setForm] = useState<Form>(formIniziale(prodotto));
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const prezzoNetto = calcolaPrezzoNetto(
    numOrNull(form.prezzo_listino),
    numOrNull(form.sconto1),
    numOrNull(form.sconto2),
    numOrNull(form.sconto3)
  );

  function campo<K extends keyof Form>(chiave: K, valore: Form[K]) {
    setForm((f) => ({ ...f, [chiave]: valore }));
  }

  async function salva() {
    if (form.descrizione.trim() === "") {
      setErrore("La descrizione è obbligatoria.");
      return;
    }
    setSalvando(true);
    setErrore(null);

    const valori = {
      fornitore_id: fornitoreId,
      categoria_id: form.categoria_id === "" ? null : form.categoria_id,
      codice_articolo: form.codice_articolo.trim() === "" ? null : form.codice_articolo.trim(),
      descrizione: form.descrizione.trim(),
      note: form.note.trim() === "" ? null : form.note.trim(),
      um: form.um.trim() === "" ? null : form.um.trim(),
      um_confezione: form.um_confezione.trim() === "" ? null : form.um_confezione.trim(),
      pezzi_per_confezione: numOrNull(form.pezzi_per_confezione),
      magazzino_in_confezione: form.magazzino_in_confezione,
      peso_confezione_fisso: form.magazzino_in_confezione ? numOrNull(form.peso_confezione_fisso) : null,
      conta_a_pezzi: form.conta_a_pezzi,
      um_pezzo: form.conta_a_pezzi ? form.um_pezzo.trim() || null : null,
      peso_kg_per_unita: numOrNull(form.peso_kg_per_unita),
      tipo_conservazione: form.tipo_conservazione === "" ? null : form.tipo_conservazione,
      prezzo_listino: numOrNull(form.prezzo_listino),
      sconto1: numOrNull(form.sconto1),
      sconto2: numOrNull(form.sconto2),
      sconto3: numOrNull(form.sconto3),
      omaggio_ogni: numOrNull(form.omaggio_ogni),
      omaggio_gratis: numOrNull(form.omaggio_gratis),
      attivo: form.attivo,
    };

    const query = prodotto
      ? supabase.from("prodotti").update(valori).eq("id", prodotto.id)
      : supabase
          .from("prodotti")
          .insert({ ...valori, ordine: prossimoOrdine(prodottiFornitore) });

    const { data, error } = await query.select("*, categorie(nome)").single();

    setSalvando(false);
    if (error || !data) {
      setErrore(error?.message ?? "Errore durante il salvataggio.");
      return;
    }
    onSalvato(data as ProdottoConCategoria);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onChiudi}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <h2 className="text-sm font-semibold text-neutral-900">
            {prodotto ? "Modifica prodotto" : "Nuovo prodotto"}
          </h2>
          <button onClick={onChiudi} className="text-neutral-400 hover:text-neutral-700">
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <label className="block text-xs text-neutral-500">
            Descrizione *
            <input
              type="text"
              value={form.descrizione}
              onChange={(e) => campo("descrizione", e.target.value)}
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            />
          </label>

          <label className="block text-xs text-neutral-500">
            Note (es. quando ordinarlo, eccezioni — visibili anche in Ordina)
            <textarea
              value={form.note}
              onChange={(e) => campo("note", e.target.value)}
              rows={2}
              placeholder="Es. non ordinare in estate, chiedere prima disponibilità…"
              className="mt-1 block w-full resize-none rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            />
          </label>

          <div className="flex gap-3">
            <label className="flex-1 text-xs text-neutral-500">
              Codice articolo
              <input
                type="text"
                value={form.codice_articolo}
                onChange={(e) => campo("codice_articolo", e.target.value)}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
            </label>
            <label className="flex-1 text-xs text-neutral-500">
              Categoria
              <select
                value={form.categoria_id}
                onChange={(e) => campo("categoria_id", e.target.value)}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              >
                <option value="">— nessuna —</option>
                {categorie.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex gap-3">
            <label className="flex-1 text-xs text-neutral-500">
              UM (acquisto)
              <input
                type="text"
                placeholder="es. KG, PZ, CT"
                value={form.um}
                onChange={(e) => campo("um", e.target.value)}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
            </label>
            <label className="flex-1 text-xs text-neutral-500">
              UM confezione
              <input
                type="text"
                value={form.um_confezione}
                onChange={(e) => campo("um_confezione", e.target.value)}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
            </label>
          </div>

          <div className="flex gap-3">
            <label className="flex-1 text-xs text-neutral-500">
              Pezzi per confezione
              <input
                type="number"
                step="any"
                value={form.pezzi_per_confezione}
                onChange={(e) => campo("pezzi_per_confezione", e.target.value)}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
            </label>
            <label className="flex-1 text-xs text-neutral-500">
              Peso KG per unità
              <input
                type="number"
                step="any"
                value={form.peso_kg_per_unita}
                onChange={(e) => campo("peso_kg_per_unita", e.target.value)}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
            </label>
          </div>

          <label className="block text-xs text-neutral-500">
            Conservazione (colora il riquadro Magazzino in Ordina)
            <select
              value={form.tipo_conservazione}
              onChange={(e) => campo("tipo_conservazione", e.target.value as Form["tipo_conservazione"])}
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            >
              <option value="">— non specificato —</option>
              {(Object.keys(ETICHETTE_TIPO_CONSERVAZIONE) as TipoConservazione[]).map((t) => (
                <option key={t} value={t}>
                  {ETICHETTE_TIPO_CONSERVAZIONE[t]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-start gap-2 rounded-lg border border-neutral-200 p-3 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={form.magazzino_in_confezione}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  magazzino_in_confezione: e.target.checked,
                  conta_a_pezzi: e.target.checked ? false : f.conta_a_pezzi,
                }))
              }
              className="mt-0.5 h-4 w-4"
            />
            <span>
              Magazzino e Obiettivo si contano in &quot;UM confezione&quot;, non in &quot;UM&quot;
              <br />
              <span className="text-xs text-neutral-500">
                Es. tieni il conto a sacchi interi ma il prezzo resta tracciato al kg (per trattare col
                fornitore). Attivalo solo se hai compilato UM confezione sopra.
                <br />
                Se il peso della confezione è sempre lo stesso (es. sacco da 10 kg), compila anche il
                campo &quot;Peso fisso per confezione&quot; qui sotto: registrando una bolla, il
                Magazzino si aggiornerà da solo convertendo i kg in confezioni. Se invece il peso cambia
                ogni volta (es. salsiccia, salumi), lascialo vuoto: dovrai correggere il Magazzino a
                mano dopo ogni consegna, come oggi.
              </span>
            </span>
          </label>

          {form.magazzino_in_confezione && (
            <label className="block text-xs text-neutral-500">
              Peso fisso per confezione (in {form.um || "UM"}, es. 10 per un sacco da 10 kg)
              <input
                type="number"
                step="any"
                value={form.peso_confezione_fisso}
                onChange={(e) => campo("peso_confezione_fisso", e.target.value)}
                placeholder="Lascia vuoto se il peso cambia ogni volta"
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
            </label>
          )}

          <label className="flex items-start gap-2 rounded-lg border border-neutral-200 p-3 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={form.conta_a_pezzi}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  conta_a_pezzi: e.target.checked,
                  magazzino_in_confezione: e.target.checked ? false : f.magazzino_in_confezione,
                }))
              }
              className="mt-0.5 h-4 w-4"
            />
            <span>
              Magazzino e Obiettivo si contano a pezzi, ma si ordina sempre &quot;UM&quot; intera
              <br />
              <span className="text-xs text-neutral-500">
                Es. uova o olio: li compri solo a cartone chiuso dal fornitore (il prezzo resta a
                cartone), ma sullo scaffale conti i pezzi rimasti. Usa &quot;Pezzi per confezione&quot;
                sopra per dire quanti pezzi ci sono in un&apos;unità di acquisto.
              </span>
            </span>
          </label>

          {form.conta_a_pezzi &&
            (() => {
              const umPezzoScelta =
                form.um_pezzo === "" || UM_PEZZO_PRESET.includes(form.um_pezzo) ? form.um_pezzo : "Altro";
              return (
                <label className="block text-xs text-neutral-500">
                  Etichetta del pezzo (mostrata accanto a Magazzino in Ordina)
                  <select
                    value={umPezzoScelta}
                    onChange={(e) => campo("um_pezzo", e.target.value === "Altro" ? "" : e.target.value)}
                    className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                  >
                    <option value="">— scegli —</option>
                    {UM_PEZZO_PRESET.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                    <option value="Altro">Altro…</option>
                  </select>
                  {umPezzoScelta === "Altro" && (
                    <input
                      type="text"
                      value={form.um_pezzo}
                      onChange={(e) => campo("um_pezzo", e.target.value)}
                      placeholder="Specifica etichetta"
                      className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
                    />
                  )}
                </label>
              );
            })()}

          <div className="rounded-lg border border-neutral-200 p-3">
            <p className="mb-2 text-xs font-medium text-neutral-700">Prezzo e sconti</p>
            <label className="block text-xs text-neutral-500">
              Prezzo di listino (€)
              <input
                type="number"
                step="any"
                value={form.prezzo_listino}
                onChange={(e) => campo("prezzo_listino", e.target.value)}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
            </label>
            <div className="mt-2 flex gap-2">
              <label className="flex-1 text-xs text-neutral-500">
                Sconto1 %
                <input
                  type="number"
                  step="any"
                  value={form.sconto1}
                  onChange={(e) => campo("sconto1", e.target.value)}
                  className="mt-1 block w-full rounded-md border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-neutral-500"
                />
              </label>
              <label className="flex-1 text-xs text-neutral-500">
                Sconto2 %
                <input
                  type="number"
                  step="any"
                  value={form.sconto2}
                  onChange={(e) => campo("sconto2", e.target.value)}
                  className="mt-1 block w-full rounded-md border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-neutral-500"
                />
              </label>
              <label className="flex-1 text-xs text-neutral-500">
                Sconto3 %
                <input
                  type="number"
                  step="any"
                  value={form.sconto3}
                  onChange={(e) => campo("sconto3", e.target.value)}
                  className="mt-1 block w-full rounded-md border border-neutral-300 px-2 py-2 text-sm outline-none focus:border-neutral-500"
                />
              </label>
            </div>
            <p className="mt-2 text-sm text-neutral-700">
              Prezzo netto: <span className="font-medium text-neutral-900">€{prezzoNetto.toFixed(4)}</span>
            </p>
          </div>

          <div className="flex gap-3">
            <label className="flex-1 text-xs text-neutral-500">
              Omaggio ogni
              <input
                type="number"
                step="any"
                value={form.omaggio_ogni}
                onChange={(e) => campo("omaggio_ogni", e.target.value)}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
            </label>
            <label className="flex-1 text-xs text-neutral-500">
              Omaggio gratis
              <input
                type="number"
                step="any"
                value={form.omaggio_gratis}
                onChange={(e) => campo("omaggio_gratis", e.target.value)}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={form.attivo}
              onChange={(e) => campo("attivo", e.target.checked)}
              className="h-4 w-4"
            />
            Prodotto attivo (visibile in Ordina/Riepilogo)
          </label>

          {errore && <p className="text-sm text-red-600">{errore}</p>}

          <div className="flex gap-2 pt-1">
            <button
              onClick={salva}
              disabled={salvando}
              className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {salvando ? "Salvataggio…" : "Salva"}
            </button>
            <button
              onClick={onChiudi}
              className="rounded-lg px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100"
            >
              Annulla
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
