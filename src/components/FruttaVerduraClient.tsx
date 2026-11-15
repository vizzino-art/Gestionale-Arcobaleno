"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  BOZZA_VUOTA,
  FRUTTA_FV,
  UNITA_FV,
  VERDURA_FV,
  costruisciMessaggioFV,
  formattaQuantitaFV,
  linkWhatsAppFV,
  parseQuantitaFV,
  tuttiINomiFV,
  type BozzaFruttaVerdura,
  type UnitaFV,
} from "@/lib/frutta-verdura";

type Props = {
  bozzaIniziale: BozzaFruttaVerdura;
  aggiornatoIlIniziale: string;
};

// Ogni quanti millisecondi la pagina ricontrolla se l'altra persona (es.
// il padre di Mauro, dal suo telefono) ha cambiato qualcosa nel frattempo
// — niente Supabase Realtime, solo un controllo periodico: con due sole
// persone che usano la pagina ogni tanto è più che sufficiente ed è molto
// più semplice da mantenere.
const INTERVALLO_RICARICA_MS = 8000;
// Attesa dopo l'ultimo carattere digitato prima di salvare (quantità
// scritte a mano, note) — i tocchi su −/+, unità, aggiungi/rimuovi/svuota
// si salvano invece subito, non sono testo che si digita lettera per lettera.
const ATTESA_SALVATAGGIO_MS = 500;

// Riga di un prodotto: componente a sé (non definito dentro
// FruttaVerduraClient) apposta — se fosse una funzione interna verrebbe
// ricreata a ogni nuovo carattere digitato e React perderebbe il fuoco
// sull'input della quantità a ogni tasto premuto.
function RigaProdottoFV({
  nome,
  quantita,
  unita,
  removibile,
  onDecrementa,
  onIncrementa,
  onDigita,
  onCambiaUnita,
  onRimuovi,
}: {
  nome: string;
  quantita: number;
  unita: UnitaFV;
  removibile: boolean;
  onDecrementa: () => void;
  onIncrementa: () => void;
  onDigita: (valore: string) => void;
  onCambiaUnita: (unita: UnitaFV) => void;
  onRimuovi: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-2 border-t border-neutral-200 p-2 first:border-t-0 ${
        quantita > 0 ? "bg-emerald-50" : ""
      }`}
    >
      {removibile && (
        <button
          onClick={onRimuovi}
          aria-label={`Rimuovi ${nome}`}
          className="shrink-0 px-1 text-lg text-red-600"
        >
          ×
        </button>
      )}
      <span className="min-w-0 flex-1 truncate text-sm font-semibold uppercase text-neutral-800">
        {nome}
      </span>
      <button
        onClick={onDecrementa}
        className="h-9 w-9 shrink-0 rounded-md border border-neutral-300 bg-neutral-50 text-lg leading-none text-neutral-700"
      >
        −
      </button>
      <input
        inputMode="decimal"
        value={quantita ? formattaQuantitaFV(quantita) : ""}
        onChange={(e) => onDigita(e.target.value)}
        placeholder="0"
        className="h-9 w-14 shrink-0 rounded-md border border-neutral-300 text-center text-sm"
      />
      <button
        onClick={onIncrementa}
        className="h-9 w-9 shrink-0 rounded-md border border-neutral-300 bg-neutral-50 text-lg leading-none text-neutral-700"
      >
        +
      </button>
      <select
        value={unita}
        onChange={(e) => onCambiaUnita(e.target.value as UnitaFV)}
        className="h-9 shrink-0 rounded-md border border-neutral-300 bg-white px-1 text-sm"
      >
        {UNITA_FV.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </select>
    </div>
  );
}

export function FruttaVerduraClient({ bozzaIniziale, aggiornatoIlIniziale }: Props) {
  const [supabase] = useState(() => createClient());
  const [bozza, setBozza] = useState<BozzaFruttaVerdura>(bozzaIniziale);
  const [nuovoNome, setNuovoNome] = useState("");
  const [confermaSvuota, setConfermaSvuota] = useState(false);
  const [copiato, setCopiato] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Ultimo "aggiornato_il" conosciuto (nostro o altrui) — serve a capire,
  // al prossimo controllo periodico, se nel frattempo è arrivata una
  // modifica da un altro telefono (in quel caso l'orario sarà diverso dal
  // nostro) oppure no (stesso orario: niente da ricaricare).
  const ultimoAggiornamentoRef = useRef(aggiornatoIlIniziale);
  const timeoutSalvataggioRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function salva(nuovaBozza: BozzaFruttaVerdura) {
    const { data, error } = await supabase
      .from("bozza_frutta_verdura")
      .update({ dati: nuovaBozza, aggiornato_il: new Date().toISOString() })
      .eq("id", 1)
      .select("aggiornato_il")
      .single();
    if (!error && data) ultimoAggiornamentoRef.current = data.aggiornato_il;
  }

  function aggiorna(nuovaBozza: BozzaFruttaVerdura, immediato: boolean) {
    setBozza(nuovaBozza);
    if (timeoutSalvataggioRef.current) clearTimeout(timeoutSalvataggioRef.current);
    if (immediato) {
      salva(nuovaBozza);
    } else {
      timeoutSalvataggioRef.current = setTimeout(() => salva(nuovaBozza), ATTESA_SALVATAGGIO_MS);
    }
  }

  useEffect(() => {
    async function ricarica() {
      const { data } = await supabase
        .from("bozza_frutta_verdura")
        .select("dati, aggiornato_il")
        .eq("id", 1)
        .maybeSingle();
      if (data && data.aggiornato_il !== ultimoAggiornamentoRef.current) {
        ultimoAggiornamentoRef.current = data.aggiornato_il;
        // Stesso merge con BOZZA_VUOTA della pagina server: "dati" può
        // mancare di qty/unit/extra/note se la riga è stata creata senza
        // quella forma completa (vedi commento in page.tsx).
        setBozza({ ...BOZZA_VUOTA, ...(data.dati as Partial<BozzaFruttaVerdura> | null) });
      }
    }
    const intervallo = setInterval(ricarica, INTERVALLO_RICARICA_MS);
    function alTornareVisibile() {
      if (document.visibilityState === "visible") ricarica();
    }
    document.addEventListener("visibilitychange", alTornareVisibile);
    return () => {
      clearInterval(intervallo);
      document.removeEventListener("visibilitychange", alTornareVisibile);
    };
    // Si registra una volta sola: "supabase" non cambia mai dopo il primo
    // render (viene creato con useState(() => ...)).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function mostraToast(testo: string) {
    setToast(testo);
    setTimeout(() => setToast(null), 1600);
  }

  function impostaQuantita(nome: string, valoreTestuale: string, immediato: boolean) {
    aggiorna({ ...bozza, qty: { ...bozza.qty, [nome]: parseQuantitaFV(valoreTestuale) } }, immediato);
  }

  function impostaUnita(nome: string, unita: UnitaFV) {
    aggiorna({ ...bozza, unit: { ...bozza.unit, [nome]: unita } }, true);
  }

  function rimuoviExtra(nome: string) {
    const qty = { ...bozza.qty };
    delete qty[nome];
    const unit = { ...bozza.unit };
    delete unit[nome];
    aggiorna({ ...bozza, qty, unit, extra: bozza.extra.filter((x) => x !== nome) }, true);
  }

  function aggiungiExtra() {
    const nome = nuovoNome.trim();
    if (!nome) return;
    const capitalizzato = nome.charAt(0).toUpperCase() + nome.slice(1);
    if (tuttiINomiFV(bozza).some((x) => x.toLowerCase() === capitalizzato.toLowerCase())) {
      mostraToast("Già in lista");
      return;
    }
    setNuovoNome("");
    aggiorna({ ...bozza, extra: [...bozza.extra, capitalizzato] }, true);
  }

  function impostaNote(valore: string) {
    aggiorna({ ...bozza, note: valore }, false);
  }

  function svuota() {
    aggiorna({ ...bozza, qty: {}, note: "" }, true);
    setConfermaSvuota(false);
  }

  async function copia(testo: string) {
    await navigator.clipboard.writeText(testo);
    setCopiato(true);
    setTimeout(() => setCopiato(false), 1500);
  }

  const messaggio = costruisciMessaggioFV(bozza);
  const numeroArticoli = tuttiINomiFV(bozza).filter((n) => (bozza.qty[n] || 0) > 0).length;

  function rigaProps(nome: string, removibile: boolean) {
    const quantita = bozza.qty[nome] || 0;
    return {
      nome,
      quantita,
      unita: bozza.unit[nome] || ("kg" as UnitaFV),
      removibile,
      onDecrementa: () => impostaQuantita(nome, String(Math.max(0, quantita - 1)), true),
      onIncrementa: () => impostaQuantita(nome, String(quantita + 1), true),
      onDigita: (valore: string) => impostaQuantita(nome, valore, false),
      onCambiaUnita: (unita: UnitaFV) => impostaUnita(nome, unita),
      onRimuovi: () => rimuoviExtra(nome),
    };
  }

  return (
    <div className="pb-24">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Verdura</div>
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        {VERDURA_FV.map((n) => (
          <RigaProdottoFV key={n} {...rigaProps(n, false)} />
        ))}
      </div>

      <div className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">Frutta</div>
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        {FRUTTA_FV.map((n) => (
          <RigaProdottoFV key={n} {...rigaProps(n, false)} />
        ))}
      </div>

      {bozza.extra.length > 0 && (
        <>
          <div className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Altri prodotti
          </div>
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            {bozza.extra.map((n) => (
              <RigaProdottoFV key={n} {...rigaProps(n, true)} />
            ))}
          </div>
        </>
      )}

      <div className="mt-3 flex gap-2">
        <input
          value={nuovoNome}
          onChange={(e) => setNuovoNome(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") aggiungiExtra();
          }}
          placeholder="Aggiungi prodotto…"
          className="h-10 flex-1 rounded-lg border border-neutral-300 px-3 text-sm"
        />
        <button
          onClick={aggiungiExtra}
          className="h-10 shrink-0 rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white"
        >
          + Aggiungi
        </button>
      </div>

      <div className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Note (facoltative)
      </div>
      <textarea
        value={bozza.note}
        onChange={(e) => impostaNote(e.target.value)}
        placeholder="es. consegna entro le 10"
        className="min-h-[60px] w-full rounded-lg border border-neutral-300 p-2 text-sm"
      />

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 rounded-full bg-neutral-900 px-4 py-2 text-sm text-white">
          {toast}
        </div>
      )}

      {confermaSvuota && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 p-5">
          <div className="w-full max-w-xs rounded-2xl bg-white p-5 text-center">
            <p className="mb-4 text-sm text-neutral-800">Azzerare tutte le quantità?</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfermaSvuota(false)}
                className="h-10 flex-1 rounded-lg bg-neutral-100 text-sm font-medium text-neutral-800"
              >
                Annulla
              </button>
              <button
                onClick={svuota}
                className="h-10 flex-1 rounded-lg bg-red-600 text-sm font-medium text-white"
              >
                Svuota
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t border-neutral-200 bg-white p-3">
        <div className="mx-auto flex max-w-5xl gap-2">
          <button
            onClick={() => setConfermaSvuota(true)}
            className="h-12 flex-1 rounded-xl bg-neutral-100 text-sm font-semibold text-neutral-800"
          >
            Svuota
          </button>
          <button
            onClick={() => copia(messaggio)}
            disabled={!messaggio}
            className="h-12 flex-1 rounded-xl bg-neutral-100 text-sm font-semibold text-neutral-800 disabled:opacity-40"
          >
            {copiato ? "Copiato ✓" : "Copia"}
          </button>
          <a
            href={messaggio ? linkWhatsAppFV(messaggio) : undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!messaggio}
            className={`flex h-12 flex-[2] items-center justify-center rounded-xl text-sm font-semibold text-white ${
              messaggio ? "bg-emerald-600 hover:bg-emerald-700" : "pointer-events-none bg-neutral-300"
            }`}
          >
            {numeroArticoli > 0 ? `Invia WhatsApp (${numeroArticoli})` : "Invia WhatsApp"}
          </a>
        </div>
      </div>
    </div>
  );
}
