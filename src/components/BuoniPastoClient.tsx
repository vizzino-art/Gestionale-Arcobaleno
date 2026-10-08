"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { RegistraRendicontoBuonoPastoClient } from "./RegistraRendicontoBuonoPastoClient";
import type { MovimentoMinimo } from "@/lib/buoniPasto";
import type { Conto, RendicontoBuonoPasto, TipoBuonoPasto } from "@/lib/types";

type Props = {
  tipiIniziali: TipoBuonoPasto[];
  rendiconti: RendicontoBuonoPasto[];
  abbinamenti: Record<string, MovimentoMinimo | null>;
  conti: Conto[];
};

function formattaData(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formattaEuro(n: number | null): string {
  return n != null ? `€${n.toFixed(2)}` : "—";
}

export function BuoniPastoClient({ tipiIniziali, rendiconti, abbinamenti, conti }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [tipi, setTipi] = useState<TipoBuonoPasto[]>(tipiIniziali);
  const [mostraForm, setMostraForm] = useState(false);
  const [mostraGestioneTipi, setMostraGestioneTipi] = useState(false);

  // Nuovo tipo di buono pasto (es. in futuro Satispay, una volta chiaro il
  // formato dei suoi rendiconti) — elenco estensibile come fornitori/
  // categorie, mai un elenco fisso nel codice.
  const [nuovoTipoNome, setNuovoTipoNome] = useState("");
  const [nuovoTipoConto, setNuovoTipoConto] = useState("");
  const [salvandoTipo, setSalvandoTipo] = useState(false);
  const [erroreTipo, setErroreTipo] = useState<string | null>(null);

  const tipiPerId = useMemo(() => new Map(tipi.map((t) => [t.id, t])), [tipi]);
  const contiPerId = useMemo(() => new Map(conti.map((c) => [c.id, c])), [conti]);

  async function salvaNuovoTipo() {
    const nome = nuovoTipoNome.trim();
    if (!nome) {
      setErroreTipo("Inserisci un nome.");
      return;
    }
    setSalvandoTipo(true);
    setErroreTipo(null);
    const { data, error } = await supabase
      .from("tipi_buoni_pasto")
      .insert({
        nome,
        conto_atteso_id: nuovoTipoConto || null,
        ordine: tipi.length,
      })
      .select("*")
      .single();
    setSalvandoTipo(false);
    if (error || !data) {
      setErroreTipo(`Errore nel salvataggio: ${error?.message ?? "sconosciuto"}`);
      return;
    }
    setTipi((prev) => [...prev, data as TipoBuonoPasto]);
    setNuovoTipoNome("");
    setNuovoTipoConto("");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setMostraForm((v) => !v)}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          {mostraForm ? "✕ Annulla" : "+ Nuovo rendiconto"}
        </button>
        <button
          onClick={() => setMostraGestioneTipi((v) => !v)}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          {mostraGestioneTipi ? "✕ Chiudi tipi" : "⚙️ Gestisci tipi"}
        </button>
      </div>

      {mostraGestioneTipi && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="mb-3 text-sm font-medium text-neutral-900">Tipi di buono pasto</p>
          <div className="mb-3 space-y-1.5">
            {tipi.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm text-neutral-700">
                <span>{t.nome}</span>
                <span className="text-xs text-neutral-500">
                  {t.conto_atteso_id
                    ? `Accredito atteso su ${contiPerId.get(t.conto_atteso_id)?.nome ?? "—"}`
                    : "Conto di accredito non impostato"}
                </span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-2 border-t border-neutral-100 pt-3">
            <label className="text-xs text-neutral-500">
              Nuovo tipo
              <input
                type="text"
                value={nuovoTipoNome}
                onChange={(e) => setNuovoTipoNome(e.target.value)}
                placeholder="es. Satispay"
                className="mt-1 block w-40 rounded-md border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-neutral-500"
              />
            </label>
            <label className="text-xs text-neutral-500">
              Conto di accredito (facoltativo)
              <select
                value={nuovoTipoConto}
                onChange={(e) => setNuovoTipoConto(e.target.value)}
                className="mt-1 block w-48 rounded-md border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-neutral-500"
              >
                <option value="">— non ancora noto —</option>
                {conti.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={salvaNuovoTipo}
              disabled={salvandoTipo}
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {salvandoTipo ? "Salvo…" : "+ Aggiungi"}
            </button>
          </div>
          {erroreTipo && <p className="mt-2 text-xs text-red-700">{erroreTipo}</p>}
        </div>
      )}

      {mostraForm && (
        <RegistraRendicontoBuonoPastoClient
          tipi={tipi}
          onAnnulla={() => setMostraForm(false)}
          onSalvato={() => {
            setMostraForm(false);
            router.refresh();
          }}
        />
      )}

      {rendiconti.length === 0 && (
        <p className="text-sm text-neutral-500">
          Nessun rendiconto registrato ancora. Usa &quot;+ Nuovo rendiconto&quot; per aggiungerne uno.
        </p>
      )}

      <div className="space-y-2">
        {rendiconti.map((r) => {
          const tipo = tipiPerId.get(r.tipo_id);
          const movimento = abbinamenti[r.id];
          return (
            <div key={r.id} className="rounded-xl border border-neutral-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium text-neutral-900">
                <span>
                  {tipo?.nome ?? "—"} — doc. {r.numero_documento ?? "—"} del {formattaData(r.data_documento)}
                </span>
                {movimento ? (
                  <span
                    className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
                    title={`Incasso trovato in Prima Nota: "${movimento.causale}" del ${formattaData(movimento.data)}`}
                  >
                    🔗 Incassato — {formattaData(movimento.data)}
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                    ⏳ In attesa di incasso
                  </span>
                )}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-neutral-600 sm:grid-cols-4">
                <span>Periodo: {formattaData(r.periodo_da)} – {formattaData(r.periodo_a)}</span>
                <span>Ticket: {r.numero_ticket ?? "—"}</span>
                <span>Lordo: {formattaEuro(r.totale_lordo)}</span>
                <span>Netto: {formattaEuro(r.importo_netto)}</span>
              </div>
              <p className="mt-1 text-xs text-neutral-400">
                Pagamento previsto il {formattaData(r.data_pagamento_prevista)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
