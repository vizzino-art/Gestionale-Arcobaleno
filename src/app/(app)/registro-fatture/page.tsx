import { createClient } from "@/lib/supabase/server";
import {
  RegistroFattureClient,
  type CollegamentoBolla,
  type FatturaSalvata,
} from "@/components/RegistroFattureClient";
import { raggruppaBolle, type RigaBollaGrezza } from "@/lib/bolle";
import type { Conto, Fornitore } from "@/lib/types";

export default async function RegistroFatturePage() {
  const supabase = await createClient();

  const [
    { data: fornitori, error: erroreFornitori },
    { data: fatture, error: erroreFatture },
    { data: conti, error: erroreConti },
    { data: righeBolle, error: erroreBolle },
    { data: collegamenti, error: erroreCollegamenti },
  ] = await Promise.all([
    supabase.from("fornitori").select("*").order("nome", { ascending: true }),
    supabase
      // rate_pagamento_fatture(*, movimenti_prima_nota(conto_id)): per ogni
      // rata già pagata, il conto scelto l'ultima volta (quando il metodo
      // era Bonifico/Altro) — così riaprendo il pagamento il menu conto è
      // già precompilato invece di richiedere la scelta da capo.
      .from("fatture_ricevute")
      .select("*, righe_fatture_ricevute(*), rate_pagamento_fatture(*, movimenti_prima_nota(conto_id))")
      .order("data", { ascending: false })
      .order("numero_linea", { foreignTable: "righe_fatture_ricevute", ascending: true })
      .order("numero_rata", { foreignTable: "rate_pagamento_fatture", ascending: true }),
    supabase.from("conti").select("*").order("ordine", { ascending: true }),
    // Bolle (da "Registra bolla"), per il collegamento manuale a una
    // fattura quando il confronto automatico in Storico bolle non basta.
    supabase
      .from("storico_prezzi_fatture")
      .select("id, data, numero_fattura, prezzo, quantita, fornitore_id, prodotti(descrizione, um)")
      .like("numero_fattura", "DDT %")
      .order("data", { ascending: false }),
    supabase.from("collegamenti_bolla_fattura").select("id, fornitore_id, numero_ddt, data_ddt, fattura_id"),
  ]);

  const errore = erroreFornitori || erroreFatture || erroreConti || erroreBolle || erroreCollegamenti;

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
          conti={(conti ?? []) as Conto[]}
          bolle={raggruppaBolle((righeBolle ?? []) as unknown as RigaBollaGrezza[])}
          collegamentiIniziali={(collegamenti ?? []) as CollegamentoBolla[]}
        />
      )}
    </div>
  );
}
