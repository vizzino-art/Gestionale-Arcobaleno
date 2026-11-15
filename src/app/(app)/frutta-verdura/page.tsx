import { createClient } from "@/lib/supabase/server";
import { FruttaVerduraClient } from "@/components/FruttaVerduraClient";
import { BOZZA_VUOTA, type BozzaFruttaVerdura } from "@/lib/frutta-verdura";

export default async function FruttaVerduraPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bozza_frutta_verdura")
    .select("dati, aggiornato_il")
    .eq("id", 1)
    .maybeSingle();

  // Merge con BOZZA_VUOTA (non solo "?? BOZZA_VUOTA"): la riga esiste già
  // con "dati" a "{}" letterale (così l'ha creata la migrazione), quindi
  // senza merge bozza.qty/unit/extra/note risulterebbero undefined e la
  // pagina andrebbe in crash al primo accesso a bozza.qty["Asparagi"].
  const bozzaIniziale: BozzaFruttaVerdura = {
    ...BOZZA_VUOTA,
    ...(data?.dati as Partial<BozzaFruttaVerdura> | undefined),
  };
  const aggiornatoIlIniziale: string = data?.aggiornato_il ?? new Date(0).toISOString();

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-neutral-900">Frutta e Verdura</h1>
      <p className="mb-4 text-sm text-neutral-500">
        Ordine condiviso: le quantità inserite qui si vedono subito anche da un altro telefono (es.
        quello di tuo padre) senza bisogno di ricaricare la pagina a mano.
      </p>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Errore nel caricamento: {error.message}
        </p>
      )}

      {!error && (
        <FruttaVerduraClient bozzaIniziale={bozzaIniziale} aggiornatoIlIniziale={aggiornatoIlIniziale} />
      )}
    </div>
  );
}
