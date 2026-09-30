"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Bolla } from "@/lib/bolle";

type Fatturata = { numero: string; data: string; fonte: "automatico" | "manuale" };

type Props = {
  bolle: Bolla[];
  // fornitoreId__numeroDdtRaw -> fattura trovata dal DDT esatto o dal numero
  // fattura normalizzato (vedi src/lib/bolle.ts)
  fattureAutomatiche: Record<string, { numero: string; data: string }>;
  // fornitoreId__numeroDdtRaw__data -> collegamento scelto a mano da Mauro
  // in Registro Fatture, ha sempre la precedenza sull'abbinamento automatico
  collegamentiManuali: Record<string, { numero: string; data: string }>;
};

function formattaData(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function StoricoBolleClient({ bolle, fattureAutomatiche, collegamentiManuali }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [rigaInModifica, setRigaInModifica] = useState<string | null>(null);
  const [prezzoModifica, setPrezzoModifica] = useState("");
  const [quantitaModifica, setQuantitaModifica] = useState("");
  const [salvataggioInCorso, setSalvataggioInCorso] = useState(false);
  const [erroreSalvataggio, setErroreSalvataggio] = useState<string | null>(null);

  function apriModifica(rigaId: string, prezzoAttuale: number, quantitaAttuale: number | null) {
    setRigaInModifica(rigaId);
    setPrezzoModifica(String(prezzoAttuale));
    setQuantitaModifica(quantitaAttuale != null ? String(quantitaAttuale) : "");
    setErroreSalvataggio(null);
  }

  function annullaModifica() {
    setRigaInModifica(null);
    setErroreSalvataggio(null);
  }

  async function salvaModifica(rigaId: string) {
    const prezzo = Number(prezzoModifica.replace(",", "."));
    if (!Number.isFinite(prezzo) || prezzo < 0) {
      setErroreSalvataggio("Prezzo non valido.");
      return;
    }
    const quantitaTesto = quantitaModifica.trim();
    const quantita = quantitaTesto === "" ? null : Number(quantitaTesto.replace(",", "."));
    if (quantitaTesto !== "" && (!Number.isFinite(quantita) || (quantita as number) < 0)) {
      setErroreSalvataggio("Quantità non valida.");
      return;
    }

    setSalvataggioInCorso(true);
    setErroreSalvataggio(null);
    // Corregge solo questa riga di storico prezzi — non tocca mai
    // prodotti.prezzo_listino: una correzione qui serve a rimettere a posto
    // un errore di lettura della bolla, non è detto sia il prezzo "vero" da
    // tenere a listino (quello si aggiorna, se serve, da un'altra bolla o a
    // mano in Pannello).
    const { error } = await supabase
      .from("storico_prezzi_fatture")
      .update({ prezzo, quantita })
      .eq("id", rigaId);
    setSalvataggioInCorso(false);

    if (error) {
      setErroreSalvataggio(`Errore nel salvataggio: ${error.message}`);
      return;
    }
    setRigaInModifica(null);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {bolle.map((b) => {
        const totale = b.righe.reduce((s, r) => s + r.prezzo * (r.quantita ?? 1), 0);
        const chiaveManuale = `${b.fornitoreId}__${b.numeroDdtRaw}__${b.data}`;
        const chiaveAutomatica = `${b.fornitoreId}__${b.numeroDdtRaw}`;
        const manuale = collegamentiManuali[chiaveManuale];
        const automatico = fattureAutomatiche[chiaveAutomatica];
        const fatturata: Fatturata | null = manuale
          ? { ...manuale, fonte: "manuale" }
          : automatico
            ? { ...automatico, fonte: "automatico" }
            : null;

        return (
          <details
            key={b.chiave}
            className="rounded-xl border border-neutral-200 bg-white p-4"
            open
          >
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm font-medium text-neutral-900">
              <span>
                {b.fornitoreNome} — DDT {b.numeroDdtRaw} — {formattaData(b.data)}
              </span>
              <span className="flex shrink-0 flex-wrap items-center gap-2">
                {fatturata ? (
                  <span
                    className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
                    title={fatturata.fonte === "manuale" ? "Collegata a mano da Registro Fatture" : "Trovata in automatico"}
                  >
                    📄 Fatturata — {fatturata.numero} del {formattaData(fatturata.data)}
                    {fatturata.fonte === "manuale" ? " 🔗" : ""}
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                    ⏳ In attesa di fattura
                  </span>
                )}
                <span className="text-neutral-500">
                  {b.righe.length} {b.righe.length === 1 ? "riga" : "righe"} · €{totale.toFixed(2)}
                </span>
              </span>
            </summary>
            <div className="mt-3 divide-y divide-neutral-100">
              {b.righe.map((r) => (
                <div key={r.id} className="py-1.5 text-sm">
                  {rigaInModifica === r.id ? (
                    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-neutral-50 p-2">
                      <span className="text-neutral-700">{r.descrizione}</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={quantitaModifica}
                        onChange={(e) => setQuantitaModifica(e.target.value)}
                        placeholder="quantità"
                        className="w-24 rounded border border-neutral-300 px-2 py-1 text-sm"
                      />
                      <span className="text-neutral-500">{r.um ?? ""} ×</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={prezzoModifica}
                        onChange={(e) => setPrezzoModifica(e.target.value)}
                        placeholder="prezzo"
                        className="w-24 rounded border border-neutral-300 px-2 py-1 text-sm"
                      />
                      <button
                        onClick={() => salvaModifica(r.id)}
                        disabled={salvataggioInCorso}
                        className="rounded bg-neutral-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                      >
                        {salvataggioInCorso ? "Salvo…" : "Salva"}
                      </button>
                      <button
                        onClick={annullaModifica}
                        disabled={salvataggioInCorso}
                        className="rounded border border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-700"
                      >
                        Annulla
                      </button>
                      {erroreSalvataggio && (
                        <span className="w-full text-xs text-red-700">{erroreSalvataggio}</span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-neutral-700">{r.descrizione}</span>
                      <span className="flex shrink-0 items-center gap-2 text-neutral-500">
                        {r.quantita != null ? `${r.quantita} ${r.um ?? ""} × ` : ""}€
                        {r.prezzo.toFixed(2)}
                        <button
                          onClick={() => apriModifica(r.id, r.prezzo, r.quantita)}
                          className="text-neutral-400 hover:text-neutral-700"
                          title="Correggi prezzo/quantità"
                        >
                          ✏️
                        </button>
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}
