// Modulo Sicurezza + HACCP, passo 4 (15/11/2026): lettura dell'anagrafica
// dipendenti dalle buste paga mensili su Dropbox.
//
// Diverso da src/lib/buste-paga.ts (che legge il NETTO per la Prima Nota):
// qui servono le date del rapporto di lavoro. Nel PDF le etichette ("Data
// assunzione", "Data cessazione"…) e i valori sono testi separati, e una
// cella vuota (es. nessuna data di cessazione) semplicemente non c'è — quindi
// leggere "in ordine" sarebbe ambiguo. Si usa invece la POSIZIONE: ogni
// valore sta sulla stessa riga della sua etichetta, ~60 punti più a destra.
// Verificato su buste reali di ottobre 2026 (16 dipendenti), settembre 2026
// (cessazione di Aurora), gennaio e febbraio 2025 (cessazioni di Mezzalira e
// Vivian) e su un contratto intermittente con data di fine (Cavalli).

export type TestoPdf = { s: string; x: number; y: number };

export type DatiBusta = {
  pagina: number;
  codice: string | null; // es. "00068"
  nomeCompleto: string | null; // "Cavalli Nicole"
  anno: number | null;
  mese: number | null; // 1-12
  dataAssunzione: string | null; // ISO
  dataCessazione: string | null;
  fineContratto: string | null;
  mansione: string | null;
  avviso: string | null;
};

const MESI = [
  "GENNAIO", "FEBBRAIO", "MARZO", "APRILE", "MAGGIO", "GIUGNO",
  "LUGLIO", "AGOSTO", "SETTEMBRE", "OTTOBRE", "NOVEMBRE", "DICEMBRE",
];
const PERIODO_RE = new RegExp(`\\b(${MESI.join("|")})\\s+(\\d{4})\\b`);
const DATA_RE = /\b(\d{2})\/(\d{2})\/(\d{4})\b/;
const CODICE_NOME_RE = /^(\d{5})\s+([^\d]+)$/;

function isoDa(testo: string): string | null {
  const m = testo.match(DATA_RE);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

// Testi sulla stessa riga dell'etichetta, nella "colonna" a destra di essa.
function valoreDi(testi: TestoPdf[], etichetta: string): string | null {
  const lab = testi.find((t) => t.s.trim() === etichetta);
  if (!lab) return null;
  const trovati = testi
    .filter((t) => t !== lab && Math.abs(t.y - lab.y) <= 4 && t.x >= lab.x + 30 && t.x < lab.x + 110)
    .sort((a, b) => a.x - b.x)
    .map((t) => t.s.trim())
    .filter(Boolean);
  return trovati.length ? trovati.join(" ") : null;
}

// Raggruppa i testi in righe (stessa y), da sinistra a destra.
function righe(testi: TestoPdf[]): string[] {
  const perY = new Map<number, TestoPdf[]>();
  for (const t of testi) {
    const y = Math.round(t.y);
    perY.set(y, [...(perY.get(y) ?? []), t]);
  }
  return [...perY.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, ts]) => ts.sort((a, b) => a.x - b.x).map((t) => t.s).join(" ").replace(/\s+/g, " ").trim());
}

export function leggiPaginaBusta(testi: TestoPdf[], pagina: number): DatiBusta {
  const linee = righe(testi);
  const testoPiatto = linee.join(" ");

  let codice: string | null = null;
  let nomeCompleto: string | null = null;
  for (const l of linee) {
    const m = l.match(CODICE_NOME_RE);
    if (m) {
      codice = m[1];
      nomeCompleto = m[2].trim().replace(/\s+/g, " ");
      break;
    }
  }

  const periodo = testoPiatto.match(PERIODO_RE);
  const mese = periodo ? MESI.indexOf(periodo[1]) + 1 : null;
  const anno = periodo ? Number(periodo[2]) : null;

  const vAssunzione = valoreDi(testi, "Data assunzione");
  const vCessazione = valoreDi(testi, "Data cessazione");
  const vFine = valoreDi(testi, "Data fine contr. t.d.");
  const vMansione = valoreDi(testi, "Qual./mansione");

  const avvisi: string[] = [];
  if (!codice) avvisi.push("non trovo codice e nome del dipendente");
  if (!mese || !anno) avvisi.push("non trovo il mese di competenza");
  const dataAssunzione = vAssunzione ? isoDa(vAssunzione) : null;
  if (!dataAssunzione) avvisi.push("non trovo la data di assunzione");

  return {
    pagina,
    codice,
    nomeCompleto,
    anno,
    mese,
    dataAssunzione,
    dataCessazione: vCessazione ? isoDa(vCessazione) : null,
    fineContratto: vFine ? isoDa(vFine) : null,
    // "3KIN/Aiuto Cameriera" → "Aiuto Cameriera" (il codice livello non serve)
    mansione: vMansione ? vMansione.replace(/^[0-9A-Z]{4}\//, "").trim() : null,
    avviso: avvisi.length ? `Pagina ${pagina}: ${avvisi.join("; ")}.` : null,
  };
}

// ---------------------------------------------------------------------------
// Confronto con le persone già nello scadenzario → cosa scrivere.
// ---------------------------------------------------------------------------

export type PersonaEsistente = {
  id: string;
  tipo: string;
  cognome: string;
  nome: string;
  codice_busta: string | null;
  mansione: string | null;
  data_assunzione: string | null;
  data_cessazione: string | null;
  fine_contratto: string | null;
};

export type Operazione =
  | { tipo: "aggiorna"; id: string; nome: string; campi: Record<string, string | null> }
  | {
      tipo: "nuovo";
      campi: {
        cognome: string;
        nome: string;
        codice_busta: string;
        mansione: string | null;
        data_assunzione: string | null;
        data_cessazione: string | null;
        fine_contratto: string | null;
        note: string;
      };
    };

function normalizza(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Regole (decise con Mauro):
// - abbinamento per codice dipendente; se il codice è nuovo, per nome e
//   cognome (es. chi è stato inserito a mano come "nuovo assunto", o chi
//   viene riassunto e riceve un codice nuovo, come Pagliarusco nel 2025);
// - la cessazione si segna SOLO se scritta in busta paga: non comparire in
//   un mese non vuol dire essere cessati (aspettativa, intermittenti);
// - se una persona cessata risulta riassunta (assunzione dopo la
//   cessazione), la cessazione viene tolta.
export function pianificaAggiornamenti(persone: PersonaEsistente[], buste: DatiBusta[]): Operazione[] {
  const operazioni: Operazione[] = [];
  const stato = new Map(persone.map((p) => [p.id, { ...p }]));
  const nuoviPerCodice = new Map<string, Operazione & { tipo: "nuovo" }>();

  for (const b of buste) {
    if (!b.codice || !b.nomeCompleto) continue;

    let p = [...stato.values()].find((x) => x.codice_busta === b.codice);
    if (!p) {
      const n = normalizza(b.nomeCompleto);
      p = [...stato.values()].find(
        (x) => normalizza(`${x.cognome} ${x.nome}`) === n || normalizza(`${x.nome} ${x.cognome}`) === n
      );
    }

    if (!p) {
      const giaNuovo = nuoviPerCodice.get(b.codice);
      if (giaNuovo) {
        // Stessa persona in un mese successivo: tieni i dati più recenti.
        giaNuovo.campi.mansione = b.mansione ?? giaNuovo.campi.mansione;
        giaNuovo.campi.data_assunzione = b.dataAssunzione ?? giaNuovo.campi.data_assunzione;
        giaNuovo.campi.data_cessazione = b.dataCessazione;
        giaNuovo.campi.fine_contratto = b.fineContratto;
        continue;
      }
      const [cognome, ...resto] = b.nomeCompleto.split(" ");
      const op: Operazione & { tipo: "nuovo" } = {
        tipo: "nuovo",
        campi: {
          cognome,
          nome: resto.join(" "),
          codice_busta: b.codice,
          mansione: b.mansione,
          data_assunzione: b.dataAssunzione,
          data_cessazione: b.dataCessazione,
          fine_contratto: b.fineContratto,
          note: "Creato dalla busta paga: verificare la divisione fra cognome e nome.",
        },
      };
      nuoviPerCodice.set(b.codice, op);
      operazioni.push(op);
      continue;
    }

    const campi: Record<string, string | null> = {};
    if (p.codice_busta !== b.codice) campi.codice_busta = b.codice;
    if (b.mansione && p.mansione !== b.mansione) campi.mansione = b.mansione;
    if (b.dataAssunzione && p.data_assunzione !== b.dataAssunzione) campi.data_assunzione = b.dataAssunzione;
    if (p.fine_contratto !== b.fineContratto) campi.fine_contratto = b.fineContratto;
    if (b.dataCessazione) {
      if (p.data_cessazione !== b.dataCessazione) campi.data_cessazione = b.dataCessazione;
    } else if (p.data_cessazione && b.dataAssunzione && b.dataAssunzione > p.data_cessazione) {
      campi.data_cessazione = null; // riassunto
    }

    if (Object.keys(campi).length > 0) {
      Object.assign(p, campi);
      const esistente = operazioni.find((o) => o.tipo === "aggiorna" && o.id === p!.id);
      if (esistente && esistente.tipo === "aggiorna") Object.assign(esistente.campi, campi);
      else operazioni.push({ tipo: "aggiorna", id: p.id, nome: `${p.cognome} ${p.nome}`, campi });
    }
  }
  return operazioni;
}

// Nomi dei PDF mensili del consulente: "10_Paghe_Ottobre_2026.PDF", e i
// file extra dello stesso mese come "02_Paghe_Febbraio_Luka_2026.PDF".
// Esclusi amministratori e stage (non sono dipendenti da formare qui).
const FILE_BUSTA_RE = /^(\d{2})_Paghe_[A-Za-zÀ-ü]+(?:_[A-Za-zÀ-ü]+)?_(\d{4})\.pdf$/i;

export function meseDaNomeFile(nome: string): { anno: number; mese: number } | null {
  if (/amministrator|stage/i.test(nome)) return null;
  const m = nome.match(FILE_BUSTA_RE);
  if (!m) return null;
  const mese = Number(m[1]);
  if (mese < 1 || mese > 12) return null;
  return { anno: Number(m[2]), mese };
}

// Le buste di ottobre 2026 sono già state importate a mano il 15/11:
// si parte da lì per non ricreare dipendenti cessati da anni.
export const LEGGI_DAL = { anno: 2026, mese: 10 };
