"use client";

import { useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Fornitore, Prodotto } from "@/lib/types";

type Props = {
  fornitori: Fornitore[];
  prodotti: Prodotto[];
};

type RigaEstratta = {
  codice_articolo: string | null;
  descrizione: string;
  quantita: number | null;
  prezzo_unitario: number | null;
  um: string | null;
};

type RispostaEstrazione = {
  numero_ddt: string | null;
  data: string | null;
  righe: RigaEstratta[];
};

// Riga di lavoro in fase di revisione: parte da quanto letto dalla foto,
// modificabile prima di salvare, con il prodotto abbinato e la scelta se
// aggiornare anche il prezzo di listino.
type RigaLavoro = {
  chiave: string;
  codiceArticolo: string;
  descrizione: string;
  quantita: string;
  prezzo: string;
  um: string;
  prodottoId: string; // "" = nessuna corrispondenza scelta
  aggiornaPrezzo: boolean;
};

function normalizza(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9À-Ù]+/g, " ").trim();
}

// Abbinamento automatico: prima per codice articolo esatto, poi per
// descrizione esatta, poi per sovrapposizione di parole (solo se abbastanza
// alta) — sempre e comunque modificabile a mano dopo, non è mai definitivo
// finché non si salva.
function trovaMatch(riga: RigaEstratta, prodottiFornitore: Prodotto[]): string {
  if (riga.codice_articolo) {
    const codice = normalizza(riga.codice_articolo);
    const perCodice = prodottiFornitore.find(
      (p) => p.codice_articolo && normalizza(p.codice_articolo) === codice
    );
    if (perCodice) return perCodice.id;
  }

  const desc = normalizza(riga.descrizione);
  const perDescrizioneEsatta = prodottiFornitore.find((p) => normalizza(p.descrizione) === desc);
  if (perDescrizioneEsatta) return perDescrizioneEsatta.id;

  const parole = desc.split(" ").filter((w) => w.length > 2);
  if (parole.length === 0) return "";

  let migliore: { id: string; punteggio: number } | null = null;
  for (const p of prodottiFornitore) {
    const paroleP = new Set(normalizza(p.descrizione).split(" "));
    const comuni = parole.filter((w) => paroleP.has(w)).length;
    const punteggio = comuni / parole.length;
    if (punteggio >= 0.6 && (!migliore || punteggio > migliore.punteggio)) {
      migliore = { id: p.id, punteggio };
    }
  }
  return migliore?.id ?? "";
}

async function ridimensionaEComprimi(file: File): Promise<{ base64: string; mediaType: string }> {
  const bitmap = await createImageBitmap(file);
  const MAX = 1600;
  let { width, height } = bitmap;
  if (width > MAX || height > MAX) {
    const scala = MAX / Math.max(width, height);
    width = Math.round(width * scala);
    height = Math.round(height * scala);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Impossibile elaborare l'immagine su questo dispositivo.");
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Conversione immagine fallita"))), "image/jpeg", 0.85)
  );
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const risultato = reader.result as string;
      resolve(risultato.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(new Error("Lettura immagine fallita"));
    reader.readAsDataURL(blob);
  });
  return { base64, mediaType: "image/jpeg" };
}

function arrotonda(n: number): number {
  return Math.round(n * 100) / 100;
}

export function RegistraBollaClient({ fornitori, prodotti }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const inputFotoRef = useRef<HTMLInputElement>(null);

  const [fornitoreId, setFornitoreId] = useState<string>(fornitori[0]?.id ?? "");
  const [numeroDdt, setNumeroDdt] = useState("");
  const [dataDocumento, setDataDocumento] = useState("");
  const [anteprimaUrl, setAnteprimaUrl] = useState<string | null>(null);
  const [righe, setRighe] = useState<RigaLavoro[]>([]);
  const [estrazioneFatta, setEstrazioneFatta] = useState(false);

  const [caricando, setCaricando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [salvato, setSalvato] = useState(false);

  const prodottiFornitore = useMemo(
    () => prodotti.filter((p) => p.fornitore_id === fornitoreId),
    [prodotti, fornitoreId]
  );

  function prodottoDa(id: string): Prodotto | undefined {
    return prodottiFornitore.find((p) => p.id === id);
  }

  async function scattaOCarica(file: File) {
    setErrore(null);
    setSalvato(false);
    setAnteprimaUrl(URL.createObjectURL(file));
    setCaricando(true);
    setEstrazioneFatta(false);
    setRighe([]);

    try {
      const { base64, mediaType } = await ridimensionaEComprimi(file);
      const risposta = await fetch("/api/estrai-bolla", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ immagine: base64, mediaType }),
      });
      const dati = await risposta.json();

      if (!risposta.ok) {
        setErrore(dati?.errore ?? "Errore durante la lettura della foto.");
        setCaricando(false);
        return;
      }

      const estratto = dati as RispostaEstrazione;
      setNumeroDdt(estratto.numero_ddt ?? "");
      setDataDocumento(estratto.data ?? "");

      const nuoveRighe: RigaLavoro[] = estratto.righe.map((r, i) => {
        const prodottoId = trovaMatch(r, prodottiFornitore);
        return {
          chiave: `${Date.now()}-${i}`,
          codiceArticolo: r.codice_articolo ?? "",
          descrizione: r.descrizione,
          quantita: r.quantita != null ? String(r.quantita) : "",
          prezzo: r.prezzo_unitario != null ? String(r.prezzo_unitario) : "",
          um: r.um ?? "",
          prodottoId,
          aggiornaPrezzo: true,
        };
      });
      setRighe(nuoveRighe);
      setEstrazioneFatta(true);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Errore imprevisto durante la lettura della foto.");
    } finally {
      setCaricando(false);
    }
  }

  function aggiornaRiga(chiave: string, campo: keyof RigaLavoro, valore: string | boolean) {
    setRighe((prev) =>
      prev.map((r) => (r.chiave === chiave ? { ...r, [campo]: valore } : r))
    );
  }

  function rimuoviRiga(chiave: string) {
    setRighe((prev) => prev.filter((r) => r.chiave !== chiave));
  }

  async function salvaTutto() {
    if (!fornitoreId) return;
    setSalvando(true);
    setErrore(null);

    const daSaltare: string[] = [];
    const inserimentiStorico: {
      prodotto_id: string;
      fornitore_id: string;
      data: string;
      numero_fattura: string | null;
      prezzo: number;
      quantita: number | null;
    }[] = [];
    const aggiornamentiPrezzo: { id: string; prezzo: number }[] = [];

    for (const r of righe) {
      if (!r.prodottoId) {
        daSaltare.push(r.descrizione);
        continue;
      }
      const prezzo = parseFloat(r.prezzo.replace(",", "."));
      if (isNaN(prezzo)) {
        daSaltare.push(r.descrizione);
        continue;
      }
      const quantita = r.quantita ? parseFloat(r.quantita.replace(",", ".")) : null;

      inserimentiStorico.push({
        prodotto_id: r.prodottoId,
        fornitore_id: fornitoreId,
        data: dataDocumento || new Date().toISOString().slice(0, 10),
        numero_fattura: numeroDdt ? `DDT ${numeroDdt}` : null,
        prezzo,
        quantita,
      });

      if (r.aggiornaPrezzo) {
        aggiornamentiPrezzo.push({ id: r.prodottoId, prezzo });
      }
    }

    if (inserimentiStorico.length > 0) {
      const { error } = await supabase.from("storico_prezzi_fatture").insert(inserimentiStorico);
      if (error) {
        setErrore(`Errore nel salvataggio dello storico: ${error.message}`);
        setSalvando(false);
        return;
      }
    }

    for (const agg of aggiornamentiPrezzo) {
      // Il prezzo della bolla è il netto realmente pagato: aggiornando il
      // listino azzeriamo anche eventuali sconti a cascata già impostati,
      // altrimenti il prezzo netto calcolato risulterebbe diverso da quello
      // pagato davvero.
      const { error } = await supabase
        .from("prodotti")
        .update({ prezzo_listino: agg.prezzo, sconto1: 0, sconto2: 0, sconto3: 0 })
        .eq("id", agg.id);
      if (error) {
        setErrore(`Errore nell'aggiornamento del prezzo: ${error.message}`);
        setSalvando(false);
        return;
      }
    }

    setSalvando(false);
    setSalvato(true);
    setRighe([]);
    setEstrazioneFatta(false);
    setAnteprimaUrl(null);
    setNumeroDdt("");
    setDataDocumento("");
    if (inputFotoRef.current) inputFotoRef.current.value = "";

    if (daSaltare.length > 0) {
      setErrore(
        `Attenzione: ${daSaltare.length} riga/e non abbinata/e a un prodotto non è stata salvata (${daSaltare.join(", ")}). Aggiungi prima il prodotto in Pannello, poi registra di nuovo quella riga.`
      );
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <label className="mb-3 block text-xs text-neutral-500">
          Fornitore
          <select
            value={fornitoreId}
            onChange={(e) => {
              setFornitoreId(e.target.value);
              setRighe([]);
              setEstrazioneFatta(false);
              setAnteprimaUrl(null);
            }}
            className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          >
            {fornitori.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </label>

        <input
          ref={inputFotoRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) scattaOCarica(file);
          }}
        />
        <button
          onClick={() => inputFotoRef.current?.click()}
          disabled={!fornitoreId || caricando}
          className="w-full rounded-lg bg-neutral-900 px-4 py-3 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {caricando ? "Leggo la bolla…" : "📷 Fai foto o carica bolla"}
        </button>

        {anteprimaUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={anteprimaUrl} alt="Anteprima bolla" className="mt-3 max-h-48 rounded-lg border border-neutral-200 object-contain" />
        )}
      </div>

      {errore && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errore}</p>
      )}

      {salvato && (
        <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
          ✓ Bolla registrata. Fai la prossima foto quando vuoi.
        </p>
      )}

      {estrazioneFatta && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="mb-3 flex gap-3">
            <label className="flex-1 text-xs text-neutral-500">
              Numero DDT
              <input
                type="text"
                value={numeroDdt}
                onChange={(e) => setNumeroDdt(e.target.value)}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
            </label>
            <label className="flex-1 text-xs text-neutral-500">
              Data
              <input
                type="date"
                value={dataDocumento}
                onChange={(e) => setDataDocumento(e.target.value)}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
            </label>
          </div>

          {righe.length === 0 && (
            <p className="text-sm text-neutral-500">
              Non ho trovato righe leggibili in questa foto. Riprova con un'inquadratura più
              chiara.
            </p>
          )}

          <div className="space-y-3">
            {righe.map((r) => {
              const prodottoScelto = prodottoDa(r.prodottoId);
              const prezzoAttuale = prodottoScelto?.prezzo_listino ?? null;
              const prezzoNuovo = parseFloat(r.prezzo.replace(",", "."));
              const prezzoCambiato =
                prodottoScelto &&
                prezzoAttuale != null &&
                !isNaN(prezzoNuovo) &&
                Math.abs(prezzoAttuale - prezzoNuovo) > 0.004;

              return (
                <div key={r.chiave} className="rounded-lg border border-neutral-200 p-3">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <input
                      type="text"
                      value={r.descrizione}
                      onChange={(e) => aggiornaRiga(r.chiave, "descrizione", e.target.value)}
                      className="flex-1 rounded-md border border-neutral-300 px-2 py-1.5 text-sm font-medium outline-none focus:border-neutral-500"
                    />
                    <button
                      onClick={() => rimuoviRiga(r.chiave)}
                      className="shrink-0 rounded-md px-2 py-1.5 text-xs text-neutral-400 hover:bg-neutral-100 hover:text-red-600"
                      title="Rimuovi questa riga"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mb-2 flex gap-2">
                    <label className="w-24 text-xs text-neutral-500">
                      Quantità
                      <input
                        type="text"
                        value={r.quantita}
                        onChange={(e) => aggiornaRiga(r.chiave, "quantita", e.target.value)}
                        className="mt-1 block w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-neutral-500"
                      />
                    </label>
                    <label className="w-28 text-xs text-neutral-500">
                      Prezzo (€)
                      <input
                        type="text"
                        value={r.prezzo}
                        onChange={(e) => aggiornaRiga(r.chiave, "prezzo", e.target.value)}
                        className="mt-1 block w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-neutral-500"
                      />
                    </label>
                    <label className="w-20 text-xs text-neutral-500">
                      UM
                      <input
                        type="text"
                        value={r.um}
                        onChange={(e) => aggiornaRiga(r.chiave, "um", e.target.value)}
                        className="mt-1 block w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-neutral-500"
                      />
                    </label>
                  </div>

                  <label className="block text-xs text-neutral-500">
                    Prodotto a sistema
                    <select
                      value={r.prodottoId}
                      onChange={(e) => aggiornaRiga(r.chiave, "prodottoId", e.target.value)}
                      className="mt-1 block w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-neutral-500"
                    >
                      <option value="">— nessuna corrispondenza, scegli tu —</option>
                      {prodottiFornitore.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.descrizione}
                        </option>
                      ))}
                    </select>
                  </label>

                  {!r.prodottoId && (
                    <p className="mt-1.5 text-xs text-amber-600">
                      Nessun prodotto abbinato: questa riga non verrà salvata finché non ne scegli
                      uno (o la rimuovi con ✕).
                    </p>
                  )}

                  {prezzoCambiato && (
                    <div className="mt-2 flex items-center justify-between rounded-md bg-amber-50 px-2.5 py-2 text-xs">
                      <span className="text-amber-800">
                        Prezzo cambiato: €{prezzoAttuale?.toFixed(2)} → €{prezzoNuovo.toFixed(2)}
                      </span>
                      <label className="flex items-center gap-1.5 text-amber-800">
                        <input
                          type="checkbox"
                          checked={r.aggiornaPrezzo}
                          onChange={(e) => aggiornaRiga(r.chiave, "aggiornaPrezzo", e.target.checked)}
                        />
                        Aggiorna il listino
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {righe.length > 0 && (
            <button
              onClick={salvaTutto}
              disabled={salvando}
              className="mt-4 w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {salvando ? "Salvo…" : `Salva ${righe.filter((r) => r.prodottoId).length} di ${righe.length} righe`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
