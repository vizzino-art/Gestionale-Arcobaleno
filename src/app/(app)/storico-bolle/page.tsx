import { createClient } from "@/lib/supabase/server";
import { StoricoBolleClient } from "@/components/StoricoBolleClient";
import { raggruppaBolle, normalizzaRiferimento, type RigaBollaGrezza } from "@/lib/bolle";

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

type CollegamentoManuale = {
  fornitore_id: string;
  numero_ddt: string;
  data_ddt: string;
  fatture_ricevute: { numero: string; data: string } | null;
};

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

  const righe = (data ?? []) as unknown as RigaBollaGrezza[];
  const bolle = raggruppaBolle(righe);

  // Per ogni bolla, verifica se esiste già una fattura elettronica registrata
  // (Registro Fatture) con lo stesso fornitore e lo stesso numero DDT tra le
  // sue righe, o se Mauro l'ha collegata a mano da Registro Fatture — solo
  // un'indicazione visiva, nessuna scrittura nel database da questa pagina.
  // Non c'è nessun rischio di doppio conteggio nei prezzi: questa pagina e
  // Registro Fatture leggono/scrivono tabelle separate (storico_prezzi_fatture
  // per le bolle, fatture_ricevute / righe_fatture_ricevute per le fatture),
  // questo indicatore serve solo a vederlo a colpo d'occhio.
  const numeriDdtRaw = Array.from(
    new Set(bolle.map((b) => b.numeroDdtRaw).filter((n) => n !== "—"))
  );

  const fattureAutomatiche: Record<string, { numero: string; data: string }> = {};

  if (numeriDdtRaw.length > 0) {
    const { data: righeFatture } = await supabase
      .from("righe_fatture_ricevute")
      .select("ddt_numero, fatture_ricevute(fornitore_id, numero, data)")
      .in("ddt_numero", numeriDdtRaw);

    for (const r of (righeFatture ?? []) as unknown as RigaFatturaConDdt[]) {
      const fattura = r.fatture_ricevute;
      if (!r.ddt_numero || !fattura?.fornitore_id) continue;
      const chiave = `${fattura.fornitore_id}__${r.ddt_numero}`;
      if (!fattureAutomatiche[chiave]) {
        fattureAutomatiche[chiave] = { numero: fattura.numero, data: fattura.data };
      }
    }
  }

  // Ripiego: alcuni fornitori (es. Unicomm, Tosano — vendita tipo
  // supermercato) non riportano nella fattura elettronica un DDT collegato
  // in modo strutturato, quindi il confronto sopra non trova mai nulla per
  // loro. In questo caso confrontiamo il numero DDT della bolla con il
  // numero stesso della fattura (normalizzato), che per questi fornitori è
  // di fatto lo stesso riferimento scritto in modo leggermente diverso.
  const fornitoreIds = Array.from(new Set(bolle.map((b) => b.fornitoreId)));
  if (fornitoreIds.length > 0) {
    const { data: fatture } = await supabase
      .from("fatture_ricevute")
      .select("fornitore_id, numero, data")
      .in("fornitore_id", fornitoreIds);

    const fattureIndicePerNumero = new Map<string, { numero: string; data: string }>();
    for (const f of (fatture ?? []) as unknown as FatturaMinima[]) {
      if (!f.fornitore_id) continue;
      const chiave = `${f.fornitore_id}__${normalizzaRiferimento(f.numero)}`;
      if (!fattureIndicePerNumero.has(chiave)) {
        fattureIndicePerNumero.set(chiave, { numero: f.numero, data: f.data });
      }
    }

    for (const numeroDdtRaw of numeriDdtRaw) {
      // Applicato per ogni fornitore che ha almeno una bolla con questo DDT
      for (const fornitoreId of fornitoreIds) {
        const chiaveAutomatica = `${fornitoreId}__${numeroDdtRaw}`;
        if (fattureAutomatiche[chiaveAutomatica]) continue; // già trovata col DDT esatto
        const trovata = fattureIndicePerNumero.get(
          `${fornitoreId}__${normalizzaRiferimento(numeroDdtRaw)}`
        );
        if (trovata) fattureAutomatiche[chiaveAutomatica] = trovata;
      }
    }
  }

  // Collegamenti scelti a mano da Mauro in Registro Fatture — hanno sempre
  // la precedenza sull'abbinamento automatico sopra.
  const collegamentiManuali: Record<string, { numero: string; data: string }> = {};
  const { data: collegamenti } = await supabase
    .from("collegamenti_bolla_fattura")
    .select("fornitore_id, numero_ddt, data_ddt, fatture_ricevute(numero, data)");

  for (const c of (collegamenti ?? []) as unknown as CollegamentoManuale[]) {
    if (!c.fatture_ricevute) continue;
    const chiave = `${c.fornitore_id}__${c.numero_ddt}__${c.data_ddt}`;
    collegamentiManuali[chiave] = { numero: c.fatture_ricevute.numero, data: c.fatture_ricevute.data };
  }

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-neutral-900">Storico bolle</h1>
      <p className="mb-4 text-sm text-neutral-500">
        Le bolle registrate con &quot;Registra bolla&quot;, più recenti in cima — utile per il
        controllo di fine mese con la fattura riepilogativa del fornitore. Ogni bolla mostra se è
        già stata abbinata a una fattura elettronica registrata in Registro Fatture (in automatico
        o collegata a mano) oppure se è ancora in attesa. Usa la matita ✏️ su una riga per
        correggere un prezzo o una quantità letti male dalla scansione — non aggiorna mai il
        listino del prodotto. Ultime {righe.length} righe.
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

      {!error && bolle.length > 0 && (
        <StoricoBolleClient
          bolle={bolle}
          fattureAutomatiche={fattureAutomatiche}
          collegamentiManuali={collegamentiManuali}
        />
      )}
    </div>
  );
}
