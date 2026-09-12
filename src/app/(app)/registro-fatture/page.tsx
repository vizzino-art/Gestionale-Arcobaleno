import { createClient } from "@/lib/supabase/server";
import { RegistroFattureClient, type FatturaSalvata } from "@/components/RegistroFattureClient";
import type { Fornitore } from "@/lib/types";

export default async function RegistroFatturePage() {
  const supabase = await createClient();

  const [{ data: fornitori, error: erroreFornitori }, { data: fatture, error: erroreFatture }] =
    await Promise.all([
      supabase.from("fornitori").select("*").order("nome", { ascending: true }),
      supabase
        .from("fatture_ricevute")
        .select("*, righe_fatture_ricevute(*), rate_pagamento_fatture(*)")
        .order("data", { ascending: false })
        .order("numero_linea", { foreignTable: "righe_fatture_ricevute", ascending: true })
        .order("numero_rata", { foreignTable: "rate_pagamento_fatture", ascending: true }),
    ]);

  const errore = erroreFornitori || erroreFatture;

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-neutral-900">Registro Fatture</h1>
      <p className="mb-4 text-sm text-neutral-500">
        Carica il file XML o P7M della fattura così come lo scarichi dalla PEC: i dati vengono letti
        automaticamente (fornitore, righe, scadenze di pagamento).
      </p>

      {errore && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Errore nel caricamento: {errore.message}
        </p>
      )}

      {!errore && (
        <RegistroFattureClient
          fornitori={(fornitori ?? []) as Fornitore[]}
          fattureIniziali={(fatture ?? []) as unknown as FatturaSalvata[]}
        />
      )}
    </div>
  );
}
