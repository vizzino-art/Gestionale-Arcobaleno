"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Fornitore } from "@/lib/types";

type Props = {
  fornitori: Fornitore[];
  fattureIniziali: FatturaSalvata[];
};

type RigaEstratta = {
  numeroLinea: number;
  codiceArticolo: string | null;
  descrizione: string;
  quantita: number | null;
  um: string | null;
  prezzoUnitario: number | null;
  prezzoTotale: number | null;
  aliquotaIva: number | null;
  ddtNumero: string | null;
  ddtData: string | null;
};

type RataEstratta = {
  numeroRata: number;
  importo: number;
  dataScadenza: string | null;
  modalitaPagamento: string | null;
};

type FatturaEstratta = {
  fornitorePiva: string;
  fornitoreNome: string;
  numero: string;
  data: string;
  tipoDocumento: string;
  importoTotale: number;
  righe: RigaEstratta[];
  rate: RataEstratta[];
  xml: string;
};

export type FatturaSalvata = {
  id: string;
  fornitore_id: string | null;
  fornitore_nome: string;
  fornitore_piva: string;
  numero: string;
  data: string;
  tipo_documento: string;
  importo_totale: number;
  righe_fatture_ricevute: RigaSalvata[];
  rate_pagamento_fatture: RataSalvata[];
};

type RigaSalvata = {
  numero_linea: number;
  codice_articolo: string | null;
  descrizione: string;
  quantita: number | null;
  um: string | null;
  prezzo_unitario: number | null;
  ddt_numero: string | null;
  ddt_data: string | null;
};

type RataSalvata = {
  id: string;
  numero_rata: number;
  importo: number;
  data_scadenza: string | null;
  modalita_pagamento: string | null;
  // Passo B: quando/come Mauro ha pagato davvero questa rata — distinto
  // dalla scadenza e dalla modalità scritte in fattura, perché spesso paga
  // prima della scadenza e con un metodo diverso da quello dichiarato.
  data_pagamento_effettivo: string | null;
  metodo_pagamento_effettivo: string | null;
};

// Metodi proposti nella tendina; "Altro" apre un campo libero, così Mauro
// può sempre registrare un metodo nuovo senza dover aspettare che venga
// aggiunto qui.
const METODI_PAGAMENTO_PRESET = ["Carta di credito", "SumUp", "Bonifico", "Contanti"];

const ETICHETTE_MODALITA_PAGAMENTO: Record<string, string> = {
  MP01: "Contanti",
  MP02: "Assegno",
  MP03: "Assegno circolare",
  MP05: "Bonifico",
  MP08: "Carta di pagamento",
  MP09: "RID",
  MP12: "RIBA",
  MP19: "SEPA Direct Debit",
  MP22: "Contanti presso Tesoreria",
};

const ETICHETTE_TIPO_DOCUMENTO: Record<string, string> = {
  TD01: "Fattura",
  TD02: "Acconto/anticipo su fattura",
  TD04: "Nota di credito",
  TD05: "Nota di debito",
  TD24: "Fattura differita",
  TD26: "Cessione di beni ammortizzabili",
};

function normalizzaPiva(v: string): string {
  return v.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

function formattaEuro(v: number | null): string {
  if (v === null) return "-";
  return v.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

function formattaData(v: string | null): string {
  if (!v) return "-";
  const [anno, mese, giorno] = v.split("-");
  if (!anno || !mese || !giorno) return v;
  return `${giorno}/${mese}/${anno}`;
}

// Più recenti prima; a parità di data, ordine alfabetico per fornitore.
function comparaFatture(a: FatturaSalvata, b: FatturaSalvata): number {
  if (a.data !== b.data) return a.data < b.data ? 1 : -1;
  return a.fornitore_nome.localeCompare(b.fornitore_nome, "it");
}

function nomiFileValidi(files: FileList | File[]): File[] {
  return Array.from(files).filter((f) => /\.(xml|p7m)$/i.test(f.name));
}

async function leggiComeBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const risultato = reader.result as string;
      resolve(risultato.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(new Error("Lettura del file fallita."));
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------------------
// Passo C — confronto prezzi fattura vs bolle già registrate per lo stesso
// fornitore/prodotto (tabella storico_prezzi_fatture, alimentata da
// "Registra bolla"). Stesso identico criterio di abbinamento riga→prodotto
// già usato in Registra bolla (codice articolo confermato dalla descrizione,
// poi descrizione esatta, poi sovrapposizione di parole), per coerenza.
// ---------------------------------------------------------------------------

function normalizzaTesto(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9À-Ù]+/g, " ").trim();
}

function punteggioDescrizione(descRigaNormalizzata: string, descrizioneProdotto: string): number {
  const descP = normalizzaTesto(descrizioneProdotto);
  if (descP === descRigaNormalizzata) return 1;
  const parole = descRigaNormalizzata.split(" ").filter((w) => w.length > 2);
  if (parole.length === 0) return 0;
  const paroleP = new Set(descP.split(" "));
  const comuni = parole.filter((w) => paroleP.has(w)).length;
  return comuni / parole.length;
}

type ProdottoPerConfronto = { id: string; codice_articolo: string | null; descrizione: string };

function trovaProdottoCorrispondente(
  riga: { codice_articolo: string | null; descrizione: string },
  prodotti: ProdottoPerConfronto[]
): string | null {
  const desc = normalizzaTesto(riga.descrizione);

  if (riga.codice_articolo) {
    const codice = normalizzaTesto(riga.codice_articolo);
    const candidatiPerCodice = prodotti.filter(
      (p) => p.codice_articolo && normalizzaTesto(p.codice_articolo) === codice
    );
    const confermatoDaDescrizione = candidatiPerCodice.find(
      (p) => punteggioDescrizione(desc, p.descrizione) >= 0.4
    );
    if (confermatoDaDescrizione) return confermatoDaDescrizione.id;
  }

  const perDescrizioneEsatta = prodotti.find((p) => normalizzaTesto(p.descrizione) === desc);
  if (perDescrizioneEsatta) return perDescrizioneEsatta.id;

  let migliore: { id: string; punteggio: number } | null = null;
  for (const p of prodotti) {
    const punteggio = punteggioDescrizione(desc, p.descrizione);
    if (punteggio >= 0.6 && (!migliore || punteggio > migliore.punteggio)) {
      migliore = { id: p.id, punteggio };
    }
  }
  return migliore?.id ?? null;
}

type RigaStoricoPerConfronto = {
  prodotto_id: string;
  data: string;
  numero_fattura: string | null;
  prezzo: number;
};

type EsitoConfrontoRiga = {
  riga: RigaSalvata;
  stato: "ok" | "senza-prodotto" | "senza-storico";
  prezzoRiferimento: number | null;
  dataRiferimento: string | null;
  fonteRiferimento: "ddt" | "ultimo-prezzo" | null;
  differenza: number | null;
};

// Per ogni riga: trova il prodotto a sistema, poi il prezzo bolla di
// riferimento — quello della bolla con lo stesso DDT se la riga ne ha uno
// (confronto esatto, stesso periodo di consegna), altrimenti l'ultimo prezzo
// registrato in assoluto per quel prodotto (scelta di Mauro: più semplice,
// trova sempre un confronto se esiste storico).
function confrontaRighe(
  righe: RigaSalvata[],
  prodotti: ProdottoPerConfronto[],
  storico: RigaStoricoPerConfronto[]
): EsitoConfrontoRiga[] {
  const storicoPerProdotto = new Map<string, RigaStoricoPerConfronto[]>();
  for (const s of storico) {
    const lista = storicoPerProdotto.get(s.prodotto_id) ?? [];
    lista.push(s);
    storicoPerProdotto.set(s.prodotto_id, lista);
  }

  return righe.map((riga) => {
    const prodottoId = trovaProdottoCorrispondente(riga, prodotti);
    if (!prodottoId) {
      return {
        riga,
        stato: "senza-prodotto",
        prezzoRiferimento: null,
        dataRiferimento: null,
        fonteRiferimento: null,
        differenza: null,
      };
    }
    const storicoProdotto = storicoPerProdotto.get(prodottoId) ?? [];
    if (storicoProdotto.length === 0) {
      return {
        riga,
        stato: "senza-storico",
        prezzoRiferimento: null,
        dataRiferimento: null,
        fonteRiferimento: null,
        differenza: null,
      };
    }

    let riferimento: RigaStoricoPerConfronto | undefined;
    let fonte: "ddt" | "ultimo-prezzo" = "ultimo-prezzo";
    if (riga.ddt_numero) {
      riferimento = storicoProdotto.find((s) => s.numero_fattura === `DDT ${riga.ddt_numero}`);
      if (riferimento) fonte = "ddt";
    }
    if (!riferimento) {
      riferimento = [...storicoProdotto].sort((a, b) => (a.data < b.data ? 1 : -1))[0];
    }

    const differenza =
      riga.prezzo_unitario !== null ? riga.prezzo_unitario - riferimento.prezzo : null;

    return {
      riga,
      stato: "ok",
      prezzoRiferimento: riferimento.prezzo,
      dataRiferimento: riferimento.data,
      fonteRiferimento: fonte,
      differenza,
    };
  });
}

// Mini-form per registrare data e metodo di pagamento effettivo di una
// singola rata — riusato sia dentro ogni fattura sia nella vista d'insieme
// "Scadenze da pagare". Sta sempre fuori dalla zona stampabile
// (#vista-stampa-fattura), quindi non compare mai nel PDF.
function FormPagamentoRata({
  rata,
  onSalvata,
}: {
  rata: RataSalvata;
  onSalvata: (rata: RataSalvata) => void;
}) {
  const presetIniziale =
    rata.metodo_pagamento_effettivo && METODI_PAGAMENTO_PRESET.includes(rata.metodo_pagamento_effettivo)
      ? rata.metodo_pagamento_effettivo
      : rata.metodo_pagamento_effettivo
        ? "Altro"
        : "";
  const [data, setData] = useState(rata.data_pagamento_effettivo ?? "");
  const [metodo, setMetodo] = useState(presetIniziale);
  const [metodoAltro, setMetodoAltro] = useState(
    presetIniziale === "Altro" ? (rata.metodo_pagamento_effettivo ?? "") : ""
  );
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function salva() {
    setSalvando(true);
    setErrore(null);
    const supabase = createClient();
    const metodoFinale = metodo === "Altro" ? metodoAltro.trim() || null : metodo || null;
    const { data: aggiornata, error } = await supabase
      .from("rate_pagamento_fatture")
      .update({
        data_pagamento_effettivo: data || null,
        metodo_pagamento_effettivo: metodoFinale,
      })
      .eq("id", rata.id)
      .select("*")
      .single();
    setSalvando(false);
    if (error || !aggiornata) {
      setErrore(error?.message ?? "Errore nel salvataggio.");
      return;
    }
    onSalvata(aggiornata as RataSalvata);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {rata.data_pagamento_effettivo && (
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">✅ Pagata</span>
      )}
      <input
        type="date"
        value={data}
        onChange={(e) => setData(e.target.value)}
        className="rounded-md border border-neutral-300 px-1.5 py-1 text-xs"
      />
      <select
        value={metodo}
        onChange={(e) => setMetodo(e.target.value)}
        className="rounded-md border border-neutral-300 px-1.5 py-1 text-xs"
      >
        <option value="">— metodo —</option>
        {METODI_PAGAMENTO_PRESET.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
        <option value="Altro">Altro…</option>
      </select>
      {metodo === "Altro" && (
        <input
          type="text"
          value={metodoAltro}
          onChange={(e) => setMetodoAltro(e.target.value)}
          placeholder="Specifica metodo"
          className="rounded-md border border-neutral-300 px-1.5 py-1 text-xs"
        />
      )}
      <button
        onClick={salva}
        disabled={salvando}
        className="rounded-md bg-neutral-900 px-2 py-1 text-xs text-white disabled:opacity-50"
      >
        {salvando ? "…" : "Salva"}
      </button>
      {errore && <span className="text-xs text-red-600">{errore}</span>}
    </div>
  );
}

export function RegistroFattureClient({ fornitori, fattureIniziali }: Props) {
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [estratta, setEstratta] = useState<FatturaEstratta | null>(null);
  const [nomeFileCorrente, setNomeFileCorrente] = useState<string>("");
  const [fornitoreScelto, setFornitoreScelto] = useState<string>("");
  const [salvataggio, setSalvataggio] = useState(false);
  const [messaggioSalvataggio, setMessaggioSalvataggio] = useState<string | null>(null);
  const [fatture, setFatture] = useState<FatturaSalvata[]>(() =>
    [...fattureIniziali].sort(comparaFatture)
  );
  const [espansa, setEspansa] = useState<string | null>(null);
  const [listaFornitori, setListaFornitori] = useState<Fornitore[]>(fornitori);
  const [codaFile, setCodaFile] = useState<File[]>([]);
  const [trascinamentoAttivo, setTrascinamentoAttivo] = useState(false);

  const fornitoriPerPiva = useMemo(() => {
    const mappa = new Map<string, Fornitore>();
    for (const f of listaFornitori) {
      if (f.piva) mappa.set(normalizzaPiva(f.piva), f);
    }
    return mappa;
  }, [listaFornitori]);

  // Passo B — vista d'insieme: tutte le rate non ancora pagate di tutte le
  // fatture, più recenti scadenze prima (quelle senza scadenza in fondo).
  // Calcolata dalle fatture già in stato, nessuna query separata.
  const rateNonPagate = useMemo(() => {
    const elenco: (RataSalvata & { fatturaId: string; fornitoreNome: string; numeroFattura: string })[] =
      [];
    for (const f of fatture) {
      for (const r of f.rate_pagamento_fatture) {
        if (!r.data_pagamento_effettivo) {
          elenco.push({ ...r, fatturaId: f.id, fornitoreNome: f.fornitore_nome, numeroFattura: f.numero });
        }
      }
    }
    elenco.sort((a, b) => {
      if (a.data_scadenza === b.data_scadenza) return 0;
      if (!a.data_scadenza) return 1;
      if (!b.data_scadenza) return -1;
      return a.data_scadenza < b.data_scadenza ? -1 : 1;
    });
    return elenco;
  }, [fatture]);

  const oggiIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  function rataAggiornata(rata: RataSalvata) {
    setFatture((prec) =>
      prec.map((f) => ({
        ...f,
        rate_pagamento_fatture: f.rate_pagamento_fatture.map((r) => (r.id === rata.id ? rata : r)),
      }))
    );
  }

  // Passo C — confronto con le bolle, calcolato al volo quando Mauro lo
  // richiede (bottone dentro la fattura), non automaticamente: interroga
  // prodotti/storico_prezzi_fatture solo del fornitore di quella fattura.
  const [confrontoInCorso, setConfrontoInCorso] = useState<Record<string, boolean>>({});
  const [confrontoErrore, setConfrontoErrore] = useState<Record<string, string>>({});
  const [confrontoRisultati, setConfrontoRisultati] = useState<Record<string, EsitoConfrontoRiga[]>>({});

  async function confrontaConBolle(f: FatturaSalvata) {
    setConfrontoErrore((prec) => ({ ...prec, [f.id]: "" }));
    if (!f.fornitore_id) {
      setConfrontoErrore((prec) => ({
        ...prec,
        [f.id]: "Questa fattura non è abbinata a un fornitore a sistema: abbinala per poter confrontare i prezzi con le bolle.",
      }));
      return;
    }
    setConfrontoInCorso((prec) => ({ ...prec, [f.id]: true }));
    try {
      const supabase = createClient();
      const [{ data: prodotti, error: erroreProdotti }, { data: storico, error: erroreStorico }] =
        await Promise.all([
          supabase.from("prodotti").select("id, codice_articolo, descrizione").eq("fornitore_id", f.fornitore_id),
          supabase
            .from("storico_prezzi_fatture")
            .select("prodotto_id, data, numero_fattura, prezzo")
            .eq("fornitore_id", f.fornitore_id),
        ]);
      if (erroreProdotti || erroreStorico) {
        setConfrontoErrore((prec) => ({
          ...prec,
          [f.id]: `Errore nel confronto: ${(erroreProdotti ?? erroreStorico)?.message}`,
        }));
        return;
      }
      const risultati = confrontaRighe(
        f.righe_fatture_ricevute,
        (prodotti ?? []) as ProdottoPerConfronto[],
        (storico ?? []) as RigaStoricoPerConfronto[]
      );
      setConfrontoRisultati((prec) => ({ ...prec, [f.id]: risultati }));
    } finally {
      setConfrontoInCorso((prec) => ({ ...prec, [f.id]: false }));
    }
  }

  async function gestisciCaricamento(file: File) {
    setErrore(null);
    setMessaggioSalvataggio(null);
    setEstratta(null);
    setCaricamento(true);
    setNomeFileCorrente(file.name);
    try {
      const contenuto = await leggiComeBase64(file);
      const risposta = await fetch("/api/leggi-fattura-elettronica", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contenuto, nomeFile: file.name }),
      });
      const dati = await risposta.json();
      if (!risposta.ok) {
        setErrore(dati?.errore ?? "Errore nella lettura del file.");
        return;
      }
      setEstratta(dati as FatturaEstratta);
      const match = fornitoriPerPiva.get(normalizzaPiva((dati as FatturaEstratta).fornitorePiva));
      setFornitoreScelto(match?.id ?? "");
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Errore nella lettura del file.");
    } finally {
      setCaricamento(false);
    }
  }

  function avviaFile(files: File[]) {
    if (files.length === 0) return;
    const [primo, ...resto] = files;
    setCodaFile(resto);
    gestisciCaricamento(primo);
  }

  function saltaFileCorrente() {
    setEstratta(null);
    setErrore(null);
    setNomeFileCorrente("");
    if (codaFile.length > 0) avviaFile(codaFile);
  }

  async function salva() {
    if (!estratta) return;
    setSalvataggio(true);
    setMessaggioSalvataggio(null);
    setErrore(null);
    try {
      const supabase = createClient();
      const formatoOriginale = nomeFileCorrente.toLowerCase().endsWith(".p7m") ? "p7m" : "xml";

      const { data: fatturaInserita, error: erroreFattura } = await supabase
        .from("fatture_ricevute")
        .insert({
          fornitore_id: fornitoreScelto || null,
          fornitore_piva: estratta.fornitorePiva,
          fornitore_nome: estratta.fornitoreNome,
          numero: estratta.numero,
          data: estratta.data,
          tipo_documento: estratta.tipoDocumento,
          importo_totale: estratta.importoTotale,
          formato_originale: formatoOriginale,
          xml: estratta.xml,
        })
        .select("id")
        .single();

      if (erroreFattura) {
        if (erroreFattura.code === "23505") {
          setErrore("Questa fattura risulta già registrata (stesso fornitore, numero e data).");
        } else {
          setErrore(`Errore nel salvataggio: ${erroreFattura.message}`);
        }
        return;
      }

      const fatturaId = fatturaInserita.id as string;

      // Se ho scelto un fornitore e la sua P.IVA a sistema è diversa (o
      // mancante), la aggiorno: così le prossime fatture dello stesso
      // fornitore si abbineranno da sole, senza doverlo scegliere ogni volta.
      if (fornitoreScelto) {
        const fornitoreSelezionato = listaFornitori.find((f) => f.id === fornitoreScelto);
        const pivaEstratta = normalizzaPiva(estratta.fornitorePiva);
        const pivaAttuale = fornitoreSelezionato?.piva ? normalizzaPiva(fornitoreSelezionato.piva) : "";
        if (pivaEstratta && pivaEstratta !== pivaAttuale) {
          const { error: errorePiva } = await supabase
            .from("fornitori")
            .update({ piva: estratta.fornitorePiva })
            .eq("id", fornitoreScelto);
          if (!errorePiva) {
            setListaFornitori((prec) =>
              prec.map((f) => (f.id === fornitoreScelto ? { ...f, piva: estratta.fornitorePiva } : f))
            );
          }
        }
      }

      if (estratta.righe.length > 0) {
        const { error: erroreRighe } = await supabase.from("righe_fatture_ricevute").insert(
          estratta.righe.map((r) => ({
            fattura_id: fatturaId,
            numero_linea: r.numeroLinea,
            codice_articolo: r.codiceArticolo,
            descrizione: r.descrizione,
            quantita: r.quantita,
            um: r.um,
            prezzo_unitario: r.prezzoUnitario,
            prezzo_totale: r.prezzoTotale,
            aliquota_iva: r.aliquotaIva,
            ddt_numero: r.ddtNumero,
            ddt_data: r.ddtData,
          }))
        );
        if (erroreRighe) {
          setErrore(`Fattura salvata, ma errore nelle righe: ${erroreRighe.message}`);
          return;
        }
      }

      // Catturiamo le righe inserite (con l'id assegnato da Supabase): serve
      // per poter registrare subito il pagamento di una rata appena salvata,
      // senza dover prima ricaricare la pagina.
      let rateSalvate: RataSalvata[] = [];
      if (estratta.rate.length > 0) {
        const { data: rateInserite, error: erroreRate } = await supabase
          .from("rate_pagamento_fatture")
          .insert(
            estratta.rate.map((r) => ({
              fattura_id: fatturaId,
              numero_rata: r.numeroRata,
              importo: r.importo,
              data_scadenza: r.dataScadenza,
              modalita_pagamento: r.modalitaPagamento,
            }))
          )
          .select("*");
        if (erroreRate) {
          setErrore(`Fattura salvata, ma errore nelle rate: ${erroreRate.message}`);
          return;
        }
        rateSalvate = (rateInserite ?? []) as RataSalvata[];
      }

      setFatture((prec) =>
        [
          {
            id: fatturaId,
            fornitore_id: fornitoreScelto || null,
            fornitore_nome: estratta.fornitoreNome,
            fornitore_piva: estratta.fornitorePiva,
            numero: estratta.numero,
            data: estratta.data,
            tipo_documento: estratta.tipoDocumento,
            importo_totale: estratta.importoTotale,
            righe_fatture_ricevute: estratta.righe.map((r) => ({
              numero_linea: r.numeroLinea,
              codice_articolo: r.codiceArticolo,
              descrizione: r.descrizione,
              quantita: r.quantita,
              um: r.um,
              prezzo_unitario: r.prezzoUnitario,
              ddt_numero: r.ddtNumero,
              ddt_data: r.ddtData,
            })),
            rate_pagamento_fatture: rateSalvate,
          },
          ...prec,
        ].sort(comparaFatture)
      );
      setMessaggioSalvataggio("Fattura registrata.");
      setEstratta(null);
      setNomeFileCorrente("");
      if (codaFile.length > 0) {
        avviaFile(codaFile);
      }
    } finally {
      setSalvataggio(false);
    }
  }

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #vista-stampa-fattura, #vista-stampa-fattura * { visibility: visible; }
          #vista-stampa-fattura { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
        }
      `}</style>

      <div className="mb-6 rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-base font-semibold text-neutral-900">📅 Scadenze da pagare</h2>
        {rateNonPagate.length === 0 && (
          <p className="text-sm text-neutral-500">Nessuna rata in sospeso: tutto pagato.</p>
        )}
        <div className="space-y-2">
          {rateNonPagate.map((r) => {
            const scaduta = r.data_scadenza ? r.data_scadenza < oggiIso : false;
            return (
              <div key={r.id} className="rounded-md border border-neutral-100 p-2">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-neutral-900">
                    <span className="font-medium">{r.fornitoreNome}</span> — fattura {r.numeroFattura}
                  </span>
                  <span className={scaduta ? "font-medium text-red-600" : "font-medium text-neutral-900"}>
                    {formattaEuro(r.importo)} — scadenza {formattaData(r.data_scadenza)}
                    {scaduta && " (scaduta)"}
                  </span>
                </div>
                <FormPagamentoRata rata={r} onSalvata={rataAggiornata} />
              </div>
            );
          })}
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setTrascinamentoAttivo(true);
        }}
        onDragLeave={() => setTrascinamentoAttivo(false)}
        onDrop={(e) => {
          e.preventDefault();
          setTrascinamentoAttivo(false);
          const file = nomiFileValidi(e.dataTransfer.files);
          if (file.length > 0) avviaFile(file);
        }}
        className={
          trascinamentoAttivo
            ? "mb-6 rounded-lg border-2 border-dashed border-neutral-900 bg-neutral-50 p-4"
            : "mb-6 rounded-lg border border-neutral-200 bg-white p-4"
        }
      >
        <label className="mb-2 block text-sm font-medium text-neutral-700">
          Trascina qui uno o più file .xml / .xml.p7m dal Finder (così come scaricati dalla PEC), oppure
          scegli il file
        </label>
        <input
          type="file"
          accept=".xml,.p7m"
          multiple
          disabled={caricamento}
          onChange={(e) => {
            const file = nomiFileValidi(e.target.files ?? []);
            if (file.length > 0) avviaFile(file);
            e.target.value = "";
          }}
          className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
        />
        {codaFile.length > 0 && (
          <p className="mt-2 text-sm text-neutral-500">
            {codaFile.length} altr{codaFile.length === 1 ? "o file" : "i file"} in coda dopo questo.
          </p>
        )}
        {caricamento && <p className="mt-2 text-sm text-neutral-500">Lettura del file in corso…</p>}
        {errore && (
          <div className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <p>{errore}</p>
            {codaFile.length > 0 && (
              <button onClick={saltaFileCorrente} className="mt-1 font-medium underline">
                Salta questo file e passa al successivo in coda
              </button>
            )}
          </div>
        )}
        {messaggioSalvataggio && (
          <p className="mt-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">{messaggioSalvataggio}</p>
        )}
      </div>

      {estratta && (
        <div className="mb-6 rounded-lg border border-neutral-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-neutral-900">
              {ETICHETTE_TIPO_DOCUMENTO[estratta.tipoDocumento] ?? estratta.tipoDocumento} {estratta.numero} del{" "}
              {formattaData(estratta.data)}
            </h2>
            <span className="text-lg font-semibold text-neutral-900">
              {formattaEuro(estratta.importoTotale)}
            </span>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-neutral-500">Fornitore (da fattura)</p>
              <p className="text-sm text-neutral-900">
                {estratta.fornitoreNome} — P.IVA {estratta.fornitorePiva}
              </p>
            </div>
            <div>
              <label className="text-xs text-neutral-500">Abbina a fornitore a sistema</label>
              <select
                value={fornitoreScelto}
                onChange={(e) => setFornitoreScelto(e.target.value)}
                className="mt-0.5 block w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
              >
                <option value="">— nessuno (solo archiviata) —</option>
                {listaFornitori.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                  <th className="py-1 pr-2">Codice</th>
                  <th className="py-1 pr-2">Descrizione</th>
                  <th className="py-1 pr-2">Qtà</th>
                  <th className="py-1 pr-2">UM</th>
                  <th className="py-1 pr-2">Prezzo unit.</th>
                  <th className="py-1 pr-2">DDT</th>
                </tr>
              </thead>
              <tbody>
                {estratta.righe.map((r, i) => (
                  <tr key={i} className="border-b border-neutral-100">
                    <td className="py-1 pr-2 text-neutral-600">{r.codiceArticolo ?? "-"}</td>
                    <td className="py-1 pr-2 text-neutral-900">{r.descrizione}</td>
                    <td className="py-1 pr-2 text-neutral-600">{r.quantita ?? "-"}</td>
                    <td className="py-1 pr-2 text-neutral-600">{r.um ?? "-"}</td>
                    <td className="py-1 pr-2 text-neutral-600">{formattaEuro(r.prezzoUnitario)}</td>
                    <td className="py-1 pr-2 text-neutral-500">
                      {r.ddtNumero ? `${r.ddtNumero} (${formattaData(r.ddtData)})` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {estratta.rate.length > 0 && (
            <div className="mb-4">
              <p className="mb-1 text-xs text-neutral-500">Scadenze di pagamento (dalla fattura)</p>
              <ul className="space-y-1 text-sm text-neutral-700">
                {estratta.rate.map((r) => (
                  <li key={r.numeroRata}>
                    {formattaEuro(r.importo)} — scadenza {formattaData(r.dataScadenza)}
                    {r.modalitaPagamento &&
                      ` — ${ETICHETTE_MODALITA_PAGAMENTO[r.modalitaPagamento] ?? r.modalitaPagamento}`}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={salva}
              disabled={salvataggio}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {salvataggio ? "Salvataggio…" : "Salva nel Registro Fatture"}
            </button>
            <button
              onClick={saltaFileCorrente}
              disabled={salvataggio}
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
              title="Non salva questa fattura e passa al file successivo (se ce n'è uno in coda)"
            >
              Scarta (non salvare)
            </button>
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            Se non ti interessa registrarla (es. non è una fattura fornitore alimentare) o non trovi il
            fornitore giusto, puoi scartarla: non viene salvata da nessuna parte. Per archiviarla comunque
            senza collegarla a un fornitore, lascia &quot;— nessuno (solo archiviata) —&quot; nella tendina e premi
            Salva.
          </p>
        </div>
      )}

      <h2 className="mb-2 text-base font-semibold text-neutral-900">Fatture registrate</h2>
      {fatture.length === 0 && <p className="text-sm text-neutral-500">Nessuna fattura ancora registrata.</p>}
      <div className="space-y-2">
        {fatture.map((f) => (
          <div key={f.id} className="rounded-lg border border-neutral-200 bg-white">
            <button
              onClick={() => setEspansa(espansa === f.id ? null : f.id)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <span className="text-sm text-neutral-900">
                <span className="font-medium">{f.fornitore_nome}</span> — {ETICHETTE_TIPO_DOCUMENTO[f.tipo_documento] ?? f.tipo_documento}{" "}
                {f.numero} del {formattaData(f.data)}
              </span>
              <span className="text-sm font-medium text-neutral-900">{formattaEuro(f.importo_totale)}</span>
            </button>
            {espansa === f.id && (
              <div className="border-t border-neutral-100 px-4 py-3">
                <div id="vista-stampa-fattura">
                  <h3 className="mb-2 text-sm font-semibold text-neutral-900">
                    {f.fornitore_nome} — P.IVA {f.fornitore_piva}
                  </h3>
                  <p className="mb-3 text-sm text-neutral-600">
                    {ETICHETTE_TIPO_DOCUMENTO[f.tipo_documento] ?? f.tipo_documento} {f.numero} del{" "}
                    {formattaData(f.data)} — Totale {formattaEuro(f.importo_totale)}
                  </p>
                  <table className="mb-3 w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                        <th className="py-1 pr-2">Codice</th>
                        <th className="py-1 pr-2">Descrizione</th>
                        <th className="py-1 pr-2">Qtà</th>
                        <th className="py-1 pr-2">UM</th>
                        <th className="py-1 pr-2">Prezzo unit.</th>
                        <th className="py-1 pr-2">DDT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {f.righe_fatture_ricevute.map((r, i) => (
                        <tr key={i} className="border-b border-neutral-100">
                          <td className="py-1 pr-2 text-neutral-600">{r.codice_articolo ?? "-"}</td>
                          <td className="py-1 pr-2 text-neutral-900">{r.descrizione}</td>
                          <td className="py-1 pr-2 text-neutral-600">{r.quantita ?? "-"}</td>
                          <td className="py-1 pr-2 text-neutral-600">{r.um ?? "-"}</td>
                          <td className="py-1 pr-2 text-neutral-600">{formattaEuro(r.prezzo_unitario)}</td>
                          <td className="py-1 pr-2 text-neutral-500">
                            {r.ddt_numero ? `${r.ddt_numero} (${formattaData(r.ddt_data)})` : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {f.rate_pagamento_fatture.length > 0 && (
                    <ul className="mb-2 space-y-1 text-sm text-neutral-700">
                      {f.rate_pagamento_fatture.map((r) => (
                        <li key={r.numero_rata}>
                          {formattaEuro(r.importo)} — scadenza {formattaData(r.data_scadenza)}
                          {r.modalita_pagamento &&
                            ` — ${ETICHETTE_MODALITA_PAGAMENTO[r.modalita_pagamento] ?? r.modalita_pagamento}`}
                          {r.data_pagamento_effettivo && (
                            <span className="text-green-700">
                              {" "}
                              — pagata il {formattaData(r.data_pagamento_effettivo)}
                              {r.metodo_pagamento_effettivo && ` (${r.metodo_pagamento_effettivo})`}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <button
                  onClick={() => window.print()}
                  className="mt-2 rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
                >
                  Stampa / Salva come PDF
                </button>

                {f.rate_pagamento_fatture.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-neutral-100 pt-3">
                    <p className="text-xs font-medium text-neutral-500">Registra pagamento rate</p>
                    {f.rate_pagamento_fatture.map((r) => (
                      <div key={r.id} className="flex flex-wrap items-center gap-2">
                        <span className="w-44 shrink-0 text-xs text-neutral-600">
                          Rata {r.numero_rata} — {formattaEuro(r.importo)} (scad.{" "}
                          {formattaData(r.data_scadenza)})
                        </span>
                        <FormPagamentoRata rata={r} onSalvata={rataAggiornata} />
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 border-t border-neutral-100 pt-3">
                  <button
                    onClick={() => confrontaConBolle(f)}
                    disabled={confrontoInCorso[f.id]}
                    className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                  >
                    {confrontoInCorso[f.id] ? "Confronto in corso…" : "🔍 Confronta con le bolle"}
                  </button>

                  {confrontoErrore[f.id] && (
                    <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">
                      {confrontoErrore[f.id]}
                    </p>
                  )}

                  {confrontoRisultati[f.id] && (
                    <div className="mt-2 space-y-1">
                      {(() => {
                        const risultati = confrontoRisultati[f.id];
                        const discrepanze = risultati.filter(
                          (r) => r.stato === "ok" && r.differenza !== null && Math.abs(r.differenza) >= 0.01
                        );
                        return (
                          <p className="text-xs text-neutral-500">
                            {discrepanze.length === 0
                              ? "Nessuna discrepanza di prezzo trovata."
                              : `${discrepanze.length} ${discrepanze.length === 1 ? "riga con differenza di prezzo" : "righe con differenza di prezzo"} rispetto alle bolle.`}
                          </p>
                        );
                      })()}
                      {confrontoRisultati[f.id].map((r, i) => {
                        const haDifferenza = r.stato === "ok" && r.differenza !== null && Math.abs(r.differenza) >= 0.01;
                        return (
                          <div
                            key={i}
                            className={`rounded-md border p-2 text-xs ${
                              haDifferenza
                                ? "border-amber-200 bg-amber-50"
                                : "border-neutral-100 text-neutral-500"
                            }`}
                          >
                            <p className={haDifferenza ? "text-neutral-900" : undefined}>
                              {r.riga.descrizione}
                            </p>
                            {r.stato === "senza-prodotto" && (
                              <p>Nessun prodotto corrispondente trovato a sistema per questo fornitore.</p>
                            )}
                            {r.stato === "senza-storico" && (
                              <p>Prodotto trovato, ma nessuna bolla registrata finora per confrontare il prezzo.</p>
                            )}
                            {r.stato === "ok" && (
                              <p>
                                Fattura {formattaEuro(r.riga.prezzo_unitario)} — bolla{" "}
                                {formattaEuro(r.prezzoRiferimento)} del {formattaData(r.dataRiferimento)}
                                {r.fonteRiferimento === "ddt" ? " (stesso DDT)" : " (ultimo prezzo registrato)"}
                                {haDifferenza && (
                                  <span className="ml-1 font-medium text-amber-800">
                                    — differenza {r.differenza! > 0 ? "+" : ""}
                                    {formattaEuro(r.differenza)}
                                  </span>
                                )}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
