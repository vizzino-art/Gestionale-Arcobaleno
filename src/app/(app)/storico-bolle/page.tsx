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
  fornitore_id: string;
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
  fornitoreId: string;
  fornitoreNome: string;
  numeroDdt: string;
  data: string;
  righe: RigaBolla[];
};

// Riga di fattura elettronica collegata a un DDT (join su fatture_ricevute
// per sapere fornitore/numero/data della fattura che la contiene) — usata
// solo per capire quali bolle sono già state fatturate, stesso identico
// criterio (numero_fattura "DDT <numero>" ↔ ddt_numero) già usato dal
// bottone "Confronta con le bolle" in Registro Fatture.
type RigaFatturaConDdt = {
  ddt_numero: string | null;
  fatture_ricevute: { fornitore_id: string | null; numero: string; data: string } | null;
};

type FatturaMinima = {
  fornitore_id: string | null;
  numero: string;
  data: string;
};

function formattaData(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Riduce un riferimento (numero DDT o numero fattura) a sole lettere/cifre
// maiuscole, togliendo gli zeri iniziali di ogni blocco di cifre — serve a
// riconoscere che "H4/32016" (DDT letto dalla bolla) e "H4 000032016"
// (numero della fattura elettronica corrispondente) sono lo stesso
// documento. Capita spesso con fornitori tipo supermercato (Unicomm,
// Tosano...) la cui fattura elettronica non riporta affatto un DDT
// collegato in modo strutturato: il "DDT" che Mauro legge sulla carta è di
// fatto lo stesso numero del documento, solo scritto in modo diverso.
function normalizzaRiferimento(s: string): string {
  return s
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/\d+/g, (blocco) => blocco.replace(/^0+(?=\d)/, ""));
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
    .select(
      "id, data, numero_fattura, prezzo, quantita, fornitore_id, prodotti(descrizione, um), fornitori(nome)"
    )
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
      b = { chiave, fornitoreId: r.fornitore_id, fornitoreNome, numeroDdt, data: r.data, righe: [] };
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

  // Per ogni bolla, verifica se esiste già una fattura elettronica registrata
  // (Registro Fatture) con lo stesso fornitore e lo stesso numero DDT tra le
  // sue righe — solo un'indicazione visiva calcolata al volo, nessuna
  // scrittura nel database. Non c'è nessun rischio di doppio conteggio nei
  // prezzi: questa pagina e Registro Fatture leggono/scrivono tabelle
  // separate (storico_prezzi_fatture per le bolle, fatture_ricevute /
  // righe_fatture_ricevute per le fatture), questo indicatore serve solo a
  // vederlo a colpo d'occhio.
  const numeriDdtRaw = Array.from(
    new Set(
      bolle
        .map((b) => b.numeroDdt.replace(/^DDT\s+/i, "").trim())
        .filter((n) => n.length > 0 && n !== "—")
    )
  );

  const fattureIndice = new Map<string, { numero: string; data: string }>();
  if (numeriDdtRaw.length > 0) {
    const { data: righeFatture } = await supabase
      .from("righe_fatture_ricevute")
      .select("ddt_numero, fatture_ricevute(fornitore_id, numero, data)")
      .in("ddt_numero", numeriDdtRaw);

    for (const r of (righeFatture ?? []) as unknown as RigaFatturaConDdt[]) {
      const fattura = r.fatture_ricevute;
      if (!r.ddt_numero || !fattura?.fornitore_id) continue;
      const chiave = `${fattura.fornitore_id}__${r.ddt_numero}`;
      if (!fattureIndice.has(chiave)) {
        fattureIndice.set(chiave, { numero: fattura.numero, data: fattura.data });
      }
    }
  }

  // Ripiego: alcuni fornitori (es. Unicomm, Tosano — vendita tipo
  // supermercato) non riportano nella fattura elettronica un DDT collegato
  // in modo strutturato, quindi il confronto sopra non trova mai nulla per
  // loro. In questo caso confrontiamo il numero DDT della bolla con il
  // numero stesso della fattura (normalizzato), che per questi fornitori è
  // di fatto lo stesso riferimento scritto in modo leggermente diverso.
  const fattureIndicePerNumero = new Map<string, { numero: string; data: string }>();
  const fornitoreIds = Array.from(new Set(bolle.map((b) => b.fornitoreId)));
  if (fornitoreIds.length > 0) {
    const { data: fatture } = await supabase
      .from("fatture_ricevute")
      .select("fornitore_id, numero, data")
      .in("fornitore_id", fornitoreIds);

    for (const f of (fatture ?? []) as unknown as FatturaMinima[]) {
      if (!f.fornitore_id) continue;
      const chiave = `${f.fornitore_id}__${normalizzaRiferimento(f.numero)}`;
      if (!fattureIndicePerNumero.has(chiave)) {
        fattureIndicePerNumero.set(chiave, { numero: f.numero, data: f.data });
      }
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-neutral-900">Storico bolle</h1>
      <p className="mb-4 text-sm text-neutral-500">
        Le bolle registrate con &quot;Registra bolla&quot;, più recenti in cima — utile per il
        controllo di fine mese con la fattura riepilogativa del fornitore. Ogni bolla mostra se è
        già stata abbinata a una fattura elettronica registrata in Registro Fatture (stesso
        fornitore e numero DDT) oppure se è ancora in attesa. Ultime {righe.length} righe.
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
          const numeroDdtRaw = b.numeroDdt.replace(/^DDT\s+/i, "").trim();
          const fatturata =
            fattureIndice.get(`${b.fornitoreId}__${numeroDdtRaw}`) ??
            fattureIndicePerNumero.get(`${b.fornitoreId}__${normalizzaRiferimento(numeroDdtRaw)}`) ??
            null;
          return (
            <details
              key={b.chiave}
              className="rounded-xl border border-neutral-200 bg-white p-4"
              open
            >
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm font-medium text-neutral-900">
                <span>
                  {b.fornitoreNome} — {b.numeroDdt} — {formattaData(b.data)}
                </span>
                <span className="flex shrink-0 flex-wrap items-center gap-2">
                  {fatturata ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      📄 Fatturata — {fatturata.numero} del {formattaData(fatturata.data)}
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                      ⏳ In attesa di fattura
                    </span>
                  )}
                  <span className="text-neutral-500">
                    {b.righe.length} {b.righe.length === 1 ? "riga" : "righe"} · €{totale.toFixed(2)}
                  </span>
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
