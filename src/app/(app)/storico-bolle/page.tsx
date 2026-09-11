import { createClient } from "@/lib/supabase/server";

// Righe come tornano da Supabase con i join su prodotti/fornitori (nomi già
// risolti, non solo gli id) — tipizzate qui perché usate solo in questa
// pagina, sullo stesso pattern di altre viste con join in questo progetto.
type RigaStoricoConNomi = {
  id: string;
  data: string;
  numero_fattura: string | null;
  prezzo: number;
  quantita: number | null;
  prodotti: { descrizione: string; um: string | null } | null;
  fornitori: { nome: string } | null;
};

type RigaBolla = {
  id: string;
  descrizione: string;
  um: string | null;
  quantita: number | null;
  prezzo: number;
};

type Bolla = {
  chiave: string;
  fornitoreNome: string;
  numeroDdt: string;
  data: string;
  righe: RigaBolla[];
};

function formattaData(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function StoricoBollePage() {
  const supabase = await createClient();

  // Solo le righe registrate da "Registra bolla" (numero_fattura nel
  // formato "DDT <numero>"): lo storico prezzi migrato dal vecchio
  // gestionale ha un formato diverso e resta consultabile per prodotto in
  // Pannello (📈), qui vogliamo solo le bolle vere e proprie da riconciliare
  // con le fatture dei fornitori.
  const { data, error } = await supabase
    .from("storico_prezzi_fatture")
    .select("id, data, numero_fattura, prezzo, quantita, prodotti(descrizione, um), fornitori(nome)")
    .like("numero_fattura", "DDT %")
    .order("data", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);

  const righe = (data ?? []) as unknown as RigaStoricoConNomi[];

  const bolle: Bolla[] = [];
  const indice = new Map<string, Bolla>();
  for (const r of righe) {
    const fornitoreNome = r.fornitori?.nome ?? "—";
    const numeroDdt = r.numero_fattura ?? "—";
    const chiave = `${fornitoreNome}__${numeroDdt}__${r.data}`;
    let b = indice.get(chiave);
    if (!b) {
      b = { chiave, fornitoreNome, numeroDdt, data: r.data, righe: [] };
      indice.set(chiave, b);
      bolle.push(b);
    }
    b.righe.push({
      id: r.id,
      descrizione: r.prodotti?.descrizione ?? "Prodotto eliminato",
      um: r.prodotti?.um ?? null,
      quantita: r.quantita,
      prezzo: r.prezzo,
    });
  }

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-neutral-900">Storico bolle</h1>
      <p className="mb-4 text-sm text-neutral-500">
        Le bolle registrate con &quot;Registra bolla&quot;, più recenti in cima — utile per il
        controllo di fine mese con la fattura riepilogativa del fornitore. Ultime {righe.length}{" "}
        righe.
      </p>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Errore nel caricamento: {error.message}
        </p>
      )}

      {!error && bolle.length === 0 && (
        <p className="text-sm text-neutral-500">
          Nessuna bolla registrata ancora. Usa &quot;Registra bolla&quot; per aggiungerne una.
        </p>
      )}

      <div className="space-y-3">
        {bolle.map((b) => {
          const totale = b.righe.reduce((s, r) => s + r.prezzo * (r.quantita ?? 1), 0);
          return (
            <details
              key={b.chiave}
              className="rounded-xl border border-neutral-200 bg-white p-4"
              open
            >
              <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-medium text-neutral-900">
                <span>
                  {b.fornitoreNome} — {b.numeroDdt} — {formattaData(b.data)}
                </span>
                <span className="shrink-0 text-neutral-500">
                  {b.righe.length} {b.righe.length === 1 ? "riga" : "righe"} · €{totale.toFixed(2)}
                </span>
              </summary>
              <div className="mt-3 divide-y divide-neutral-100">
                {b.righe.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 py-1.5 text-sm"
                  >
                    <span className="text-neutral-700">{r.descrizione}</span>
                    <span className="shrink-0 text-neutral-500">
                      {r.quantita != null ? `${r.quantita} ${r.um ?? ""} × ` : ""}€
                      {r.prezzo.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
