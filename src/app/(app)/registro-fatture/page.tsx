import { createClient } from "@/lib/supabase/server";
import {
  RegistroFattureClient,
  type CollegamentoBolla,
  type FatturaSalvata,
  type RataNonPagata,
} from "@/components/RegistroFattureClient";
import { raggruppaBolle, type RigaBollaGrezza } from "@/lib/bolle";
import type { Conto, Fornitore } from "@/lib/types";

// Righe come le restituisce la query "rate non ancora pagate" qui sotto:
// solo i campi della fattura che servono a etichettare la rata, più le sue
// rate_pagamento_fatture (già filtrate server-side alle sole non pagate).
type FatturaPerRateNonPagate = {
  id: string;
  fornitore_nome: string;
  numero: string;
  rate_pagamento_fatture: {
    id: string;
    numero_rata: number;
    importo: number;
    data_scadenza: string | null;
    modalita_pagamento: string | null;
    iban: string | null;
    data_pagamento_effettivo: string | null;
    metodo_pagamento_effettivo: string | null;
    movimenti_prima_nota: { conto_id: string }[];
  }[];
};

export default async function RegistroFatturePage() {
  const supabase = await createClient();

  // Richiesto da Mauro il 13/10: con tutto lo storico la pagina si era fatta
  // lenta ad aprirsi, quindi di default carichiamo solo le fatture (con
  // righe e rate) degli ultimi 6 mesi — per quelle più vecchie c'è la
  // ricerca nel componente, che pesca dal database al bisogno.
  const seiMesiFa = new Date();
  seiMesiFa.setMonth(seiMesiFa.getMonth() - 6);
  const dataMinima = seiMesiFa.toISOString().slice(0, 10);

  const [
    { data: fornitori, error: erroreFornitori },
    { data: fatture, error: erroreFatture },
    { data: conti, error: erroreConti },
    { data: righeBolle, error: erroreBolle },
    { data: collegamenti, error: erroreCollegamenti },
    { data: fatturePerRateNonPagate, error: erroreRateNonPagate },
  ] = await Promise.all([
    supabase.from("fornitori").select("*").order("nome", { ascending: true }),
    supabase
      // rate_pagamento_fatture(*, movimenti_prima_nota(conto_id)): per ogni
      // rata già pagata, il conto scelto l'ultima volta (quando il metodo
      // era Bonifico/Altro) — così riaprendo il pagamento il menu conto è
      // già precompilato invece di richiedere la scelta da capo.
      .from("fatture_ricevute")
      .select("*, righe_fatture_ricevute(*), rate_pagamento_fatture(*, movimenti_prima_nota(conto_id))")
      .gte("data", dataMinima)
      .order("data", { ascending: false })
      .order("numero_linea", { foreignTable: "righe_fatture_ricevute", ascending: true })
      .order("numero_rata", { foreignTable: "rate_pagamento_fatture", ascending: true }),
    supabase.from("conti").select("*").order("ordine", { ascending: true }),
    // Bolle (da "Registra bolla"), per il collegamento manuale a una
    // fattura quando il confronto automatico in Storico bolle non basta —
    // stessa finestra di 6 mesi delle fatture sopra, che sono comunque le
    // uniche a cui si può collegare una bolla da questa pagina.
    supabase
      .from("storico_prezzi_fatture")
      .select("id, data, numero_fattura, prezzo, quantita, fornitore_id, prodotti(descrizione, um)")
      .like("numero_fattura", "DDT %")
      .gte("data", dataMinima)
      .order("data", { ascending: false }),
    supabase.from("collegamenti_bolla_fattura").select("id, fornitore_id, numero_ddt, data_ddt, fattura_id"),
    // Tutte le rate non ancora pagate, di QUALSIASI fattura anche più
    // vecchia dei 6 mesi sopra — query a parte apposta per non perdere di
    // vista una scadenza futura di una fattura vecchia (es. un piano rate
    // lungo) solo perché la fattura stessa non è più nella lista recente.
    // "!inner" + il filtro sul campo della tabella collegata fa sì che
    // Postgrest restituisca solo le fatture con almeno una rata non pagata,
    // e dentro a ciascuna solo le rate non pagate (non tutte).
    supabase
      .from("fatture_ricevute")
      .select(
        "id, fornitore_nome, numero, rate_pagamento_fatture!inner(id, numero_rata, importo, data_scadenza, modalita_pagamento, iban, data_pagamento_effettivo, metodo_pagamento_effettivo, movimenti_prima_nota(conto_id))"
      )
      .is("rate_pagamento_fatture.data_pagamento_effettivo", null),
  ]);

  const errore =
    erroreFornitori || erroreFatture || erroreConti || erroreBolle || erroreCollegamenti || erroreRateNonPagate;

  const rateNonPagateIniziali: RataNonPagata[] = (
    (fatturePerRateNonPagate ?? []) as unknown as FatturaPerRateNonPagate[]
  ).flatMap((f) =>
    f.rate_pagamento_fatture.map((r) => ({
      ...r,
      fatturaId: f.id,
      fornitoreNome: f.fornitore_nome,
      numeroFattura: f.numero,
    }))
  );

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
          rateNonPagateIniziali={rateNonPagateIniziali}
        />
      )}
    </div>
  );
}
