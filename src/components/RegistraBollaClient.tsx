"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { prossimoOrdine } from "@/lib/prodotti";
import type { Categoria, Fornitore, Prodotto } from "@/lib/types";

// Sentinella per "questo prodotto non esiste ancora, crealo" nel menu a
// tendina di abbinamento — non è un uuid reale, viene risolta in salvaTutto().
const NUOVO_PRODOTTO = "NUOVO";
// Sentinella per "voglio creare una categoria nuova" nel menu a tendina
// categoria — anche questa risolta in salvaTutto() (crea la riga in
// "categorie" se non esiste già una con lo stesso nome).
const NUOVA_CATEGORIA = "NUOVA_CATEGORIA";

type Props = {
  fornitori: Fornitore[];
  prodotti: Prodotto[];
  categorie: Categoria[];
};

type RigaEstratta = {
  codice_articolo: string | null;
  descrizione: string;
  quantita: number | null;
  prezzo_unitario: number | null;
  um: string | null;
};

type RispostaEstrazione = {
  numero_ddt: string | null;
  data: string | null;
  righe: RigaEstratta[];
};

// Riga di lavoro in fase di revisione: parte da quanto letto dalla foto,
// modificabile prima di salvare, con il prodotto abbinato e la scelta se
// aggiornare anche il prezzo di listino.
type RigaLavoro = {
  chiave: string;
  codiceArticolo: string;
  descrizione: string;
  quantita: string;
  prezzo: string;
  um: string;
  prodottoId: string; // "" = nessuna corrispondenza scelta
  aggiornaPrezzo: boolean;
  umConfermata: boolean; // per prodotti nuovi con UM non riconosciuta: conferma esplicita di Mauro
  categoriaId: string; // solo per prodotti nuovi: "" = nessuna, la sceglie dopo in Pannello; NUOVA_CATEGORIA = la crea al volo
  categoriaNuovoNome: string; // nome della nuova categoria, quando categoriaId === NUOVA_CATEGORIA
};

function normalizza(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9À-Ù]+/g, " ").trim();
}

// Punteggio di somiglianza tra la descrizione letta dalla foto e quella di
// un prodotto a sistema: 1 se identiche, altrimenti frazione di parole (>2
// lettere) della riga estratta che compaiono anche nella descrizione a
// sistema.
function punteggioDescrizione(descRigaNormalizzata: string, prodotto: Prodotto): number {
  const descP = normalizza(prodotto.descrizione);
  if (descP === descRigaNormalizzata) return 1;
  const parole = descRigaNormalizzata.split(" ").filter((w) => w.length > 2);
  if (parole.length === 0) return 0;
  const paroleP = new Set(descP.split(" "));
  const comuni = parole.filter((w) => paroleP.has(w)).length;
  return comuni / parole.length;
}

// Abbinamento automatico — sempre e comunque modificabile a mano dopo, non è
// mai definitivo finché non si salva. Doppio controllo per evitare falsi
// positivi: un codice articolo letto male dalla foto può coincidere per
// caso con quello di un prodotto sbagliato, quindi un match per codice
// viene accettato solo se anche la descrizione lo conferma almeno un po'
// (soglia più bassa di quella usata quando si va a descrizione da sola,
// perché il codice esatto è già un indizio forte). Se il codice combacia ma
// la descrizione è troppo diversa, si prova comunque con la sola
// descrizione invece di fidarsi ciecamente del codice.
function trovaMatch(riga: RigaEstratta, prodottiFornitore: Prodotto[]): string {
  const desc = normalizza(riga.descrizione);

  if (riga.codice_articolo) {
    const codice = normalizza(riga.codice_articolo);
    const candidatiPerCodice = prodottiFornitore.filter(
      (p) => p.codice_articolo && normalizza(p.codice_articolo) === codice
    );
    const confermatoDaDescrizione = candidatiPerCodice.find(
      (p) => punteggioDescrizione(desc, p) >= 0.4
    );
    if (confermatoDaDescrizione) return confermatoDaDescrizione.id;
  }

  const perDescrizioneEsatta = prodottiFornitore.find((p) => normalizza(p.descrizione) === desc);
  if (perDescrizioneEsatta) return perDescrizioneEsatta.id;

  let migliore: { id: string; punteggio: number } | null = null;
  for (const p of prodottiFornitore) {
    const punteggio = punteggioDescrizione(desc, p);
    if (punteggio >= 0.6 && (!migliore || punteggio > migliore.punteggio)) {
      migliore = { id: p.id, punteggio };
    }
  }
  return migliore?.id ?? "";
}

async function ridimensionaEComprimi(file: File): Promise<{ base64: string; mediaType: string }> {
  const bitmap = await createImageBitmap(file);
  const MAX = 1600;
  let { width, height } = bitmap;
  if (width > MAX || height > MAX) {
    const scala = MAX / Math.max(width, height);
    width = Math.round(width * scala);
    height = Math.round(height * scala);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Impossibile elaborare l'immagine su questo dispositivo.");
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Conversione immagine fallita"))), "image/jpeg", 0.85)
  );
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const risultato = reader.result as string;
      resolve(risultato.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(new Error("Lettura immagine fallita"));
    reader.readAsDataURL(blob);
  });
  return { base64, mediaType: "image/jpeg" };
}

// Un PDF (es. fattura ricevuta già in digitale via email) va inviato così
// com'è, senza ridimensionamento/compressione: Claude legge i PDF
// direttamente. Limite prudenziale sul peso del file per restare sotto il
// tetto di ~4,5 MB per richiesta imposto da Vercel sulle funzioni server
// (un PDF più pesante andrebbe spezzato o sostituito da una foto).
const PDF_MAX_BYTES = 3 * 1024 * 1024;

async function leggiPdfComeBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  if (file.size > PDF_MAX_BYTES) {
    throw new Error(
      "Questo PDF è troppo pesante (oltre 3 MB) per essere inviato. Prova a esportare una versione più leggera, oppure fai direttamente una foto del documento."
    );
  }
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const risultato = reader.result as string;
      resolve(risultato.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(new Error("Lettura del PDF fallita"));
    reader.readAsDataURL(file);
  });
  return { base64, mediaType: "application/pdf" };
}

export function RegistraBollaClient({ fornitori, prodotti, categorie }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const inputFotoRef = useRef<HTMLInputElement>(null);

  const [fornitoreId, setFornitoreId] = useState<string>(fornitori[0]?.id ?? "");
  const [numeroDdt, setNumeroDdt] = useState("");
  const [dataDocumento, setDataDocumento] = useState("");
  const [anteprimaUrl, setAnteprimaUrl] = useState<string | null>(null);
  const [anteprimaPdfNome, setAnteprimaPdfNome] = useState<string | null>(null);
  const [righe, setRighe] = useState<RigaLavoro[]>([]);
  const [estrazioneFatta, setEstrazioneFatta] = useState(false);

  const [caricando, setCaricando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [salvato, setSalvato] = useState(false);

  // Categorie: partono da quelle già a sistema, ma quando se ne crea una al
  // volo da qui (vedi NUOVA_CATEGORIA) si aggiunge anche a questo elenco
  // locale, così è subito disponibile per altre righe nella stessa bolla
  // senza dover ricaricare la pagina.
  const [categorieLocali, setCategorieLocali] = useState<Categoria[]>(categorie);

  // Controllo bolla già registrata: quando numero DDT/fornitore combaciano
  // con qualcosa già salvato, avvisiamo prima che Mauro la registri due
  // volte per sbaglio (es. se si dimentica di averla già fatta).
  const [duplicato, setDuplicato] = useState<{ righe: number } | null>(null);
  const [duplicatoConfermato, setDuplicatoConfermato] = useState(false);

  const prodottiFornitore = useMemo(
    () => prodotti.filter((p) => p.fornitore_id === fornitoreId),
    [prodotti, fornitoreId]
  );

  // Unità di misura già in uso nel gestionale (su qualsiasi fornitore): serve
  // solo per accorgersi se la UM letta dalla foto per un prodotto NUOVO è
  // probabilmente un errore di lettura, non per validare prodotti già
  // esistenti (quelli hanno già la loro UM corretta a sistema).
  const umConosciute = useMemo(() => {
    const set = new Set<string>();
    for (const p of prodotti) {
      if (p.um) set.add(normalizza(p.um));
    }
    return set;
  }, [prodotti]);

  function umSospetta(um: string): boolean {
    return !um.trim() || !umConosciute.has(normalizza(um));
  }

  function prodottoDa(id: string): Prodotto | undefined {
    return prodottiFornitore.find((p) => p.id === id);
  }

  // Controlla se esiste già una bolla registrata con lo stesso numero DDT
  // per questo fornitore (la chiave naturale per accorgersi di un
  // doppione). Riparte ogni volta che numero/fornitore cambiano — sia
  // subito dopo la lettura della foto, sia se Mauro corregge il numero a
  // mano — con un piccolo ritardo per non interrogare il database a ogni
  // singolo carattere digitato.
  useEffect(() => {
    let annullato = false;
    const timer = setTimeout(async () => {
      if (!estrazioneFatta || !fornitoreId || !numeroDdt.trim()) {
        if (!annullato) setDuplicato(null);
        return;
      }
      const { count } = await supabase
        .from("storico_prezzi_fatture")
        .select("id", { count: "exact", head: true })
        .eq("fornitore_id", fornitoreId)
        .eq("numero_fattura", `DDT ${numeroDdt.trim()}`);
      if (!annullato) {
        setDuplicato(count && count > 0 ? { righe: count } : null);
      }
    }, 400);
    return () => {
      annullato = true;
      clearTimeout(timer);
    };
  }, [estrazioneFatta, fornitoreId, numeroDdt, supabase]);

  async function scattaOCarica(file: File) {
    setErrore(null);
    setSalvato(false);
    setCaricando(true);
    setEstrazioneFatta(false);
    setRighe([]);

    const ePdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (ePdf) {
      setAnteprimaUrl(null);
      setAnteprimaPdfNome(file.name);
    } else {
      setAnteprimaPdfNome(null);
      setAnteprimaUrl(URL.createObjectURL(file));
    }

    try {
      const { base64, mediaType } = ePdf ? await leggiPdfComeBase64(file) : await ridimensionaEComprimi(file);
      const risposta = await fetch("/api/estrai-bolla", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ immagine: base64, mediaType }),
      });
      const dati = await risposta.json();

      if (!risposta.ok) {
        setErrore(dati?.errore ?? "Errore durante la lettura della foto.");
        setCaricando(false);
        return;
      }

      const estratto = dati as RispostaEstrazione;
      setNumeroDdt(estratto.numero_ddt ?? "");
      setDataDocumento(estratto.data ?? "");

      const nuoveRighe: RigaLavoro[] = estratto.righe.map((r, i) => {
        const prodottoId = trovaMatch(r, prodottiFornitore);
        return {
          chiave: `${Date.now()}-${i}`,
          codiceArticolo: r.codice_articolo ?? "",
          descrizione: r.descrizione,
          quantita: r.quantita != null ? String(r.quantita) : "",
          prezzo: r.prezzo_unitario != null ? String(r.prezzo_unitario) : "",
          um: r.um ?? "",
          prodottoId,
          aggiornaPrezzo: true,
          umConfermata: false,
          categoriaId: "",
          categoriaNuovoNome: "",
        };
      });
      setRighe(nuoveRighe);
      setEstrazioneFatta(true);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Errore imprevisto durante la lettura della foto.");
    } finally {
      setCaricando(false);
    }
  }

  function aggiornaRiga(chiave: string, campo: keyof RigaLavoro, valore: string | boolean) {
    setRighe((prev) =>
      prev.map((r) => (r.chiave === chiave ? { ...r, [campo]: valore } : r))
    );
  }

  function rimuoviRiga(chiave: string) {
    setRighe((prev) => prev.filter((r) => r.chiave !== chiave));
  }

  async function salvaTutto() {
    if (!fornitoreId) return;
    if (duplicato && !duplicatoConfermato) {
      setErrore("Questa bolla risulta già registrata: spunta la conferma sopra prima di salvare, se sei sicuro che non sia un doppione.");
      return;
    }
    setSalvando(true);
    setErrore(null);

    const daSaltare: string[] = [];
    const daVerificare: string[] = [];
    const righeRiuscite = new Set<string>();
    const inserimentiStorico: {
      prodotto_id: string;
      fornitore_id: string;
      data: string;
      numero_fattura: string | null;
      prezzo: number;
      quantita: number | null;
    }[] = [];
    const aggiornamentiPrezzo: { id: string; prezzo: number }[] = [];

    // Contatore locale per l'"ordine" dei prodotti creati in questa stessa
    // bolla: prossimoOrdine() guarda i prodotti già esistenti, ma se in
    // questo salvataggio ne creiamo più di uno vanno messi in coda uno
    // dopo l'altro, non tutti con lo stesso valore.
    let prossimoOrdineNuovo = prossimoOrdine(prodottiFornitore);

    // Copia locale delle categorie disponibili: se in questo salvataggio si
    // crea una categoria nuova, viene aggiunta qui subito così una riga
    // successiva con lo stesso nome la riusa invece di crearne un'altra
    // duplicata.
    const categorieDisponibili = [...categorieLocali];

    for (const r of righe) {
      const prezzo = parseFloat(r.prezzo.replace(",", "."));
      if (isNaN(prezzo)) {
        daSaltare.push(r.descrizione);
        continue;
      }
      const quantita = r.quantita ? parseFloat(r.quantita.replace(",", ".")) : null;

      let prodottoId = r.prodottoId;

      if (prodottoId === NUOVO_PRODOTTO) {
        // Prima di creare un prodotto nuovo mai visto, controlliamo che la
        // UM letta dalla foto sia plausibile: se non è tra quelle già usate
        // nel gestionale, non si salva finché Mauro non conferma (o non la
        // corregge) — evita di popolare il catalogo con dati sbagliati.
        if (umSospetta(r.um) && !r.umConfermata) {
          daVerificare.push(r.descrizione);
          continue;
        }

        // Se per questo prodotto nuovo è stata scelta "+ Nuova categoria",
        // la creiamo ora (o riusiamo quella appena creata da una riga
        // precedente nella stessa bolla, se il nome coincide) prima di
        // creare il prodotto stesso.
        let categoriaIdFinale = r.categoriaId;
        if (categoriaIdFinale === NUOVA_CATEGORIA) {
          const nomeCategoria = r.categoriaNuovoNome.trim();
          if (!nomeCategoria) {
            categoriaIdFinale = "";
          } else {
            const esistente = categorieDisponibili.find(
              (c) => normalizza(c.nome) === normalizza(nomeCategoria)
            );
            if (esistente) {
              categoriaIdFinale = esistente.id;
            } else {
              const { data: nuovaCat, error: erroreCat } = await supabase
                .from("categorie")
                .insert({ nome: nomeCategoria })
                .select("id, nome")
                .single();
              if (erroreCat || !nuovaCat) {
                setErrore(`Errore nella creazione della categoria "${nomeCategoria}": ${erroreCat?.message ?? "sconosciuto"}`);
                setSalvando(false);
                return;
              }
              categorieDisponibili.push(nuovaCat);
              categoriaIdFinale = nuovaCat.id;
            }
          }
        }

        const { data: nuovo, error } = await supabase
          .from("prodotti")
          .insert({
            fornitore_id: fornitoreId,
            categoria_id: categoriaIdFinale || null,
            descrizione: r.descrizione,
            codice_articolo: r.codiceArticolo || null,
            um: r.um || null,
            prezzo_listino: prezzo,
            sconto1: 0,
            sconto2: 0,
            sconto3: 0,
            ordine: prossimoOrdineNuovo,
          })
          .select("id")
          .single();
        if (error || !nuovo) {
          setErrore(`Errore nella creazione del prodotto "${r.descrizione}": ${error?.message ?? "sconosciuto"}`);
          setSalvando(false);
          return;
        }
        prossimoOrdineNuovo += 1;
        prodottoId = nuovo.id;
        // Il prezzo è già quello giusto appena inserito: non serve un
        // aggiornamento separato più sotto.
      } else if (!prodottoId) {
        daSaltare.push(r.descrizione);
        continue;
      } else if (r.aggiornaPrezzo) {
        aggiornamentiPrezzo.push({ id: prodottoId, prezzo });
      }

      righeRiuscite.add(r.chiave);
      inserimentiStorico.push({
        prodotto_id: prodottoId,
        fornitore_id: fornitoreId,
        data: dataDocumento || new Date().toISOString().slice(0, 10),
        numero_fattura: numeroDdt ? `DDT ${numeroDdt}` : null,
        prezzo,
        quantita,
      });
    }

    if (inserimentiStorico.length > 0) {
      const { error } = await supabase.from("storico_prezzi_fatture").insert(inserimentiStorico);
      if (error) {
        setErrore(`Errore nel salvataggio dello storico: ${error.message}`);
        setSalvando(false);
        return;
      }
    }

    for (const agg of aggiornamentiPrezzo) {
      // Il prezzo della bolla è il netto realmente pagato: aggiornando il
      // listino azzeriamo anche eventuali sconti a cascata già impostati,
      // altrimenti il prezzo netto calcolato risulterebbe diverso da quello
      // pagato davvero.
      const { error } = await supabase
        .from("prodotti")
        .update({ prezzo_listino: agg.prezzo, sconto1: 0, sconto2: 0, sconto3: 0 })
        .eq("id", agg.id);
      if (error) {
        setErrore(`Errore nell'aggiornamento del prezzo: ${error.message}`);
        setSalvando(false);
        return;
      }
    }

    if (categorieDisponibili.length !== categorieLocali.length) {
      setCategorieLocali(categorieDisponibili);
    }

    setSalvando(false);
    setSalvato(righeRiuscite.size > 0);

    // Le righe salvate con successo spariscono dalla revisione; quelle
    // saltate (nessun abbinamento) o in attesa di conferma (UM sospetta)
    // restano visibili così si possono correggere e salvare di nuovo senza
    // dover rifare la foto da capo.
    setRighe((prev) => prev.filter((r) => !righeRiuscite.has(r.chiave)));

    if (righeRiuscite.size === righe.length) {
      setEstrazioneFatta(false);
      setAnteprimaUrl(null);
      setNumeroDdt("");
      setDataDocumento("");
      if (inputFotoRef.current) inputFotoRef.current.value = "";
    }

    const messaggi: string[] = [];
    if (daSaltare.length > 0) {
      messaggi.push(
        `${daSaltare.length} riga/e non abbinata/e a un prodotto (${daSaltare.join(", ")}): scegli un prodotto dal menu o "+ Crea nuovo prodotto".`
      );
    }
    if (daVerificare.length > 0) {
      messaggi.push(
        `${daVerificare.length} riga/e in attesa di conferma sull'unità di misura (${daVerificare.join(", ")}): correggi la UM oppure spunta "Confermo" per salvarla comunque.`
      );
    }
    if (messaggi.length > 0) {
      setErrore(`Attenzione: ${messaggi.join(" ")}`);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <label className="mb-3 block text-xs text-neutral-500">
          Fornitore
          <select
            value={fornitoreId}
            onChange={(e) => {
              setFornitoreId(e.target.value);
              setRighe([]);
              setEstrazioneFatta(false);
              setAnteprimaUrl(null);
              setAnteprimaPdfNome(null);
              setDuplicatoConfermato(false);
            }}
            className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          >
            {fornitori.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </label>

        <input
          ref={inputFotoRef}
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) scattaOCarica(file);
          }}
        />
        <button
          onClick={() => inputFotoRef.current?.click()}
          disabled={!fornitoreId || caricando}
          className="w-full rounded-lg bg-neutral-900 px-4 py-3 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {caricando ? "Leggo la bolla…" : "📷 Fai foto o carica bolla/PDF"}
        </button>

        {anteprimaUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={anteprimaUrl} alt="Anteprima bolla" className="mt-3 max-h-48 rounded-lg border border-neutral-200 object-contain" />
        )}
        {anteprimaPdfNome && (
          <p className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
            📄 {anteprimaPdfNome}
          </p>
        )}
      </div>

      {errore && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errore}</p>
      )}

      {salvato && (
        <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
          ✓ Bolla registrata. Fai la prossima foto quando vuoi.
        </p>
      )}

      {estrazioneFatta && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="mb-3 flex gap-3">
            <label className="flex-1 text-xs text-neutral-500">
              Numero DDT
              <input
                type="text"
                value={numeroDdt}
                onChange={(e) => {
                  setNumeroDdt(e.target.value);
                  setDuplicatoConfermato(false);
                }}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
            </label>
            <label className="flex-1 text-xs text-neutral-500">
              Data
              <input
                type="date"
                value={dataDocumento}
                onChange={(e) => setDataDocumento(e.target.value)}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
            </label>
          </div>

          {duplicato && (
            <div className="mb-3 rounded-md bg-red-50 p-3 text-xs text-red-800">
              <p>
                ⚠️ Risulta già registrata una bolla con questo numero DDT per questo fornitore
                ({duplicato.righe} {duplicato.righe === 1 ? "riga" : "righe"} già salvate). Controlla
                in &quot;Storico bolle&quot; se l&apos;hai già inserita prima di continuare, per non
                registrarla due volte.
              </p>
              <label className="mt-2 flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={duplicatoConfermato}
                  onChange={(e) => setDuplicatoConfermato(e.target.checked)}
                />
                Ho controllato, non è un doppione: registrala comunque
              </label>
            </div>
          )}

          {righe.length === 0 && (
            <p className="text-sm text-neutral-500">
              Non ho trovato righe leggibili in questa foto. Riprova con un&apos;inquadratura più
              chiara.
            </p>
          )}

          <div className="space-y-3">
            {righe.map((r) => {
              const prodottoScelto = prodottoDa(r.prodottoId);
              const prezzoAttuale = prodottoScelto?.prezzo_listino ?? null;
              const prezzoNuovo = parseFloat(r.prezzo.replace(",", "."));
              const prezzoCambiato =
                prodottoScelto &&
                prezzoAttuale != null &&
                !isNaN(prezzoNuovo) &&
                Math.abs(prezzoAttuale - prezzoNuovo) > 0.004;

              return (
                <div key={r.chiave} className="rounded-lg border border-neutral-200 p-3">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <input
                      type="text"
                      value={r.descrizione}
                      onChange={(e) => aggiornaRiga(r.chiave, "descrizione", e.target.value)}
                      className="flex-1 rounded-md border border-neutral-300 px-2 py-1.5 text-sm font-medium outline-none focus:border-neutral-500"
                    />
                    <button
                      onClick={() => rimuoviRiga(r.chiave)}
                      className="shrink-0 rounded-md px-2 py-1.5 text-xs text-neutral-400 hover:bg-neutral-100 hover:text-red-600"
                      title="Rimuovi questa riga"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mb-2 flex gap-2">
                    <label className="w-24 text-xs text-neutral-500">
                      Quantità
                      <input
                        type="text"
                        value={r.quantita}
                        onChange={(e) => aggiornaRiga(r.chiave, "quantita", e.target.value)}
                        className="mt-1 block w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-neutral-500"
                      />
                    </label>
                    <label className="w-28 text-xs text-neutral-500">
                      Prezzo (€)
                      <input
                        type="text"
                        value={r.prezzo}
                        onChange={(e) => aggiornaRiga(r.chiave, "prezzo", e.target.value)}
                        className="mt-1 block w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-neutral-500"
                      />
                    </label>
                    <label className="w-20 text-xs text-neutral-500">
                      UM
                      <input
                        type="text"
                        value={r.um}
                        onChange={(e) => aggiornaRiga(r.chiave, "um", e.target.value)}
                        className="mt-1 block w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-neutral-500"
                      />
                    </label>
                  </div>

                  <label className="block text-xs text-neutral-500">
                    Prodotto a sistema
                    <select
                      value={r.prodottoId}
                      onChange={(e) => aggiornaRiga(r.chiave, "prodottoId", e.target.value)}
                      className="mt-1 block w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-neutral-500"
                    >
                      <option value="">— nessuna corrispondenza, scegli tu —</option>
                      <option value={NUOVO_PRODOTTO}>+ Crea nuovo prodotto con questi dati</option>
                      {prodottiFornitore.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.descrizione}
                        </option>
                      ))}
                    </select>
                  </label>

                  {!r.prodottoId && (
                    <p className="mt-1.5 text-xs text-amber-600">
                      Nessun prodotto abbinato: scegli un prodotto esistente dal menu, oppure
                      &quot;+ Crea nuovo prodotto&quot; per aggiungerlo al catalogo di questo
                      fornitore salvando questa bolla (potrai poi completare categoria e peso/kg
                      in Pannello, per includerlo anche nel confronto prezzi).
                    </p>
                  )}

                  {r.prodottoId === NUOVO_PRODOTTO && (
                    <div className="mt-2 rounded-md bg-blue-50 p-2.5">
                      <p className="text-xs text-blue-800">
                        Verrà creato un nuovo prodotto per{" "}
                        {fornitori.find((f) => f.id === fornitoreId)?.nome ?? "questo fornitore"}{" "}
                        con questa descrizione, codice e prezzo.
                      </p>
                      <label className="mt-2 block text-xs text-blue-800">
                        Categoria (per il confronto prezzi — facoltativa, puoi impostarla anche
                        dopo in Pannello)
                        <select
                          value={r.categoriaId}
                          onChange={(e) => aggiornaRiga(r.chiave, "categoriaId", e.target.value)}
                          className="mt-1 block w-full rounded-md border border-blue-200 bg-white px-2 py-1.5 text-sm text-neutral-900 outline-none focus:border-blue-400"
                        >
                          <option value="">— nessuna, la categorizzo dopo —</option>
                          <option value={NUOVA_CATEGORIA}>+ Crea nuova categoria…</option>
                          {categorieLocali.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nome}
                            </option>
                          ))}
                        </select>
                      </label>
                      {r.categoriaId === NUOVA_CATEGORIA && (
                        <input
                          type="text"
                          value={r.categoriaNuovoNome}
                          onChange={(e) => aggiornaRiga(r.chiave, "categoriaNuovoNome", e.target.value)}
                          placeholder="Nome della nuova categoria"
                          className="mt-1.5 block w-full rounded-md border border-blue-200 bg-white px-2 py-1.5 text-sm text-neutral-900 outline-none focus:border-blue-400"
                        />
                      )}
                      {!r.categoriaId && (
                        <p className="mt-1.5 text-xs text-blue-700">
                          Senza categoria e peso/kg il prodotto non entra nel confronto prezzi, ma
                          viene comunque creato e registrato nello storico.
                        </p>
                      )}
                    </div>
                  )}

                  {r.prodottoId === NUOVO_PRODOTTO && umSospetta(r.um) && (
                    <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-amber-50 px-2.5 py-2 text-xs">
                      <span className="text-amber-800">
                        {r.um.trim()
                          ? `UM "${r.um}" non è tra quelle già usate nel gestionale: potrebbe essere letta male dalla foto.`
                          : "UM non letta dalla foto: controlla e inseriscila."}
                      </span>
                      <label className="flex shrink-0 items-center gap-1.5 text-amber-800">
                        <input
                          type="checkbox"
                          checked={r.umConfermata}
                          onChange={(e) => aggiornaRiga(r.chiave, "umConfermata", e.target.checked)}
                        />
                        Confermo
                      </label>
                    </div>
                  )}

                  {prezzoCambiato && (
                    <div className="mt-2 flex items-center justify-between rounded-md bg-amber-50 px-2.5 py-2 text-xs">
                      <span className="text-amber-800">
                        Prezzo cambiato: €{prezzoAttuale?.toFixed(2)} → €{prezzoNuovo.toFixed(2)}
                      </span>
                      <label className="flex items-center gap-1.5 text-amber-800">
                        <input
                          type="checkbox"
                          checked={r.aggiornaPrezzo}
                          onChange={(e) => aggiornaRiga(r.chiave, "aggiornaPrezzo", e.target.checked)}
                        />
                        Aggiorna il listino
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {righe.length > 0 && (
            <button
              onClick={salvaTutto}
              disabled={salvando || (duplicato !== null && !duplicatoConfermato)}
              className="mt-4 w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {salvando ? "Salvo…" : `Salva ${righe.filter((r) => r.prodottoId).length} di ${righe.length} righe`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
