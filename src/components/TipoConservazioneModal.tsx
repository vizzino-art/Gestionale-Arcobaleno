"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  COLORI_TIPO_CONSERVAZIONE,
  ETICHETTE_TIPO_CONSERVAZIONE,
  type TipoConservazione,
} from "@/lib/tipo-conservazione";
import type { Fornitore, Prodotto } from "@/lib/types";

type Props = {
  prodotti: Prodotto[];
  fornitori: Fornitore[];
  onAggiornato: (prodottoId: string, tipo: TipoConservazione | null) => void;
  onChiudi: () => void;
};

const TIPI: TipoConservazione[] = ["fresco", "gelo", "ambiente"];

export function TipoConservazioneModal({ prodotti, fornitori, onAggiornato, onChiudi }: Props) {
  const [fornitoreId, setFornitoreId] = useState<string>("tutti");
  const [soloNonClassificati, setSoloNonClassificati] = useState(true);
  const [ricerca, setRicerca] = useState("");
  const [salvandoId, setSalvandoId] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  const nomeFornitore = useMemo(() => {
    const mappa = new Map(fornitori.map((f) => [f.id, f.nome]));
    return (id: string) => mappa.get(id) ?? "?";
  }, [fornitori]);

  const elenco = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    return prodotti
      .filter((p) => p.attivo)
      .filter((p) => fornitoreId === "tutti" || p.fornitore_id === fornitoreId)
      .filter((p) => !soloNonClassificati || !p.tipo_conservazione)
      .filter((p) => !q || p.descrizione.toLowerCase().includes(q))
      .sort((a, b) => {
        const f = nomeFornitore(a.fornitore_id).localeCompare(nomeFornitore(b.fornitore_id), "it");
        if (f !== 0) return f;
        return a.descrizione.localeCompare(b.descrizione, "it");
      });
  }, [prodotti, fornitoreId, soloNonClassificati, ricerca, nomeFornitore]);

  const daClassificare = useMemo(() => prodotti.filter((p) => p.attivo && !p.tipo_conservazione).length, [prodotti]);

  async function scegli(p: Prodotto, tipo: TipoConservazione | null) {
    setSalvandoId(p.id);
    setErrore(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("prodotti")
      .update({ tipo_conservazione: tipo })
      .eq("id", p.id);
    setSalvandoId(null);
    if (error) {
      setErrore(`Errore nel salvataggio: ${error.message}`);
      return;
    }
    onAggiornato(p.id, tipo);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onChiudi}>
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">🧊 Fresco / Gelo / Ambiente</h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              Classifica come si conserva ogni prodotto: in Ordina il riquadro &quot;Magazzino&quot; di
              quel prodotto prende il colore scelto, indipendentemente dal colore di riga della
              categoria. {daClassificare > 0 && (
                <span className="font-medium text-neutral-700">
                  Ancora da classificare: {daClassificare}.
                </span>
              )}
            </p>
          </div>
          <button onClick={onChiudi} className="shrink-0 text-neutral-400 hover:text-neutral-700">
            ✕
          </button>
        </div>

        {errore && <p className="mb-3 rounded-md bg-red-50 p-2 text-xs text-red-700">{errore}</p>}

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select
            value={fornitoreId}
            onChange={(e) => setFornitoreId(e.target.value)}
            className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          >
            <option value="tutti">Tutti i fornitori</option>
            {fornitori.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
            placeholder="🔍 Cerca…"
            className="min-w-[10rem] flex-1 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
          <label className="flex items-center gap-1.5 text-xs text-neutral-600">
            <input
              type="checkbox"
              checked={soloNonClassificati}
              onChange={(e) => setSoloNonClassificati(e.target.checked)}
            />
            Solo non classificati
          </label>
        </div>

        <div className="flex-1 space-y-1.5 overflow-y-auto">
          {elenco.length === 0 && (
            <p className="text-sm text-neutral-500">Nessun prodotto trovato con questi filtri.</p>
          )}
          {elenco.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-100 p-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-neutral-900">{p.descrizione}</p>
                <p className="text-xs text-neutral-400">{nomeFornitore(p.fornitore_id)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  onClick={() => scegli(p, null)}
                  disabled={salvandoId === p.id}
                  title="Nessuna classificazione"
                  className={`flex h-7 w-7 items-center justify-center rounded-full border-2 bg-white text-[10px] leading-none text-neutral-400 ${
                    p.tipo_conservazione ? "border-neutral-300" : "border-neutral-900"
                  }`}
                >
                  ✕
                </button>
                {TIPI.map((tipo) => (
                  <button
                    key={tipo}
                    onClick={() => scegli(p, tipo)}
                    disabled={salvandoId === p.id}
                    title={ETICHETTE_TIPO_CONSERVAZIONE[tipo]}
                    className={`rounded-full border-2 px-2.5 py-1 text-xs ${COLORI_TIPO_CONSERVAZIONE[tipo]} ${
                      p.tipo_conservazione === tipo ? "border-neutral-900" : "border-transparent"
                    }`}
                  >
                    {ETICHETTE_TIPO_CONSERVAZIONE[tipo]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
