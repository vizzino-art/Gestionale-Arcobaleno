"use client";

import { Fragment, useMemo, useState } from "react";
import {
  GRUPPI,
  calcolaScadenzario,
  colore,
  contaPerGruppo,
  formattaData,
  linkDropbox,
  type Corso,
  type Esito,
  type Formazione,
  type GruppoId,
  type Persona,
  type Stato,
  type Visita,
} from "@/lib/sicurezza";

type Props = {
  persone: Persona[];
  corsi: Corso[];
  formazioni: Formazione[];
  visite: Visita[];
  oggi: string;
};

const CLASSI: Record<ReturnType<typeof colore>, string> = {
  rosso: "bg-red-50 text-red-700 ring-red-200",
  giallo: "bg-amber-50 text-amber-800 ring-amber-200",
  grigio: "bg-neutral-100 text-neutral-600 ring-neutral-200",
  verde: "bg-green-50 text-green-700 ring-green-200",
};

function testoStato(e: Esito): string {
  const d = formattaData(e.data);
  const testi: Record<Stato, string> = {
    scaduto: `scaduto ${d}`,
    mancante: "mancante",
    in_scadenza: `scade ${d}`,
    da_fare: `entro ${d}`,
    in_corso: "in corso",
    ok: e.data ? d : "valido",
  };
  return testi[e.stato];
}

function Pillola({ e, conNome }: { e: Esito; conNome: boolean }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs ring-1 ring-inset ${CLASSI[colore(e.stato)]}`}
    >
      {conNome ? `${e.etichetta}: ` : ""}
      {testoStato(e)}
    </span>
  );
}

// Una cella: se il gruppo ha più adempimenti mostra solo quelli non verdi
// (col nome breve), altrimenti un'unica pillola riassuntiva.
function Cella({ esiti }: { esiti: Esito[] }) {
  if (esiti.length === 0) return <span className="text-xs text-neutral-400">—</span>;
  const problemi = esiti.filter((e) => e.stato !== "ok");
  if (problemi.length === 0) {
    // Tutto valido: mostra la scadenza più vicina.
    const prossima = [...esiti].filter((e) => e.data).sort((a, b) => (a.data! < b.data! ? -1 : 1))[0];
    return <Pillola e={prossima ?? esiti[0]} conNome={false} />;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {problemi.map((e) => (
        <Pillola key={e.chiave} e={e} conNome={esiti.length > 1} />
      ))}
    </div>
  );
}

export function SicurezzaClient({ persone, corsi, formazioni, visite, oggi }: Props) {
  const [ricerca, setRicerca] = useState("");
  const [filtroGruppo, setFiltroGruppo] = useState<GruppoId | null>(null);
  const [soloProblemi, setSoloProblemi] = useState(false);
  const [mostraCessati, setMostraCessati] = useState(false);
  const [aperta, setAperta] = useState<string | null>(null);

  const attive = useMemo(() => persone.filter((p) => !p.data_cessazione), [persone]);
  const cessate = useMemo(() => persone.filter((p) => p.data_cessazione), [persone]);

  const righe = useMemo(
    () => calcolaScadenzario(attive, corsi, formazioni, visite, oggi),
    [attive, corsi, formazioni, visite, oggi]
  );
  const contatori = useMemo(() => contaPerGruppo(righe), [righe]);

  const righeVisibili = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    return righe.filter((r) => {
      const nome = `${r.persona.cognome} ${r.persona.nome}`.toLowerCase();
      if (q && !nome.includes(q)) return false;
      const esiti = filtroGruppo ? r.esiti.filter((e) => e.gruppo === filtroGruppo) : r.esiti;
      if (filtroGruppo && !esiti.some((e) => colore(e.stato) === "rosso" || colore(e.stato) === "giallo"))
        return false;
      if (soloProblemi && !esiti.some((e) => colore(e.stato) === "rosso")) return false;
      return true;
    });
  }, [righe, ricerca, filtroGruppo, soloProblemi]);

  const nomeCorso = (id: string) => corsi.find((c) => c.id === id)?.nome ?? id;

  return (
    <div>
      {/* Contatori per adempimento: cliccando si filtra la tabella */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {contatori.map((c) => {
          const attivo = filtroGruppo === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setFiltroGruppo(attivo ? null : c.id)}
              className={`rounded-lg border p-3 text-left ${
                attivo ? "border-neutral-900 bg-white" : "border-neutral-200 bg-white hover:bg-neutral-50"
              }`}
            >
              <p className="text-xs text-neutral-500">{c.label}</p>
              <p className="mt-1 text-sm">
                <span className="text-xl font-semibold text-red-700">{c.rossi}</span>
                <span className="text-neutral-500"> scaduti o mancanti</span>
              </p>
              <p className="text-xs text-amber-800">{c.gialli} in scadenza / da fare</p>
            </button>
          );
        })}
      </div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          value={ricerca}
          onChange={(e) => setRicerca(e.target.value)}
          placeholder="🔍 Cerca persona…"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm sm:max-w-xs"
        />
        <label className="flex items-center gap-2 text-sm text-neutral-600">
          <input type="checkbox" checked={soloProblemi} onChange={(e) => setSoloProblemi(e.target.checked)} />
          Solo scaduti / mancanti
        </label>
        {filtroGruppo && (
          <button
            onClick={() => setFiltroGruppo(null)}
            className="rounded-md bg-neutral-100 px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-200"
          >
            ✕ Filtro: {GRUPPI.find((g) => g.id === filtroGruppo)?.label}
          </button>
        )}
      </div>

      <p className="mb-2 text-xs text-neutral-400">
        {righeVisibili.length} di {righe.length} persone in forza · aggiornato al {formattaData(oggi)}
      </p>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
              <th className="px-3 py-2 font-normal">Persona</th>
              {GRUPPI.map((g) => (
                <th key={g.id} className="px-3 py-2 font-normal">
                  {g.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {righeVisibili.map((r) => {
              const p = r.persona;
              const isAperta = aperta === p.id;
              return (
                <Fragment key={p.id}>
                  <tr
                    onClick={() => setAperta(isAperta ? null : p.id)}
                    className="cursor-pointer align-top hover:bg-neutral-50"
                  >
                    <td className="px-3 py-2">
                      <p className="font-medium text-neutral-900">
                        {p.cognome} {p.nome}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {p.mansione}
                        {p.fine_contratto ? ` · contratto fino al ${formattaData(p.fine_contratto)}` : ""}
                      </p>
                    </td>
                    {GRUPPI.map((g) => (
                      <td key={g.id} className="px-3 py-2">
                        <Cella esiti={r.esiti.filter((e) => e.gruppo === g.id)} />
                      </td>
                    ))}
                  </tr>
                  {isAperta && (
                    <tr className="bg-neutral-50">
                      <td colSpan={GRUPPI.length + 1} className="px-3 py-3">
                        <SchedaPersona
                          persona={p}
                          formazioni={formazioni.filter((f) => f.persona_id === p.id)}
                          visite={visite.filter((v) => v.persona_id === p.id)}
                          nomeCorso={nomeCorso}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-xs text-neutral-500">
        <span>🔴 scaduto o mancante</span>
        <span>🟡 scade entro 3 mesi / da fare entro il termine</span>
        <span>⚪ in corso</span>
        <span>🟢 valido</span>
      </div>

      {/* Archivio cessati: solo consultazione */}
      <div className="mt-6">
        <button
          onClick={() => setMostraCessati(!mostraCessati)}
          className="text-sm text-neutral-600 underline hover:text-neutral-900"
        >
          {mostraCessati ? "Nascondi" : "Mostra"} archivio cessati ({cessate.length})
        </button>
        {mostraCessati && (
          <div className="mt-2 divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
            {cessate.map((p) => (
              <div key={p.id} className="px-4 py-3">
                <button className="text-left" onClick={() => setAperta(aperta === p.id ? null : p.id)}>
                  <p className="font-medium text-neutral-900">
                    {p.cognome} {p.nome}
                  </p>
                  <p className="text-xs text-neutral-500">
                    Cessato il {formattaData(p.data_cessazione)} · conservare fino al{" "}
                    {formattaData(p.conservare_fino_al)}
                  </p>
                </button>
                {aperta === p.id && (
                  <div className="mt-2">
                    <SchedaPersona
                      persona={p}
                      formazioni={formazioni.filter((f) => f.persona_id === p.id)}
                      visite={visite.filter((v) => v.persona_id === p.id)}
                      nomeCorso={nomeCorso}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SchedaPersona({
  persona,
  formazioni,
  visite,
  nomeCorso,
}: {
  persona: Persona;
  formazioni: Formazione[];
  visite: Visita[];
  nomeCorso: (id: string) => string;
}) {
  const corsiOrdinati = [...formazioni].sort((a, b) => ((b.data_corso ?? "") > (a.data_corso ?? "") ? 1 : -1));
  const visiteOrdinate = [...visite].sort((a, b) => (b.data_visita > a.data_visita ? 1 : -1));
  return (
    <div className="grid gap-4 text-sm sm:grid-cols-2">
      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">Corsi</p>
        {corsiOrdinati.length === 0 && <p className="text-neutral-500">Nessun corso registrato.</p>}
        <ul className="space-y-1.5">
          {corsiOrdinati.map((f) => (
            <li key={f.id}>
              <span className="text-neutral-900">{nomeCorso(f.corso_id)}</span>
              <span className="text-neutral-500">
                {" "}
                · {f.stato === "in_corso" ? "in corso" : formattaData(f.data_corso)}
                {f.scadenza ? ` → scade ${formattaData(f.scadenza)}` : ""}
                {f.ore ? ` · ${f.ore} ore` : ""}
                {f.ente ? ` · ${f.ente}` : ""}
              </span>
              {f.attestato_path && (
                <a
                  href={linkDropbox(f.attestato_path)}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-2 text-blue-700 underline"
                >
                  📄 attestato
                </a>
              )}
              {f.note && <p className="text-xs text-neutral-500">{f.note}</p>}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">Visite mediche</p>
        {visiteOrdinate.length === 0 && <p className="text-neutral-500">Nessuna visita registrata.</p>}
        <ul className="space-y-1.5">
          {visiteOrdinate.map((v) => (
            <li key={v.id}>
              <span className="text-neutral-900">{formattaData(v.data_visita)}</span>
              <span className="text-neutral-500">
                {" "}
                · {v.tipo}
                {v.prossima_scadenza ? ` → prossima ${formattaData(v.prossima_scadenza)}` : ""}
                {v.giudizio ? ` · ${v.giudizio.replaceAll("_", " ")}` : ""}
              </span>
            </li>
          ))}
        </ul>
        {(persona.data_assunzione || persona.note) && (
          <p className="mt-3 text-xs text-neutral-500">
            {persona.data_assunzione ? `Assunto il ${formattaData(persona.data_assunzione)}. ` : ""}
            {persona.note ?? ""}
          </p>
        )}
      </div>
    </div>
  );
}
