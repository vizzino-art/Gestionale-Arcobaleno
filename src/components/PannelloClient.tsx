"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ModificaProdottoModal } from "./ModificaProdottoModal";
import { ColoriCategorieModal } from "./ColoriCategorieModal";
import { TrovaDoppioniModal } from "./TrovaDoppioniModal";
import { TipoConservazioneModal } from "./TipoConservazioneModal";
import type { TipoConservazione } from "@/lib/tipo-conservazione";
import { GraficoStoricoPrezzo } from "./GraficoStoricoPrezzo";
import { mappaColoriCategorie } from "@/lib/colori-categorie";
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
  const [categorieLocali, setCategorieLocali] = useState<Categoria[]>(categorie);
  const [modaleColori, setModaleColori] = useState(false);
  const [modaleDoppioni, setModaleDoppioni] = useState(false);
  const [modaleConservazione, setModaleConservazione] = useState(false);
  const [ricerca, setRicerca] = useState("");

  const coloriCategorie = useMemo(() => mappaColoriCategorie(categorieLocali), [categorieLocali]);

  const prodottiFornitore = useMemo(
    () =>
      prodotti
        .filter((p) => p.fornitore_id === fornitoreId)
        // Ordine alfabetico puro per descrizione, attivi e disattivati
        // mescolati insieme (i disattivati restano comunque visibili e
        // modificabili qui, per poterli riattivare in futuro se il prezzo
        // torna conveniente — solo non sono più raggruppati in fondo).
        // Il campo "ordine" qui non viene più usato: resta uso esclusivo
        // di Ordina (frecce ▲▼ e "manda in fondo").
        .sort((a, b) => a.descrizione.localeCompare(b.descrizione, "it")),
    [prodotti, fornitoreId]
  );

  // Solo un filtro visivo sull'elenco già ordinato: non tocca l'ordine dei
  // prodotti (le frecce ▲▼ in Ordina restano affidabili anche con una
  // ricerca in corso lì).
  const prodottiVisualizzati = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    if (!q) return prodottiFornitore;
    return prodottiFornitore.filter(
      (p) =>
        p.descrizione.toLowerCase().includes(q) ||
        (p.codice_articolo ?? "").toLowerCase().includes(q)
    );
  }, [prodottiFornitore, ricerca]);

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

  function prodottiUniti(idTenuto: string, idEliminato: string, codiceArticoloAggiornato: string | null) {
    setProdotti((prev) =>
      prev
        .filter((p) => p.id !== idEliminato)
        .map((p) =>
          p.id === idTenuto && codiceArticoloAggiornato
            ? { ...p, codice_articolo: codiceArticoloAggiornato }
            : p
        )
    );
  }

  function conservazioneAggiornata(prodottoId: string, tipo: TipoConservazione | null) {
    setProdotti((prev) =>
      prev.map((p) => (p.id === prodottoId ? { ...p, tipo_conservazione: tipo } : p))
    );
  }

  return (
    <div>
      <div className="mb-3 flex gap-1 overflow-x-auto border-b border-neutral-200 pb-2">
        {fornitori.map((f) => (
          <button
            key={f.id}
            onClick={() => {
              setFornitoreId(f.id);
              setRicerca("");
            }}
            className={`shrink-0 rounded-md px-3 py-2.5 text-sm ${
              f.id === fornitoreId ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            {f.nome}
          </button>
        ))}
      </div>

      {fornitoreId && (
        <div className="mb-3 flex flex-wrap justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setModaleColori(true)}
              className="shrink-0 rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              🎨 Colori categorie
            </button>
            <button
              onClick={() => setModaleDoppioni(true)}
              className="shrink-0 rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              🔀 Prodotti doppi
            </button>
            <button
              onClick={() => setModaleConservazione(true)}
              className="shrink-0 rounded-md border border-neutral-300 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              🧊 Fresco/Gelo/Ambiente
            </button>
          </div>
          <button
            onClick={() => setModaleModifica({ modo: "nuovo" })}
            className="shrink-0 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            + Nuovo prodotto
          </button>
        </div>
      )}

      {fornitoreId && prodottiFornitore.length > 0 && (
        <input
          type="text"
          value={ricerca}
          onChange={(e) => setRicerca(e.target.value)}
          placeholder="🔍 Cerca per nome o codice articolo…"
          className="mb-3 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      )}

      {prodottiFornitore.length === 0 && (
        <p className="text-sm text-neutral-500">Nessun prodotto per questo fornitore.</p>
      )}

      {prodottiFornitore.length > 0 && prodottiVisualizzati.length === 0 && (
        <p className="text-sm text-neutral-500">Nessun prodotto trovato per &quot;{ricerca}&quot;.</p>
      )}

      <div className="space-y-2">
        {prodottiVisualizzati.map((p, i) => {
          const coloreCategoria = p.categoria_id ? coloriCategorie.get(p.categoria_id) : undefined;
          const colore = coloreCategoria ?? COLORI_RIGA[i % COLORI_RIGA.length];
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
              <GraficoStoricoPrezzo punti={storico.map((r) => ({ data: r.data, prezzo: r.prezzo }))} />
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
          categorie={categorieLocali}
          prodotto={modaleModifica.modo === "modifica" ? modaleModifica.prodotto : null}
          prodottiFornitore={prodottiFornitore}
          onSalvato={prodottoSalvato}
          onChiudi={() => setModaleModifica(null)}
        />
      )}

      {modaleColori && (
        <ColoriCategorieModal
          categorie={categorieLocali}
          onAggiornata={(c) =>
            setCategorieLocali((prec) => prec.map((x) => (x.id === c.id ? c : x)))
          }
          onChiudi={() => setModaleColori(false)}
        />
      )}

      {modaleDoppioni && (
        <TrovaDoppioniModal
          prodotti={prodotti}
          fornitori={fornitori}
          onUnito={prodottiUniti}
          onChiudi={() => setModaleDoppioni(false)}
        />
      )}

      {modaleConservazione && (
        <TipoConservazioneModal
          prodotti={prodotti}
          fornitori={fornitori}
          onAggiornato={conservazioneAggiornata}
          onChiudi={() => setModaleConservazione(false)}
        />
      )}
    </div>
  );
}
