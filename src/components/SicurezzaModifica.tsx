"use client";

// Modulo Sicurezza, passo 5 (15/11/2026): finestre per registrare e
// correggere visite, corsi (anche di gruppo) e dati delle persone.
// Tutte salvano tramite /api/sicurezza/registra e poi ricaricano la pagina.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  aggiungiMesi,
  formattaData,
  type Corso,
  type Formazione,
  type Persona,
  type Visita,
} from "@/lib/sicurezza";

export type Modale =
  | { tipo: "visita"; persona: Persona; visita?: Visita }
  | { tipo: "formazione"; persone: Persona[]; fissa?: Persona; formazione?: Formazione }
  | { tipo: "persona"; persona?: Persona };

const INPUT = "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm";
const ETICHETTA = "mb-1 block text-xs text-neutral-500";

async function invia(corpo: Record<string, unknown>) {
  const r = await fetch("/api/sicurezza/registra", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(corpo),
  });
  const dati = await r.json().catch(() => null);
  if (!r.ok) throw new Error(dati?.errore ?? `Errore ${r.status}`);
  return dati;
}

function Finestra({
  titolo,
  onChiudi,
  children,
}: {
  titolo: string;
  onChiudi: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-xl bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-900">{titolo}</h2>
          <button onClick={onChiudi} className="rounded px-2 py-1 text-neutral-500 hover:bg-neutral-100">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Pulsanti in fondo: Salva, Annulla e (se si modifica) Elimina con conferma.
function Pulsanti({
  inCorso,
  errore,
  onSalva,
  onChiudi,
  onElimina,
}: {
  inCorso: boolean;
  errore: string | null;
  onSalva: () => void;
  onChiudi: () => void;
  onElimina?: () => void;
}) {
  const [conferma, setConferma] = useState(false);
  return (
    <div className="mt-4">
      {errore && <p className="mb-2 rounded bg-red-50 p-2 text-sm text-red-700">{errore}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onSalva}
          disabled={inCorso}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700 disabled:opacity-60"
        >
          {inCorso ? "Salvataggio…" : "Salva"}
        </button>
        <button onClick={onChiudi} className="rounded-md px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100">
          Annulla
        </button>
        {onElimina && (
          <span className="ml-auto">
            {conferma ? (
              <span className="flex items-center gap-2 text-sm">
                <span className="text-red-700">Eliminare davvero?</span>
                <button
                  onClick={onElimina}
                  disabled={inCorso}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-white hover:bg-red-700"
                >
                  Sì, elimina
                </button>
                <button onClick={() => setConferma(false)} className="px-2 py-1.5 text-neutral-600">
                  No
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConferma(true)}
                className="rounded-md px-3 py-2 text-sm text-red-700 hover:bg-red-50"
              >
                🗑 Elimina
              </button>
            )}
          </span>
        )}
      </div>
    </div>
  );
}

function useSalvataggio(onChiudi: () => void) {
  const router = useRouter();
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  async function esegui(corpo: Record<string, unknown>) {
    setInCorso(true);
    setErrore(null);
    try {
      await invia(corpo);
      router.refresh();
      onChiudi();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Errore nel salvataggio");
    } finally {
      setInCorso(false);
    }
  }
  return { inCorso, errore, esegui };
}

// ------------------------------------------------------------------ VISITA

function ModuloVisita({ persona, visita, onChiudi }: { persona: Persona; visita?: Visita; onChiudi: () => void }) {
  const { inCorso, errore, esegui } = useSalvataggio(onChiudi);
  const [tipo, setTipo] = useState(visita?.tipo ?? "periodica");
  const [dataVisita, setDataVisita] = useState(visita?.data_visita ?? "");
  const [giudizio, setGiudizio] = useState(visita?.giudizio ?? "idoneo");
  const [prossima, setProssima] = useState(visita?.prossima_scadenza ?? "");
  const [prossimaToccata, setProssimaToccata] = useState(Boolean(visita));
  const [note, setNote] = useState(visita?.note ?? "");

  // Proposta: un anno dopo la visita. Il medico competente può indicare
  // un'altra periodicità: in quel caso si corregge a mano.
  function cambiaData(v: string) {
    setDataVisita(v);
    if (!prossimaToccata && v) setProssima(aggiungiMesi(v, 12));
  }

  return (
    <Finestra
      titolo={`${visita ? "Modifica visita" : "Registra visita medica"} · ${persona.cognome} ${persona.nome}`}
      onChiudi={onChiudi}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className={ETICHETTA}>Data visita</span>
          <input type="date" value={dataVisita} onChange={(e) => cambiaData(e.target.value)} className={INPUT} />
        </label>
        <label>
          <span className={ETICHETTA}>Tipo</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={INPUT}>
            <option value="preventiva">Preventiva (nuovo assunto)</option>
            <option value="periodica">Periodica</option>
            <option value="su_richiesta">Su richiesta del lavoratore</option>
            <option value="rientro">Rientro dopo assenza</option>
          </select>
        </label>
        <label>
          <span className={ETICHETTA}>Giudizio</span>
          <select value={giudizio} onChange={(e) => setGiudizio(e.target.value)} className={INPUT}>
            <option value="idoneo">Idoneo</option>
            <option value="idoneo_con_prescrizioni">Idoneo con prescrizioni</option>
            <option value="non_idoneo_temporaneo">Non idoneo temporaneo</option>
            <option value="non_idoneo_permanente">Non idoneo permanente</option>
          </select>
        </label>
        <label>
          <span className={ETICHETTA}>Prossima visita entro</span>
          <input
            type="date"
            value={prossima}
            onChange={(e) => {
              setProssima(e.target.value);
              setProssimaToccata(true);
            }}
            className={INPUT}
          />
        </label>
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        Proposta a un anno: correggila se il medico ha indicato una scadenza diversa. Non inserire dati sanitari.
      </p>
      <label className="mt-3 block">
        <span className={ETICHETTA}>Note (facoltative)</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} className={INPUT} />
      </label>
      <Pulsanti
        inCorso={inCorso}
        errore={errore}
        onChiudi={onChiudi}
        onSalva={() =>
          esegui({
            azione: "salva_visita",
            id: visita?.id,
            persona_id: persona.id,
            tipo,
            data_visita: dataVisita,
            giudizio,
            prossima_scadenza: prossima,
            note,
          })
        }
        onElimina={visita ? () => esegui({ azione: "elimina_visita", id: visita.id }) : undefined}
      />
    </Finestra>
  );
}

// ------------------------------------------------------------------ CORSO

function useAttestati() {
  const [file, setFile] = useState<string[]>([]);
  const [errore, setErrore] = useState<string | null>(null);
  useEffect(() => {
    let annullato = false;
    fetch("/api/sicurezza/attestati")
      .then((r) => r.json())
      .then((d) => {
        if (annullato) return;
        if (d?.file) setFile(d.file);
        else setErrore(d?.errore ?? "Elenco attestati non disponibile");
      })
      .catch(() => !annullato && setErrore("Elenco attestati non disponibile"));
    return () => {
      annullato = true;
    };
  }, []);
  return { file, errore };
}

function ModuloFormazione({
  persone,
  fissa,
  formazione,
  corsi,
  onChiudi,
}: {
  persone: Persona[];
  fissa?: Persona;
  formazione?: Formazione;
  corsi: Corso[];
  onChiudi: () => void;
}) {
  const { inCorso, errore, esegui } = useSalvataggio(onChiudi);
  const attestati = useAttestati();
  const corsiAttivi = useMemo(() => [...corsi].filter((c) => c.attivo).sort((a, b) => a.ordine - b.ordine), [corsi]);

  const [corsoId, setCorsoId] = useState(formazione?.corso_id ?? corsiAttivi[0]?.id ?? "");
  const [scelte, setScelte] = useState<Set<string>>(new Set(fissa ? [fissa.id] : []));
  const [stato, setStato] = useState<"completato" | "in_corso">(formazione?.stato ?? "completato");
  const [dataCorso, setDataCorso] = useState(formazione?.data_corso ?? "");
  const [ore, setOre] = useState(formazione?.ore != null ? String(formazione.ore) : "");
  const [ente, setEnte] = useState(formazione?.ente ?? "");
  const [attestato, setAttestato] = useState(formazione?.attestato_path ?? "");
  const [scadenza, setScadenza] = useState(formazione?.scadenza ?? "");
  const [note, setNote] = useState(formazione?.note ?? "");

  const corso = corsiAttivi.find((c) => c.id === corsoId) ?? corsi.find((c) => c.id === corsoId);
  const scadenzaCalcolata =
    corso?.validita_mesi && dataCorso ? aggiungiMesi(dataCorso, corso.validita_mesi) : null;
  const diGruppo = !fissa && !formazione;

  function alterna(id: string) {
    const n = new Set(scelte);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setScelte(n);
  }

  const titolo = formazione
    ? `Modifica corso · ${fissa?.cognome ?? ""} ${fissa?.nome ?? ""}`
    : fissa
      ? `Registra corso · ${fissa.cognome} ${fissa.nome}`
      : "Registra corso di gruppo";

  return (
    <Finestra titolo={titolo} onChiudi={onChiudi}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className={ETICHETTA}>Corso</span>
          <select value={corsoId} onChange={(e) => setCorsoId(e.target.value)} className={INPUT}>
            {corsiAttivi.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
                {c.validita_mesi ? ` (vale ${c.validita_mesi / 12} anni)` : " (non scade)"}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={ETICHETTA}>Stato</span>
          <select
            value={stato}
            onChange={(e) => setStato(e.target.value as "completato" | "in_corso")}
            className={INPUT}
          >
            <option value="completato">Completato</option>
            <option value="in_corso">In corso (iniziato, non finito)</option>
          </select>
        </label>
        <label>
          <span className={ETICHETTA}>Data del corso {stato === "completato" ? "(fine)" : "(facoltativa)"}</span>
          <input type="date" value={dataCorso} onChange={(e) => setDataCorso(e.target.value)} className={INPUT} />
        </label>
        <label>
          <span className={ETICHETTA}>Ore</span>
          <input inputMode="decimal" value={ore} onChange={(e) => setOre(e.target.value)} className={INPUT} />
        </label>
        <label>
          <span className={ETICHETTA}>Ente / formatore</span>
          <input value={ente} onChange={(e) => setEnte(e.target.value)} className={INPUT} />
        </label>
        <label className="sm:col-span-2">
          <span className={ETICHETTA}>Attestato su Dropbox (cartella Sicurezza)</span>
          <input
            list="sic-attestati"
            value={attestato}
            onChange={(e) => setAttestato(e.target.value)}
            placeholder="Scrivi parte del nome per cercarlo…"
            className={INPUT}
          />
          <datalist id="sic-attestati">
            {attestati.file.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
          {attestati.errore && <span className="text-xs text-amber-800">{attestati.errore}</span>}
        </label>
        <label className="sm:col-span-2">
          <span className={ETICHETTA}>
            Scadenza{" "}
            {scadenzaCalcolata
              ? `(lascia vuoto: calcolata ${formattaData(scadenzaCalcolata)})`
              : "(lascia vuoto se non scade)"}
          </span>
          <input type="date" value={scadenza} onChange={(e) => setScadenza(e.target.value)} className={INPUT} />
        </label>
        <label className="sm:col-span-2">
          <span className={ETICHETTA}>Note (facoltative)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} className={INPUT} />
        </label>
      </div>

      {diGruppo && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between">
            <span className={ETICHETTA}>Chi ha partecipato ({scelte.size})</span>
            <span className="flex gap-2 text-xs">
              <button onClick={() => setScelte(new Set(persone.map((p) => p.id)))} className="text-blue-700 underline">
                tutti
              </button>
              <button onClick={() => setScelte(new Set())} className="text-blue-700 underline">
                nessuno
              </button>
            </span>
          </div>
          <div className="grid max-h-56 grid-cols-1 gap-1 overflow-y-auto rounded-md border border-neutral-200 p-2 sm:grid-cols-2">
            {persone.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={scelte.has(p.id)} onChange={() => alterna(p.id)} />
                {p.cognome} {p.nome}
              </label>
            ))}
          </div>
        </div>
      )}

      <Pulsanti
        inCorso={inCorso}
        errore={errore}
        onChiudi={onChiudi}
        onSalva={() =>
          esegui({
            azione: "salva_formazione",
            id: formazione?.id,
            persona_ids: [...scelte],
            corso_id: corsoId,
            stato,
            data_corso: dataCorso,
            ore,
            ente,
            attestato_path: attestato,
            scadenza,
            note,
          })
        }
        onElimina={formazione ? () => esegui({ azione: "elimina_formazione", id: formazione.id }) : undefined}
      />
    </Finestra>
  );
}

// ------------------------------------------------------------------ PERSONA

function ModuloPersona({ persona, onChiudi }: { persona?: Persona; onChiudi: () => void }) {
  const { inCorso, errore, esegui } = useSalvataggio(onChiudi);
  const [f, setF] = useState({
    tipo: persona?.tipo ?? "dipendente",
    cognome: persona?.cognome ?? "",
    nome: persona?.nome ?? "",
    codice_busta: persona?.codice_busta ?? "",
    mansione: persona?.mansione ?? "",
    data_assunzione: persona?.data_assunzione ?? "",
    fine_contratto: persona?.fine_contratto ?? "",
    data_cessazione: persona?.data_cessazione ?? "",
    datore_lavoro: persona?.datore_lavoro ?? false,
    addetto_antincendio: persona?.addetto_antincendio ?? false,
    addetto_primo_soccorso: persona?.addetto_primo_soccorso ?? false,
    rls: persona?.rls ?? false,
    contratto_dropbox: persona?.contratto_dropbox ?? "",
    note: persona?.note ?? "",
  });
  const campo = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value });
  const spunta = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.checked });

  return (
    <Finestra
      titolo={persona ? `Dati di ${persona.cognome} ${persona.nome}` : "Nuovo assunto"}
      onChiudi={onChiudi}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className={ETICHETTA}>Cognome</span>
          <input value={f.cognome} onChange={campo("cognome")} className={INPUT} />
        </label>
        <label>
          <span className={ETICHETTA}>Nome</span>
          <input value={f.nome} onChange={campo("nome")} className={INPUT} />
        </label>
        <label>
          <span className={ETICHETTA}>Data assunzione</span>
          <input type="date" value={f.data_assunzione} onChange={campo("data_assunzione")} className={INPUT} />
        </label>
        <label>
          <span className={ETICHETTA}>Fine contratto (se a termine)</span>
          <input type="date" value={f.fine_contratto} onChange={campo("fine_contratto")} className={INPUT} />
        </label>
        <label>
          <span className={ETICHETTA}>Mansione</span>
          <input value={f.mansione} onChange={campo("mansione")} className={INPUT} />
        </label>
        <label>
          <span className={ETICHETTA}>Codice busta paga (se lo sai)</span>
          <input
            value={f.codice_busta}
            onChange={campo("codice_busta")}
            placeholder="es. 00069"
            inputMode="numeric"
            className={INPUT}
          />
        </label>
        <label>
          <span className={ETICHETTA}>Tipo</span>
          <select value={f.tipo} onChange={campo("tipo")} className={INPUT}>
            <option value="dipendente">Dipendente</option>
            <option value="socio_titolare">Socio / titolare</option>
          </select>
        </label>
        {persona && (
          <label>
            <span className={ETICHETTA}>Data cessazione (va in archivio)</span>
            <input type="date" value={f.data_cessazione} onChange={campo("data_cessazione")} className={INPUT} />
          </label>
        )}
        <label className="sm:col-span-2">
          <span className={ETICHETTA}>Contratto su Dropbox (percorso, facoltativo)</span>
          <input value={f.contratto_dropbox} onChange={campo("contratto_dropbox")} className={INPUT} />
        </label>
      </div>

      <div className="mt-3">
        <span className={ETICHETTA}>Incarichi (decidono quali corsi servono)</span>
        <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={f.addetto_antincendio} onChange={spunta("addetto_antincendio")} />
            Addetto antincendio
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={f.addetto_primo_soccorso} onChange={spunta("addetto_primo_soccorso")} />
            Addetto primo soccorso
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={f.rls} onChange={spunta("rls")} />
            RLS
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={f.datore_lavoro} onChange={spunta("datore_lavoro")} />
            Datore di lavoro
          </label>
        </div>
      </div>

      <label className="mt-3 block">
        <span className={ETICHETTA}>Note (facoltative)</span>
        <input value={f.note} onChange={campo("note")} className={INPUT} />
      </label>

      {!persona && (
        <p className="mt-2 text-xs text-neutral-500">
          Quando arriverà la sua prima busta paga verrà riconosciuto e completato in automatico.
        </p>
      )}

      <Pulsanti
        inCorso={inCorso}
        errore={errore}
        onChiudi={onChiudi}
        onSalva={() => esegui({ azione: "salva_persona", id: persona?.id, ...f })}
      />
    </Finestra>
  );
}

// ------------------------------------------------------------------ INGRESSO

export function FinestraModifica({
  modale,
  corsi,
  onChiudi,
}: {
  modale: Modale;
  corsi: Corso[];
  onChiudi: () => void;
}) {
  if (modale.tipo === "visita") return <ModuloVisita persona={modale.persona} visita={modale.visita} onChiudi={onChiudi} />;
  if (modale.tipo === "persona") return <ModuloPersona persona={modale.persona} onChiudi={onChiudi} />;
  return (
    <ModuloFormazione
      persone={modale.persone}
      fissa={modale.fissa}
      formazione={modale.formazione}
      corsi={corsi}
      onChiudi={onChiudi}
    />
  );
}
