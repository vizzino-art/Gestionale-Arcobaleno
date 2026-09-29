import { createClient } from "@/lib/supabase/server";
import { DitteClient } from "@/components/DitteClient";
import type { Controparte } from "@/lib/types";

export default async function DittePage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("controparti")
    .select("*")
    .order("nome", { ascending: true });

  const ditte = (data ?? []) as Controparte[];

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-neutral-900">Ditte</h1>
      <p className="mb-4 text-sm text-neutral-500">
        Anagrafica di tutte le controparti a cui è stato fatto un pagamento (fornitori di servizi, utenze,
        professionisti…) — separata dai Fornitori di prodotti. Molte righe hanno solo il nome: completa IBAN,
        P.IVA, SDI e indirizzo quando ti servono.
      </p>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Errore nel caricamento: {error.message}
        </p>
      )}

      {!error && ditte.length === 0 && (
        <p className="mb-4 text-sm text-neutral-500">Nessuna ditta ancora.</p>
      )}

      {!error && <DitteClient ditteIniziali={ditte} />}
    </div>
  );
}
