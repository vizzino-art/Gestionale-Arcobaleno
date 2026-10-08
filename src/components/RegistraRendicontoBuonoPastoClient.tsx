"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TipoBuonoPasto } from "@/lib/types";

type Props = {
  tipi: TipoBuonoPasto[];
  onSalvato: () => void;
  onAnnulla: () => void;
};

type RispostaEstrazione = {
  numero_documento: string | null;
  data_documento: string | null;
  periodo_da: string | null;
  periodo_a: string | null;
  numero_ticket: number | null;
  totale_lordo: number | null;
  importo_netto: number | null;
  data_pagamento_prevista: string | null;
};

// Stessa logica di compressione/lettura file di RegistraBollaClient — vedi i
// commenti lì per il perché dei limiti (1600px/JPEG 0.85 per le foto, 3 MB
// per i PDF, sotto il tetto delle funzioni server di Vercel).
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

const PDF_MAX_BYTES = 3 * 1024 * 1024;

async function leggiPdfComeBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  if (file.size > PDF_MAX_BYTES) {
    throw new Error(
      "Questo PDF è troppo pesante (oltre 3 MB) per essere inviato. Prova a esportare una versione più leggera, oppure fai direttamente una foto del documento."
    );
  }
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const risultato = reader.result as string;
      resolve(risultato.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(new Error("Lettura del PDF fallita"));
    reader.readAsDataURL(file);
  });
  return { base64, mediaType: "application/pdf" };
}

export function RegistraRendicontoBuonoPastoClient({ tipi, onSalvato, onAnnulla }: Props) {
  const supabase = createClient();
  const inputFileRef = useRef<HTMLInputElement>(null);

  const [tipoId, setTipoId] = useState(tipi[0]?.id ?? "");
  const [anteprimaUrl, setAnteprimaUrl] = useState<string | null>(null);
  const [anteprimaPdfNome, setAnteprimaPdfNome] = useState<string | null>(null);
  const [estrazioneFatta, setEstrazioneFatta] = useState(false);

  const [numeroDocumento, setNumeroDocumento] = useState("");
  const [dataDocumento, setDataDocumento] = useState("");
  const [periodoDa, setPeriodoDa] = useState("");
  const [periodoA, setPeriodoA] = useState("");
  const [numeroTicket, setNumeroTicket] = useState("");
  const [totaleLordo, setTotaleLordo] = useState("");
  const [importoNetto, setImportoNetto] = useState("");
  const [dataPagamentoPrevista, setDataPagamentoPrevista] = useState("");

  const [caricando, setCaricando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [duplicato, setDuplicato] = useState<boolean>(false);
  const [duplicatoConfermato, setDuplicatoConfermato] = useState(false);

  // Avvisa se questo numero di documento è già stato registrato per questo
  // tipo di buono pasto, stesso criterio di RegistraBollaClient per le bolle
  // — la chiave naturale qui è tipo + numero documento, non c'è un numero
  // DDT.
  useEffect(() => {
    let annullato = false;
    const timer = setTimeout(async () => {
      if (!tipoId || !numeroDocumento.trim()) {
        if (!annullato) setDuplicato(false);
        return;
      }
      const { count } = await supabase
        .from("rendiconti_buoni_pasto")
        .select("id", { count: "exact", head: true })
        .eq("tipo_id", tipoId)
        .eq("numero_documento", numeroDocumento.trim());
      if (!annullato) setDuplicato((count ?? 0) > 0);
    }, 400);
    return () => {
      annullato = true;
      clearTimeout(timer);
    };
  }, [tipoId, numeroDocumento, supabase]);

  async function scattaOCarica(file: File) {
    setErrore(null);
    setCaricando(true);
    setEstrazioneFatta(false);

    const ePdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (ePdf) {
      setAnteprimaUrl(null);
      setAnteprimaPdfNome(file.name);
    } else {
      setAnteprimaPdfNome(null);
      setAnteprimaUrl(URL.createObjectURL(file));
    }

    try {
      const { base64, mediaType } = ePdf ? await leggiPdfComeBase64(file) : await ridimensionaEComprimi(file);
      const risposta = await fetch("/api/estrai-rendiconto-buono-pasto", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ immagine: base64, mediaType }),
      });
      const dati = await risposta.json();

      if (!risposta.ok) {
        setErrore(dati?.errore ?? "Errore durante la lettura del documento.");
        setCaricando(false);
        return;
      }

      const estratto = dati as RispostaEstrazione;
      setNumeroDocumento(estratto.numero_documento ?? "");
      setDataDocumento(estratto.data_documento ?? "");
      setPeriodoDa(estratto.periodo_da ?? "");
      setPeriodoA(estratto.periodo_a ?? "");
      setNumeroTicket(estratto.numero_ticket != null ? String(estratto.numero_ticket) : "");
      setTotaleLordo(estratto.totale_lordo != null ? String(estratto.totale_lordo) : "");
      setImportoNetto(estratto.importo_netto != null ? String(estratto.importo_netto) : "");
      setDataPagamentoPrevista(estratto.data_pagamento_prevista ?? "");
      setEstrazioneFatta(true);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Errore imprevisto durante la lettura del documento.");
    } finally {
      setCaricando(false);
    }
  }

  async function salva() {
    if (!tipoId) {
      setErrore("Scegli un tipo di buono pasto.");
      return;
    }
    if (duplicato && !duplicatoConfermato) {
      setErrore("Questo numero di documento risulta già registrato: spunta la conferma sopra prima di salvare, se sei sicuro che non sia un doppione.");
      return;
    }
    const netto = importoNetto.trim() ? parseFloat(importoNetto.replace(",", ".")) : null;
    const lordo = totaleLordo.trim() ? parseFloat(totaleLordo.replace(",", ".")) : null;
    const ticket = numeroTicket.trim() ? parseInt(numeroTicket, 10) : null;
    if (importoNetto.trim() && (netto === null || isNaN(netto))) {
      setErrore("L'importo netto non è un numero valido.");
      return;
    }
    if (totaleLordo.trim() && (lordo === null || isNaN(lordo))) {
      setErrore("Il totale lordo non è un numero valido.");
      return;
    }

    setSalvando(true);
    setErrore(null);

    const { error } = await supabase.from("rendiconti_buoni_pasto").insert({
      tipo_id: tipoId,
      numero_documento: numeroDocumento.trim() || null,
      data_documento: dataDocumento || null,
      periodo_da: periodoDa || null,
      periodo_a: periodoA || null,
      numero_ticket: ticket,
      totale_lordo: lordo,
      importo_netto: netto,
      data_pagamento_prevista: dataPagamentoPrevista || null,
    });

    setSalvando(false);

    if (error) {
      setErrore(`Errore nel salvataggio: ${error.message}`);
      return;
    }

    onSalvato();
  }

  return (
    <div className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4">
      <label className="block text-xs text-neutral-500">
        Tipo di buono pasto
        <select
          value={tipoId}
          onChange={(e) => {
            setTipoId(e.target.value);
            setDuplicatoConfermato(false);
          }}
          className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
        >
          {tipi.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>
      </label>

      <input
        ref={inputFileRef}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) scattaOCarica(file);
        }}
      />
      <button
        onClick={() => inputFileRef.current?.click()}
        disabled={!tipoId || caricando}
        className="w-full rounded-lg bg-neutral-900 px-4 py-3 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
      >
        {caricando ? "Leggo il documento…" : "📷 Fai foto o carica il rendiconto/PDF"}
      </button>

      {anteprimaUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={anteprimaUrl} alt="Anteprima rendiconto" className="max-h-48 rounded-lg border border-neutral-200 object-contain" />
      )}
      {anteprimaPdfNome && (
        <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
          📄 {anteprimaPdfNome}
        </p>
      )}

      {errore && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errore}</p>}

      {estrazioneFatta && (
        <div className="space-y-3 border-t border-neutral-100 pt-3">
          {duplicato && (
            <div className="rounded-md bg-red-50 p-3 text-xs text-red-800">
              <p>
                ⚠️ Risulta già registrato un rendiconto con questo numero di documento per questo
                tipo di buono pasto. Controlla nell&apos;elenco qui sotto se l&apos;hai già
                inserito prima di continuare, per non registrarlo due volte.
              </p>
              <label className="mt-2 flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={duplicatoConfermato}
                  onChange={(e) => setDuplicatoConfermato(e.target.checked)}
                />
                Ho controllato, non è un doppione: registralo comunque
              </label>
            </div>
          )}

          <div className="flex gap-3">
            <label className="flex-1 text-xs text-neutral-500">
              Numero documento
              <input
                type="text"
                value={numeroDocumento}
                onChange={(e) => {
                  setNumeroDocumento(e.target.value);
                  setDuplicatoConfermato(false);
                }}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
            </label>
            <label className="flex-1 text-xs text-neutral-500">
              Data documento
              <input
                type="date"
                value={dataDocumento}
                onChange={(e) => setDataDocumento(e.target.value)}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
            </label>
          </div>

          <div className="flex gap-3">
            <label className="flex-1 text-xs text-neutral-500">
              Periodo dal
              <input
                type="date"
                value={periodoDa}
                onChange={(e) => setPeriodoDa(e.target.value)}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
            </label>
            <label className="flex-1 text-xs text-neutral-500">
              Periodo al
              <input
                type="date"
                value={periodoA}
                onChange={(e) => setPeriodoA(e.target.value)}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
            </label>
          </div>

          <label className="block text-xs text-neutral-500">
            Numero ticket
            <input
              type="text"
              inputMode="numeric"
              value={numeroTicket}
              onChange={(e) => setNumeroTicket(e.target.value)}
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            />
          </label>

          <div className="flex gap-3">
            <label className="flex-1 text-xs text-neutral-500">
              Totale lordo (€)
              <input
                type="text"
                inputMode="decimal"
                value={totaleLordo}
                onChange={(e) => setTotaleLordo(e.target.value)}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
            </label>
            <label className="flex-1 text-xs text-neutral-500">
              Importo netto (€) — quello che arriva in banca
              <input
                type="text"
                inputMode="decimal"
                value={importoNetto}
                onChange={(e) => setImportoNetto(e.target.value)}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
            </label>
          </div>

          <label className="block text-xs text-neutral-500">
            Data pagamento prevista
            <input
              type="date"
              value={dataPagamentoPrevista}
              onChange={(e) => setDataPagamentoPrevista(e.target.value)}
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            />
          </label>

          <div className="flex gap-2">
            <button
              onClick={salva}
              disabled={salvando || (duplicato && !duplicatoConfermato)}
              className="flex-1 rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {salvando ? "Salvo…" : "Salva rendiconto"}
            </button>
            <button
              onClick={onAnnulla}
              disabled={salvando}
              className="rounded-lg border border-neutral-300 px-4 py-3 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Annulla
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
