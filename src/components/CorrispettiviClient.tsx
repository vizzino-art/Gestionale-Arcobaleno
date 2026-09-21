"use client";

import { useEffect, useState } from "react";
import { CAMPI_CORRISPETTIVI, type CampoCorrispettivo } from "@/lib/corrispettivi-campi";

function oggiIso(): string {
  return new Date().toISOString().slice(0, 10);
}

type ValoriForm = Record<string, string>;

// Formatta un importo con due decimali e virgola (stile italiano), usata
// sia quando arrivano i dati dal foglio sia quando l'utente esce da un
// campo (onBlur) — richiesto da Mauro il 21/9 ("tutti con due decimali e
// il simbolo dell'euro"). Se il testo non è un numero valido (es. campo
// vuoto o l'utente sta ancora scrivendo una virgola a metà) lo lascia
// invariato, non forza nulla mentre si digita.
function formattaImporto(grezzo: string): string {
  const pulito = grezzo.trim();
  if (pulito === "") return "";
  const numero = parseFloat(pulito.replace(",", "."));
  if (isNaN(numero)) return grezzo;
  return numero.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Layout a griglia densa, su richiesta esplicita di Mauro (20/9): "vorrei
// vedere tutto a colpo d'occhio, quindi nel caso andiamo a capo" — niente
// ricerca/scroll per trovare un campo, tutti visibili insieme, la griglia
// va semplicemente a capo su schermi stretti. Colori/badge/emoji aggiunti
// il 21/9 su richiesta di Mauro dopo aver visto la pagina la prima volta:
// Trasmesso in verde, Non riscosso in rosso, un'etichetta colorata accanto
// ai metodi di pagamento per riconoscerli a colpo d'occhio (badge scritti a
// mano, non i loghi ufficiali veri e propri — niente file esterni da
// scaricare/mantenere).
export function CorrispettiviClient() {
  const [data, setData] = useState(oggiIso());
  const [valori, setValori] = useState<ValoriForm>({});
  const [campiDisponibili, setCampiDisponibili] = useState<Set<string>>(
    new Set(CAMPI_CORRISPETTIVI.map((c) => c.id))
  );
  const [etichetteVersamento, setEtichetteVersamento] = useState<[string | null, string | null]>([
    null,
    null,
  ]);
  const [caricando, setCaricando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [messaggio, setMessaggio] = useState<{ tipo: "ok" | "errore"; testo: string } | null>(null);

  // Il setTimeout(..., 0) non è un debounce (qui non serve, il cambio data
  // non è digitazione rapida come in RegistraBollaClient): è solo il modo
  // già usato nel resto del progetto per evitare di chiamare setState in
  // modo sincrono dentro il corpo dell'effetto (regola react-hooks/
  // set-state-in-effect) — le setState vere e proprie restano tutte dentro
  // callback, mai nel corpo sincrono dell'effetto.
  useEffect(() => {
    let annullato = false;
    const timer = setTimeout(() => {
      setCaricando(true);
      setMessaggio(null);
      fetch(`/api/corrispettivi/leggi?data=${data}`)
        .then(async (r) => {
          const json = await r.json();
          if (annullato) return;
          if (!r.ok) {
            setMessaggio({ tipo: "errore", testo: json.errore ?? "Errore nel caricamento" });
            setValori({});
            setCampiDisponibili(new Set(CAMPI_CORRISPETTIVI.map((c) => c.id)));
            return;
          }
          const nuoviValori: ValoriForm = {};
          for (const campo of CAMPI_CORRISPETTIVI) {
            const v = json.valori?.[campo.id];
            if (v === null || v === undefined) {
              nuoviValori[campo.id] = "";
            } else if (campo.tipo === "importo") {
              nuoviValori[campo.id] = formattaImporto(String(v));
            } else {
              nuoviValori[campo.id] = String(v);
            }
          }
          setValori(nuoviValori);
          setCampiDisponibili(new Set(json.campiDisponibili ?? CAMPI_CORRISPETTIVI.map((c) => c.id)));
          setEtichetteVersamento(json.etichetteVersamento ?? [null, null]);
        })
        .catch(() => {
          if (!annullato) setMessaggio({ tipo: "errore", testo: "Impossibile contattare il server" });
        })
        .finally(() => {
          if (!annullato) setCaricando(false);
        });
    }, 0);
    return () => {
      annullato = true;
      clearTimeout(timer);
    };
  }, [data]);

  function etichettaCampo(campo: CampoCorrispettivo): string {
    if (campo.id === "versamento_1" && etichetteVersamento[0]) {
      return `Versamento conto ${etichetteVersamento[0]}`;
    }
    if (campo.id === "versamento_2" && etichetteVersamento[1]) {
      return `Versamento conto ${etichetteVersamento[1]}`;
    }
    return campo.etichetta;
  }

  async function salva() {
    setSalvando(true);
    setMessaggio(null);
    const valoriDaInviare: Record<string, number | null> = {};
    for (const campo of CAMPI_CORRISPETTIVI) {
      if (campo.soloLettura) continue; // "Cassa": mostrata ma mai inviata, è calcolata dal foglio
      if (!campiDisponibili.has(campo.id)) continue;
      const grezzo = (valori[campo.id] ?? "").trim();
      if (grezzo === "") {
        valoriDaInviare[campo.id] = null;
        continue;
      }
      const numero = parseFloat(grezzo.replace(",", "."));
      valoriDaInviare[campo.id] = isNaN(numero) ? null : numero;
    }
    try {
      const risposta = await fetch("/api/corrispettivi/salva", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, valori: valoriDaInviare }),
      });
      const json = await risposta.json();
      if (!risposta.ok) {
        setMessaggio({ tipo: "errore", testo: json.errore ?? "Errore nel salvataggio" });
      } else {
        setMessaggio({ tipo: "ok", testo: "Corrispettivi salvati sul foglio Google." });
      }
    } catch {
      setMessaggio({ tipo: "errore", testo: "Impossibile contattare il server" });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-neutral-500">Data</label>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="mt-0.5 block rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
        {caricando && <span className="text-sm text-neutral-400">Carico i dati di questo giorno…</span>}
      </div>

      {messaggio && (
        <p
          className={`mb-4 rounded-lg p-3 text-sm ${
            messaggio.tipo === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {messaggio.testo}
        </p>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {CAMPI_CORRISPETTIVI.filter((c) => campiDisponibili.has(c.id)).map((campo) => {
          const labelColore =
            campo.colore === "verde"
              ? "text-green-700"
              : campo.colore === "rosso"
                ? "text-red-700"
                : "text-neutral-500";
          const bordoColore =
            campo.colore === "verde"
              ? "border-green-300 focus:border-green-500"
              : campo.colore === "rosso"
                ? "border-red-300 focus:border-red-500"
                : "border-neutral-300";
          return (
            <div key={campo.id}>
              <div className="mb-0.5 flex flex-wrap items-center gap-1">
                <label className={`text-xs ${labelColore}`}>{etichettaCampo(campo)}</label>
                {campo.emoji && <span className="text-xs">{campo.emoji}</span>}
                {campo.badge && (
                  <span
                    className={`rounded px-1 py-0.5 text-[9px] font-semibold leading-none ${campo.badge.classe}`}
                  >
                    {campo.badge.testo}
                  </span>
                )}
              </div>
              <div className="relative">
                {campo.tipo === "importo" && (
                  <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-sm text-neutral-400">
                    €
                  </span>
                )}
                <input
                  type="text"
                  inputMode={campo.tipo === "importo" ? "decimal" : "numeric"}
                  value={valori[campo.id] ?? ""}
                  onChange={(e) => setValori((prec) => ({ ...prec, [campo.id]: e.target.value }))}
                  onBlur={(e) => {
                    if (campo.tipo !== "importo") return;
                    const formattato = formattaImporto(e.target.value);
                    setValori((prec) => ({ ...prec, [campo.id]: formattato }));
                  }}
                  placeholder={campo.tipo === "intero" ? "0" : "0,00"}
                  disabled={caricando || campo.soloLettura}
                  readOnly={campo.soloLettura}
                  className={`mt-0.5 block w-full rounded-md border py-1.5 text-sm disabled:opacity-70 ${bordoColore} ${
                    campo.tipo === "importo" ? "pl-5 pr-2" : "px-2"
                  } ${campo.soloLettura ? "bg-neutral-100 text-neutral-500" : ""}`}
                />
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={salva}
        disabled={salvando || caricando}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {salvando ? "Salvataggio…" : "💾 Salva corrispettivi"}
      </button>
    </div>
  );
}
