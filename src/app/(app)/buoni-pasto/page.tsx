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

  // Rendiconti che al salvataggio hanno creato un movimento "pianificato" in
  // Prima Nota (vedi RegistraRendicontoBuonoPastoClient): li rileggiamo qui
  // per sapere se sono ancora pianificati o se sono già stati confermati da
  // Prima Nota (a quel punto diventano "effettivo" e compaiono già tra gli
  // abbinamenti sopra, quindi qui non vanno più mostrati come pianificati).
  const idPianificati = rendicontiList
    .map((r) => r.movimento_pianificato_id)
    .filter((id): id is string => id !== null);
  const pianificatiPerId = new Map<string, MovimentoMinimo & { stato: string }>();
  if (idPianificati.length > 0) {
    const { data: pianificati } = await supabase
      .from("movimenti_prima_nota")
      .select("id, data, causale, conto_id, importo, stato")
      .in("id", idPianificati);
    for (const m of pianificati ?? []) {
      pianificatiPerId.set(m.id, m as MovimentoMinimo & { stato: string });
    }
  }

  const abbinamenti: Record<string, MovimentoMinimo | null> = {};
  const pianificatiInAttesa: Record<string, MovimentoMinimo | null> = {};
  for (const r of rendicontiList) {
    const tipo = tipiPerId.get(r.tipo_id);
    abbinamenti[r.id] = trovaMovimentoAbbinato(r, tipo?.conto_atteso_id ?? null, movimentiList);
    const pianificato = r.movimento_pianificato_id ? pianificatiPerId.get(r.movimento_pianificato_id) : undefined;
    pianificatiInAttesa[r.id] = pianificato && pianificato.stato === "pianificato" ? pianificato : null;
  }

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-neutral-900">Buoni Pasto</h1>
      <p className="mb-4 text-sm text-neutral-500">
        Monitoraggio e controllo dei rendiconti dei buoni pasto (Edenred e, in futuro, altri
        circuiti). Alla registrazione crea in Prima Nota un movimento pianificato con l&apos;incasso
        atteso (se il tipo ha un conto di accredito impostato); quando il bonifico arriva davvero,
        confermalo da Prima Nota con &quot;✓ È avvenuto&quot; — diventa lo stesso movimento effettivo,
        mai un doppione.
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
          pianificatiInAttesa={pianificatiInAttesa}
          conti={contiList}
        />
      )}
    </div>
  );
}
