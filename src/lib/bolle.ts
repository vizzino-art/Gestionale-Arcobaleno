// Logica condivisa per "bolle" (righe di storico_prezzi_fatture inserite da
// "Registra bolla", riconoscibili da numero_fattura nel formato "DDT
// <numero>") — usata sia da Storico bolle (visualizzazione + correzione)
// sia da Registro Fatture (collegamento manuale a una fattura), per non
// duplicare la stessa logica di raggruppamento/confronto in due posti.

export type RigaBollaGrezza = {
  id: string;
  data: string;
  numero_fattura: string | null; // sempre "DDT <numero>" per le righe filtrate a monte
  prezzo: number;
  quantita: number | null;
  fornitore_id: string;
  prodotti: { descrizione: string; um: string | null } | null;
  fornitori?: { nome: string } | null;
};

export type RigaBolla = {
  id: string;
  descrizione: string;
  um: string | null;
  quantita: number | null;
  prezzo: number;
};

export type Bolla = {
  chiave: string; // fornitoreId__numeroDdtRaw__data, stabile per raggruppare
  fornitoreId: string;
  fornitoreNome: string;
  numeroDdtRaw: string; // senza il prefisso "DDT "
  data: string;
  righe: RigaBolla[];
};

export function raggruppaBolle(righe: RigaBollaGrezza[]): Bolla[] {
  const bolle: Bolla[] = [];
  const indice = new Map<string, Bolla>();
  for (const r of righe) {
    const numeroDdtRaw = (r.numero_fattura ?? "").replace(/^DDT\s+/i, "").trim() || "—";
    const chiave = `${r.fornitore_id}__${numeroDdtRaw}__${r.data}`;
    let b = indice.get(chiave);
    if (!b) {
      b = {
        chiave,
        fornitoreId: r.fornitore_id,
        fornitoreNome: r.fornitori?.nome ?? "—",
        numeroDdtRaw,
        data: r.data,
        righe: [],
      };
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
  return bolle;
}

// Riduce un riferimento (numero DDT o numero fattura) a un formato
// confrontabile — serve a riconoscere che "H4/32016" (DDT letto dalla
// bolla) e "H4 000032016" (numero della fattura elettronica corrispondente)
// sono lo stesso documento. Capita spesso con fornitori tipo supermercato
// (Unicomm, Tosano...) la cui fattura elettronica non riporta affatto un
// DDT collegato in modo strutturato: il "DDT" che Mauro legge sulla carta è
// di fatto lo stesso numero del documento, solo scritto in modo diverso.
// Importante: spezza la stringa nei singoli pezzi separati da spazi/barre/
// trattini PRIMA di togliere gli zeri iniziali di ciascun pezzo numerico —
// se si ripulisse tutto insieme, "H4" e "32016" si incollerebbero in un
// unico blocco "432016" e gli zeri di "000032016" non sarebbero più
// riconoscibili come "iniziali".
export function normalizzaRiferimento(s: string): string {
  return s
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter((pezzo) => pezzo.length > 0)
    .map((pezzo) => (/^\d+$/.test(pezzo) ? pezzo.replace(/^0+(?=\d)/, "") : pezzo))
    .join("-");
}
