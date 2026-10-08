import { createClient } from "@/lib/supabase/server";
import { BuoniPastoClient } from "@/components/BuoniPastoClient";
import { trovaMovimentoAbbinato, type MovimentoMinimo } from "@/lib/buoniPasto";
import type { Conto, RendicontoBuonoPasto, TipoBuonoPasto } from "@/lib/types";

export default async function BuoniPastoPage() {
  const supabase = await createClient();

  const [
    { data: tipi, error: erroreTipi },
    { data: rendiconti, error: erroreRendiconti },
    { data: movimenti, error: erroreMovimenti },
    { data: conti, error: erroreConti },
  ] = await Promise.all([
    supabase.from("tipi_buoni_pasto").select("*").order("ordine", { ascending: true }),
    supabase
      .from("rendiconti_buoni_pasto")
      .select("*")
      .order("data_documento", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(300),
    // Solo gli incassi già avvenuti: un rendiconto può essere abbinato solo
    // a un movimento reale in entrata, mai a un'uscita né a un pianificato
    // (vedi src/lib/buoniPasto.ts — questa pagina legge, non scrive mai in
    // Prima Nota).
    supabase
      .from("movimenti_prima_nota")
      .select("id, data, causale, conto_id, importo")
      .eq("stato", "effettivo")
      .gt("importo", 0),
    supabase.from("conti").select("*").order("ordine", { ascending: true }),
  ]);

  const errore = erroreTipi || erroreRendiconti || erroreMovimenti || erroreConti;
  const tipiList = (tipi ?? []) as TipoBuonoPasto[];
  const rendicontiList = (rendiconti ?? []) as RendicontoBuonoPasto[];
  const movimentiList = (movimenti ?? []) as MovimentoMinimo[];
  const contiList = (conti ?? []) as Conto[];

  const tipiPerId = new Map(tipiList.map((t) => [t.id, t]));

  const abbinamenti: Record<string, MovimentoMinimo | null> = {};
  for (const r of rendicontiList) {
    const tipo = tipiPerId.get(r.tipo_id);
    abbinamenti[r.id] = trovaMovimentoAbbinato(r, tipo?.conto_atteso_id ?? null, movimentiList);
  }

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-neutral-900">Buoni Pasto</h1>
      <p className="mb-4 text-sm text-neutral-500">
        Monitoraggio e controllo dei rendiconti dei buoni pasto (Edenred e, in futuro, altri
        circuiti). Legge i movimenti di Prima Nota per segnalare se un rendiconto risulta già
        incassato, ma non scrive mai in Prima Nota: in caso di dubbio, il saldo vero resta sempre
        quello di Prima Nota.
      </p>

      {errore && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Errore nel caricamento: {errore.message}
        </p>
      )}

      {!errore && (
        <BuoniPastoClient
          tipiIniziali={tipiList}
          rendiconti={rendicontiList}
          abbinamenti={abbinamenti}
          conti={contiList}
        />
      )}
    </div>
  );
}
