"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Fornitore } from "@/lib/types";

type Props = {
  fornitori: Fornitore[];
  fattureIniziali: FatturaSalvata[];
};

type RigaEstratta = {
  numeroLinea: number;
  codiceArticolo: string | null;
  descrizione: string;
  quantita: number | null;
  um: string | null;
  prezzoUnitario: number | null;
  prezzoTotale: number | null;
  aliquotaIva: number | null;
  ddtNumero: string | null;
  ddtData: string | null;
};

type RataEstratta = {
  numeroRata: number;
  importo: number;
  dataScadenza: string | null;
  modalitaPagamento: string | null;
};

type FatturaEstratta = {
  fornitorePiva: string;
  fornitoreNome: string;
  numero: string;
  data: string;
  tipoDocumento: string;
  importoTotale: number;
  righe: RigaEstratta[];
  rate: RataEstratta[];
  xml: string;
};

export type FatturaSalvata = {
  id: string;
  fornitore_nome: string;
  fornitore_piva: string;
  numero: string;
  data: string;
  tipo_documento: string;
  importo_totale: number;
  righe_fatture_ricevute: RigaSalvata[];
  rate_pagamento_fatture: RataSalvata[];
};

type RigaSalvata = {
  numero_linea: number;
  codice_articolo: string | null;
  descrizione: string;
  quantita: number | null;
  um: string | null;
  prezzo_unitario: number | null;
  ddt_numero: string | null;
  ddt_data: string | null;
};

type RataSalvata = {
  numero_rata: number;
  importo: number;
  data_scadenza: string | null;
  modalita_pagamento: string | null;
};

const ETICHETTE_MODALITA_PAGAMENTO: Record<string, string> = {
  MP01: "Contanti",
  MP02: "Assegno",
  MP03: "Assegno circolare",
  MP05: "Bonifico",
  MP08: "Carta di pagamento",
  MP09: "RID",
  MP12: "RIBA",
  MP19: "SEPA Direct Debit",
  MP22: "Contanti presso Tesoreria",
};

const ETICHETTE_TIPO_DOCUMENTO: Record<string, string> = {
  TD01: "Fattura",
  TD02: "Acconto/anticipo su fattura",
  TD04: "Nota di credito",
  TD05: "Nota di debito",
  TD24: "Fattura differita",
  TD26: "Cessione di beni ammortizzabili",
};

function normalizzaPiva(v: string): string {
  return v.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

function formattaEuro(v: number | null): string {
  if (v === null) return "-";
  return v.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

function formattaData(v: string | null): string {
  if (!v) return "-";
  const [anno, mese, giorno] = v.split("-");
  if (!anno || !mese || !giorno) return v;
  return `${giorno}/${mese}/${anno}`;
}

async function leggiComeBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const risultato = reader.result as string;
      resolve(risultato.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(new Error("Lettura del file fallita."));
    reader.readAsDataURL(file);
  });
}

export function RegistroFattureClient({ fornitori, fattureIniziali }: Props) {
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [estratta, setEstratta] = useState<FatturaEstratta | null>(null);
  const [nomeFileCorrente, setNomeFileCorrente] = useState<string>("");
  const [fornitoreScelto, setFornitoreScelto] = useState<string>("");
  const [salvataggio, setSalvataggio] = useState(false);
  const [messaggioSalvataggio, setMessaggioSalvataggio] = useState<string | null>(null);
  const [fatture, setFatture] = useState<FatturaSalvata[]>(fattureIniziali);
  const [espansa, setEspansa] = useState<string | null>(null);

  const fornitoriPerPiva = useMemo(() => {
    const mappa = new Map<string, Fornitore>();
    for (const f of fornitori) {
      if (f.piva) mappa.set(normalizzaPiva(f.piva), f);
    }
    return mappa;
  }, [fornitori]);

  async function gestisciCaricamento(file: File) {
    setErrore(null);
    setMessaggioSalvataggio(null);
    setEstratta(null);
    setCaricamento(true);
    setNomeFileCorrente(file.name);
    try {
      const contenuto = await leggiComeBase64(file);
      const risposta = await fetch("/api/leggi-fattura-elettronica", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contenuto, nomeFile: file.name }),
      });
      const dati = await risposta.json();
      if (!risposta.ok) {
        setErrore(dati?.errore ?? "Errore nella lettura del file.");
        return;
      }
      setEstratta(dati as FatturaEstratta);
      const match = fornitoriPerPiva.get(normalizzaPiva((dati as FatturaEstratta).fornitorePiva));
      setFornitoreScelto(match?.id ?? "");
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Errore nella lettura del file.");
    } finally {
      setCaricamento(false);
    }
  }

  async function salva() {
    if (!estratta) return;
    setSalvataggio(true);
    setMessaggioSalvataggio(null);
    setErrore(null);
    try {
      const supabase = createClient();
      const formatoOriginale = nomeFileCorrente.toLowerCase().endsWith(".p7m") ? "p7m" : "xml";

      const { data: fatturaInserita, error: erroreFattura } = await supabase
        .from("fatture_ricevute")
        .insert({
          fornitore_id: fornitoreScelto || null,
          fornitore_piva: estratta.fornitorePiva,
          fornitore_nome: estratta.fornitoreNome,
          numero: estratta.numero,
          data: estratta.data,
          tipo_documento: estratta.tipoDocumento,
          importo_totale: estratta.importoTotale,
          formato_originale: formatoOriginale,
          xml: estratta.xml,
        })
        .select("id")
        .single();

      if (erroreFattura) {
        if (erroreFattura.code === "23505") {
          setErrore("Questa fattura risulta già registrata (stesso fornitore, numero e data).");
        } else {
          setErrore(`Errore nel salvataggio: ${erroreFattura.message}`);
        }
        return;
      }

      const fatturaId = fatturaInserita.id as string;

      if (estratta.righe.length > 0) {
        const { error: erroreRighe } = await supabase.from("righe_fatture_ricevute").insert(
          estratta.righe.map((r) => ({
            fattura_id: fatturaId,
            numero_linea: r.numeroLinea,
            codice_articolo: r.codiceArticolo,
            descrizione: r.descrizione,
            quantita: r.quantita,
            um: r.um,
            prezzo_unitario: r.prezzoUnitario,
            prezzo_totale: r.prezzoTotale,
            aliquota_iva: r.aliquotaIva,
            ddt_numero: r.ddtNumero,
            ddt_data: r.ddtData,
          }))
        );
        if (erroreRighe) {
          setErrore(`Fattura salvata, ma errore nelle righe: ${erroreRighe.message}`);
          return;
        }
      }

      if (estratta.rate.length > 0) {
        const { error: erroreRate } = await supabase.from("rate_pagamento_fatture").insert(
          estratta.rate.map((r) => ({
            fattura_id: fatturaId,
            numero_rata: r.numeroRata,
            importo: r.importo,
            data_scadenza: r.dataScadenza,
            modalita_pagamento: r.modalitaPagamento,
          }))
        );
        if (erroreRate) {
          setErrore(`Fattura salvata, ma errore nelle rate: ${erroreRate.message}`);
          return;
        }
      }

      setFatture((prec) => [
        {
          id: fatturaId,
          fornitore_nome: estratta.fornitoreNome,
          fornitore_piva: estratta.fornitorePiva,
          numero: estratta.numero,
          data: estratta.data,
          tipo_documento: estratta.tipoDocumento,
          importo_totale: estratta.importoTotale,
          righe_fatture_ricevute: estratta.righe.map((r) => ({
            numero_linea: r.numeroLinea,
            codice_articolo: r.codiceArticolo,
            descrizione: r.descrizione,
            quantita: r.quantita,
            um: r.um,
            prezzo_unitario: r.prezzoUnitario,
            ddt_numero: r.ddtNumero,
            ddt_data: r.ddtData,
          })),
          rate_pagamento_fatture: estratta.rate.map((r) => ({
            numero_rata: r.numeroRata,
            importo: r.importo,
            data_scadenza: r.dataScadenza,
            modalita_pagamento: r.modalitaPagamento,
          })),
        },
        ...prec,
      ]);
      setMessaggioSalvataggio("Fattura registrata.");
      setEstratta(null);
      setNomeFileCorrente("");
    } finally {
      setSalvataggio(false);
    }
  }

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #vista-stampa-fattura, #vista-stampa-fattura * { visibility: visible; }
          #vista-stampa-fattura { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
        }
      `}</style>

      <div className="mb-6 rounded-lg border border-neutral-200 bg-white p-4">
        <label className="mb-2 block text-sm font-medium text-neutral-700">
          Carica una fattura (file .xml o .xml.p7m così come scaricato dalla PEC)
        </label>
        <input
          type="file"
          accept=".xml,.p7m"
          disabled={caricamento}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) gestisciCaricamento(file);
            e.target.value = "";
          }}
          className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
        />
        {caricamento && <p className="mt-2 text-sm text-neutral-500">Lettura del file in corso…</p>}
        {errore && <p className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">{errore}</p>}
        {messaggioSalvataggio && (
          <p className="mt-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">{messaggioSalvataggio}</p>
        )}
      </div>

      {estratta && (
        <div className="mb-6 rounded-lg border border-neutral-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-neutral-900">
              {ETICHETTE_TIPO_DOCUMENTO[estratta.tipoDocumento] ?? estratta.tipoDocumento} {estratta.numero} del{" "}
              {formattaData(estratta.data)}
            </h2>
            <span className="text-lg font-semibold text-neutral-900">
              {formattaEuro(estratta.importoTotale)}
            </span>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-neutral-500">Fornitore (da fattura)</p>
              <p className="text-sm text-neutral-900">
                {estratta.fornitoreNome} — P.IVA {estratta.fornitorePiva}
              </p>
            </div>
            <div>
              <label className="text-xs text-neutral-500">Abbina a fornitore a sistema</label>
              <select
                value={fornitoreScelto}
                onChange={(e) => setFornitoreScelto(e.target.value)}
                className="mt-0.5 block w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
              >
                <option value="">— nessuno (solo archiviata) —</option>
                {fornitori.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                  <th className="py-1 pr-2">Codice</th>
                  <th className="py-1 pr-2">Descrizione</th>
                  <th className="py-1 pr-2">Qtà</th>
                  <th className="py-1 pr-2">UM</th>
                  <th className="py-1 pr-2">Prezzo unit.</th>
                  <th className="py-1 pr-2">DDT</th>
                </tr>
              </thead>
              <tbody>
                {estratta.righe.map((r, i) => (
                  <tr key={i} className="border-b border-neutral-100">
                    <td className="py-1 pr-2 text-neutral-600">{r.codiceArticolo ?? "-"}</td>
                    <td className="py-1 pr-2 text-neutral-900">{r.descrizione}</td>
                    <td className="py-1 pr-2 text-neutral-600">{r.quantita ?? "-"}</td>
                    <td className="py-1 pr-2 text-neutral-600">{r.um ?? "-"}</td>
                    <td className="py-1 pr-2 text-neutral-600">{formattaEuro(r.prezzoUnitario)}</td>
                    <td className="py-1 pr-2 text-neutral-500">
                      {r.ddtNumero ? `${r.ddtNumero} (${formattaData(r.ddtData)})` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {estratta.rate.length > 0 && (
            <div className="mb-4">
              <p className="mb-1 text-xs text-neutral-500">Scadenze di pagamento (dalla fattura)</p>
              <ul className="space-y-1 text-sm text-neutral-700">
                {estratta.rate.map((r) => (
                  <li key={r.numeroRata}>
                    {formattaEuro(r.importo)} — scadenza {formattaData(r.dataScadenza)}
                    {r.modalitaPagamento &&
                      ` — ${ETICHETTE_MODALITA_PAGAMENTO[r.modalitaPagamento] ?? r.modalitaPagamento}`}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={salva}
              disabled={salvataggio}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {salvataggio ? "Salvataggio…" : "Salva nel Registro Fatture"}
            </button>
          </div>
        </div>
      )}

      <h2 className="mb-2 text-base font-semibold text-neutral-900">Fatture registrate</h2>
      {fatture.length === 0 && <p className="text-sm text-neutral-500">Nessuna fattura ancora registrata.</p>}
      <div className="space-y-2">
        {fatture.map((f) => (
          <div key={f.id} className="rounded-lg border border-neutral-200 bg-white">
            <button
              onClick={() => setEspansa(espansa === f.id ? null : f.id)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <span className="text-sm text-neutral-900">
                <span className="font-medium">{f.fornitore_nome}</span> — {ETICHETTE_TIPO_DOCUMENTO[f.tipo_documento] ?? f.tipo_documento}{" "}
                {f.numero} del {formattaData(f.data)}
              </span>
              <span className="text-sm font-medium text-neutral-900">{formattaEuro(f.importo_totale)}</span>
            </button>
            {espansa === f.id && (
              <div className="border-t border-neutral-100 px-4 py-3">
                <div id="vista-stampa-fattura">
                  <h3 className="mb-2 text-sm font-semibold text-neutral-900">
                    {f.fornitore_nome} — P.IVA {f.fornitore_piva}
                  </h3>
                  <p className="mb-3 text-sm text-neutral-600">
                    {ETICHETTE_TIPO_DOCUMENTO[f.tipo_documento] ?? f.tipo_documento} {f.numero} del{" "}
                    {formattaData(f.data)} — Totale {formattaEuro(f.importo_totale)}
                  </p>
                  <table className="mb-3 w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                        <th className="py-1 pr-2">Codice</th>
                        <th className="py-1 pr-2">Descrizione</th>
                        <th className="py-1 pr-2">Qtà</th>
                        <th className="py-1 pr-2">UM</th>
                        <th className="py-1 pr-2">Prezzo unit.</th>
                        <th className="py-1 pr-2">DDT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {f.righe_fatture_ricevute.map((r, i) => (
                        <tr key={i} className="border-b border-neutral-100">
                          <td className="py-1 pr-2 text-neutral-600">{r.codice_articolo ?? "-"}</td>
                          <td className="py-1 pr-2 text-neutral-900">{r.descrizione}</td>
                          <td className="py-1 pr-2 text-neutral-600">{r.quantita ?? "-"}</td>
                          <td className="py-1 pr-2 text-neutral-600">{r.um ?? "-"}</td>
                          <td className="py-1 pr-2 text-neutral-600">{formattaEuro(r.prezzo_unitario)}</td>
                          <td className="py-1 pr-2 text-neutral-500">
                            {r.ddt_numero ? `${r.ddt_numero} (${formattaData(r.ddt_data)})` : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {f.rate_pagamento_fatture.length > 0 && (
                    <ul className="mb-2 space-y-1 text-sm text-neutral-700">
                      {f.rate_pagamento_fatture.map((r) => (
                        <li key={r.numero_rata}>
                          {formattaEuro(r.importo)} — scadenza {formattaData(r.data_scadenza)}
                          {r.modalita_pagamento &&
                            ` — ${ETICHETTE_MODALITA_PAGAMENTO[r.modalita_pagamento] ?? r.modalita_pagamento}`}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <button
                  onClick={() => window.print()}
                  className="mt-2 rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
                >
                  Stampa / Salva come PDF
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
