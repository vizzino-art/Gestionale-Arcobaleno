"use client";

import { useMemo, useState } from "react";
import {
  calcolaOrdine,
  formattaDataBreve,
  formattaMessaggioWhatsApp,
  linkWhatsApp,
  prossimaConsegna,
} from "@/lib/ordina";
import type { Fornitore, Prodotto } from "@/lib/types";

type Props = {
  fornitori: Fornitore[];
  prodotti: Prodotto[];
};

function arrotonda(n: number): number {
  return Math.round(n * 100) / 100;
}

export function RiepilogoClient({ fornitori, prodotti }: Props) {
  const [copiatoId, setCopiatoId] = useState<string | null>(null);

  const riepilogoPerFornitore = useMemo(() => {
    return fornitori
      .map((f) => {
        const prodottiFornitore = prodotti
          .filter((p) => p.fornitore_id === f.id)
          // A parità di "ordine" (duplicati nei dati migrati), l'ordine
          // alfabetico rende il risultato stabile invece che casuale.
          .sort((a, b) => a.ordine - b.ordine || a.descrizione.localeCompare(b.descrizione, "it"));
        const righe = prodottiFornitore.map((p) => calcolaOrdine(p)).filter((r) => r !== null);
        return { fornitore: f, righe };
      })
      .filter((x) => x.righe.length > 0);
  }, [fornitori, prodotti]);

  async function copia(fornitoreId: string, testo: string) {
    await navigator.clipboard.writeText(testo);
    setCopiatoId(fornitoreId);
    setTimeout(() => setCopiatoId(null), 1500);
  }

  if (riepilogoPerFornitore.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        Nessun ordine necessario in questo momento: il magazzino di tutti i prodotti è già
        al livello obiettivo.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {riepilogoPerFornitore.map(({ fornitore, righe }) => {
        const testo = formattaMessaggioWhatsApp(fornitore.nome, fornitore.giorno_consegna, righe);
        return (
          <div key={fornitore.id} className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-neutral-900">{fornitore.nome}</p>
                <p className="text-xs text-neutral-500">
                  {righe.length} {righe.length === 1 ? "articolo" : "articoli"} da ordinare
                  {fornitore.giorno_consegna &&
                    ` · consegna ${formattaDataBreve(prossimaConsegna(fornitore.giorno_consegna))}`}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => copia(fornitore.id, testo)}
                  className="rounded-lg bg-neutral-900 px-3 py-2 text-xs font-medium text-white hover:bg-neutral-800"
                >
                  {copiatoId === fornitore.id ? "Copiato ✓" : "Copia messaggio"}
                </button>
                {fornitore.telefono && (
                  <a
                    href={linkWhatsApp(fornitore.telefono, testo)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700"
                  >
                    WhatsApp
                  </a>
                )}
              </div>
            </div>
            <div className="divide-y divide-neutral-100 text-sm">
              {righe.map((r) => (
                <div key={r.prodotto.id} className="flex items-center justify-between py-1.5">
                  <span className="text-neutral-700">{r.prodotto.descrizione}</span>
                  <span className="font-medium text-neutral-900">
                    {arrotonda(r.quantitaOrdine)} {r.unitaMostrata}
                    {r.quantitaOmaggio > 0 && (
                      <span className="text-green-700"> (+{arrotonda(r.quantitaOmaggio)} omaggio)</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
