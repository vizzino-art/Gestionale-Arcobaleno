import { createClient } from "@/lib/supabase/server";
import { PrimaNotaClient } from "@/components/PrimaNotaClient";
import type { Conto, MovimentoPrimaNota, SaldoConto } from "@/lib/types";

// Quanti movimenti recenti carichiamo all'apertura della pagina. Basso di
// proposito: quando arriverà l'importazione dello storico (15.932 righe dal
// vecchio file Excel) non vogliamo caricarle tutte ad ogni apertura — la
// ricerca/filtro nella schermata interroga direttamente Supabase quando serve
// andare oltre questi ultimi movimenti.
const MOVIMENTI_RECENTI = 200;

export default async function PrimaNotaPage() {
  const supabase = await createClient();

  const [
    { data: conti, error: erroreConti },
    { data: movimenti, error: erroreMovimenti },
    { data: saldi, error: erroreSaldi },
  ] = await Promise.all([
    supabase.from("conti").select("*").order("ordine", { ascending: true }),
    supabase
      .from("movimenti_prima_nota")
      .select("*")
      .order("data", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(MOVIMENTI_RECENTI),
    supabase.from("v_saldi_conti").select("*"),
  ]);

  const errore = erroreConti || erroreMovimenti || erroreSaldi;

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-neutral-900">Prima Nota</h1>
      <p className="mb-4 text-sm text-neutral-500">
        Registro movimenti multi-conto (Volksbank, Trento, Sumup, Cassa, Mutuo, Carta di credito). Segna un
        movimento come pianificato se non è ancora avvenuto (es. una rata futura) per vederlo nel saldo
        previsto senza che tocchi il saldo attuale.
      </p>

      {errore && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Errore nel caricamento: {errore.message}
        </p>
      )}

      {!errore && (
        <PrimaNotaClient
          conti={(conti ?? []) as Conto[]}
          movimentiIniziali={(movimenti ?? []) as MovimentoPrimaNota[]}
          saldiIniziali={(saldi ?? []) as SaldoConto[]}
        />
      )}
    </div>
  );
}
