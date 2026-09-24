import { createClient } from "@/lib/supabase/server";
import { PrimaNotaClient } from "@/components/PrimaNotaClient";
import type { Conto, Controparte, MovimentoPrimaNota, SaldoConto } from "@/lib/types";

// Quanti movimenti recenti carichiamo all'apertura della pagina. Basso di
// proposito: quando arriverà l'importazione dello storico (15.932 righe dal
// vecchio file Excel) non vogliamo caricarle tutte ad ogni apertura — la
// ricerca/filtro nella schermata interroga direttamente Supabase quando serve
// andare oltre questi ultimi movimenti.
const MOVIMENTI_RECENTI = 200;

export default async function PrimaNotaPage() {
  const supabase = await createClient();
  const oggiIso = new Date().toISOString().slice(0, 10);

  const [
    { data: conti, error: erroreConti },
    { data: movimenti, error: erroreMovimenti },
    { data: saldi, error: erroreSaldi },
    // Pianificati la cui data è arrivata (oggi o prima): non basta guardare
    // solo i MOVIMENTI_RECENTI, perché uno pianificato tempo fa può essere
    // ormai "uscito" da quella finestra man mano che si accumulano
    // movimenti più recenti — va cercato a parte, senza limite di quantità.
    { data: daConfermare, error: erroreDaConfermare },
    // Fase 2 (23/9): solo i nomi, per suggerirli nel campo causale — un
    // errore qui non deve bloccare il resto della pagina, la lista di
    // suggerimenti resta semplicemente vuota (il campo causale è comunque
    // libero, non obbligatorio sceglierne uno).
    { data: controparti, error: erroreControparti },
  ] = await Promise.all([
    supabase.from("conti").select("*").order("ordine", { ascending: true }),
    supabase
      .from("movimenti_prima_nota")
      .select("*")
      .order("data", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(MOVIMENTI_RECENTI),
    supabase.from("v_saldi_conti").select("*"),
    supabase
      .from("movimenti_prima_nota")
      .select("*")
      .eq("stato", "pianificato")
      .lte("data", oggiIso)
      .order("data", { ascending: true }),
    supabase.from("controparti").select("nome").order("nome", { ascending: true }),
  ]);

  const errore = erroreConti || erroreMovimenti || erroreSaldi || erroreDaConfermare;
  if (erroreControparti) {
    console.error("Errore nel caricamento controparti (solo suggerimenti causale):", erroreControparti.message);
  }

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
          daConfermareIniziali={(daConfermare ?? []) as MovimentoPrimaNota[]}
          contropartiIniziali={(controparti ?? []) as Controparte[]}
        />
      )}
    </div>
  );
}
