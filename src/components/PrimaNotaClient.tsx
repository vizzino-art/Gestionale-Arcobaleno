"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Conto, Controparte, MovimentoPrimaNota, SaldoConto } from "@/lib/types";

type Props = {
  conti: Conto[];
  movimentiIniziali: MovimentoPrimaNota[];
  saldiIniziali: SaldoConto[];
  daConfermareIniziali: MovimentoPrimaNota[];
  // Fase 2 (23/9): nomi dell'anagrafica controparti, solo per suggerirli nel
  // campo causale — vedi CAUSALI_SUGGERITE più sotto.
  contropartiIniziali: Controparte[];
};

// Causali ricorrenti viste nel vecchio file Excel: suggerite nel campo
// causale (datalist) così non vanno riscritte ogni volta, ma resta comunque
// un campo libero — non è una lista chiusa.
const CAUSALI_SUGGERITE = ["Incasso del Giorno", "Versamento Contante", "Prelievo Contanti"];

function formattaEuro(v: number): string {
  return v.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

function formattaData(v: string): string {
  const [anno, mese, giorno] = v.split("-");
  if (!anno || !mese || !giorno) return v;
  return `${giorno}/${mese}/${anno}`;
}

function oggiIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function meseCorrenteIso(): string {
  return new Date().toISOString().slice(0, 7); // "YYYY-MM"
}

// Ultimo giorno del mese "YYYY-MM" (gestisce anche i mesi da 28/30/31 giorni).
function ultimoGiornoMese(meseIso: string): string {
  const [anno, mese] = meseIso.split("-").map(Number);
  const ultimo = new Date(anno, mese, 0).getDate();
  return `${meseIso}-${String(ultimo).padStart(2, "0")}`;
}

// Più recenti prima; a parità di data, l'ultimo inserito prima.
function comparaMovimenti(a: MovimentoPrimaNota, b: MovimentoPrimaNota): number {
  if (a.data !== b.data) return a.data < b.data ? 1 : -1;
  return a.created_at < b.created_at ? 1 : -1;
}

export function PrimaNotaClient({
  conti,
  movimentiIniziali,
  saldiIniziali,
  daConfermareIniziali,
  contropartiIniziali,
}: Props) {
  const primoContoId = conti[0]?.id ?? "";

  // Suggerimenti per il campo causale: le causali ricorrenti fisse più i
  // nomi delle controparti (Fase 2), senza doppioni se un nome coincidesse
  // con una causale già in elenco.
  const suggerimentiCausale = [
    ...CAUSALI_SUGGERITE,
    ...contropartiIniziali
      .map((c) => c.nome)
      .filter((nome) => !CAUSALI_SUGGERITE.includes(nome)),
  ];

  const [movimenti, setMovimenti] = useState<MovimentoPrimaNota[]>(
    [...movimentiIniziali].sort(comparaMovimenti)
  );
  const [saldi, setSaldi] = useState<SaldoConto[]>(saldiIniziali);
  const [daConfermare, setDaConfermare] = useState<MovimentoPrimaNota[]>(daConfermareIniziali);
  const [confermandoId, setConfermandoId] = useState<string | null>(null);
  const [erroreConferma, setErroreConferma] = useState<Record<string, string>>({});

  // --- Form di inserimento rapido ---------------------------------------
  const [data, setData] = useState(oggiIso());
  const [causale, setCausale] = useState("");
  const [contoId, setContoId] = useState(primoContoId);
  const [tipo, setTipo] = useState<"entrata" | "uscita">("uscita");
  const [importo, setImporto] = useState("");
  const [stato, setStato] = useState<"effettivo" | "pianificato">("effettivo");
  const [trasferimento, setTrasferimento] = useState(false);
  const [contoDestinazioneId, setContoDestinazioneId] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erroreForm, setErroreForm] = useState<string | null>(null);

  const contiPerId = new Map(conti.map((c) => [c.id, c]));

  // --- Carta di credito: totale del solo mese scelto, non il saldo di
  // sempre --------------------------------------------------------------
  // Richiesto da Mauro il 22/9: il saldo "di sempre" della Carta di
  // credito non gli è utile (è un numero enorme perché somma tutti i
  // movimenti mai registrati, senza un "pagamento" che li azzeri come
  // succede per un vero saldo di conto) — vuole invece poter scegliere un
  // mese e vedere solo quanto è stato speso/pagato in quel mese (opzione
  // "A" che ha confermato lui stesso). Per ora solo su questo conto: gli
  // altri restano il saldo attuale come prima.
  const contoCartaCreditoId = conti.find((c) => c.nome === "Carta di credito")?.id;
  const [meseCartaCredito, setMeseCartaCredito] = useState(meseCorrenteIso());
  const [totaleMeseCarta, setTotaleMeseCarta] = useState<number | null>(null);
  const [caricandoTotaleCarta, setCaricandoTotaleCarta] = useState(false);

  async function caricaTotaleMeseCarta(meseIso: string) {
    if (!contoCartaCreditoId) return;
    setCaricandoTotaleCarta(true);
    try {
      const supabase = createClient();
      const { data: righe, error } = await supabase
        .from("movimenti_prima_nota")
        .select("importo")
        .eq("conto_id", contoCartaCreditoId)
        .eq("stato", "effettivo")
        .gte("data", `${meseIso}-01`)
        .lte("data", ultimoGiornoMese(meseIso));
      if (!error && righe) {
        setTotaleMeseCarta(righe.reduce((acc, r) => acc + Number(r.importo), 0));
      }
    } finally {
      setCaricandoTotaleCarta(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      caricaTotaleMeseCarta(meseCorrenteIso());
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- va eseguito solo al primo caricamento della pagina, i cambi di mese successivi li innesca già l'onChange della tendina
  }, []);

  function applicaDelta(righe: MovimentoPrimaNota[], segno: 1 | -1) {
    setSaldi((prec) =>
      prec.map((s) => {
        const tocca = righe.filter((r) => r.conto_id === s.conto_id);
        if (tocca.length === 0) return s;
        const deltaPrevisto = segno * tocca.reduce((acc, r) => acc + r.importo, 0);
        const deltaAttuale =
          segno * tocca.filter((r) => r.stato === "effettivo").reduce((acc, r) => acc + r.importo, 0);
        return {
          ...s,
          saldo_attuale: s.saldo_attuale + deltaAttuale,
          saldo_previsto: s.saldo_previsto + deltaPrevisto,
        };
      })
    );
  }

  async function salvaMovimento(e: React.FormEvent) {
    e.preventDefault();
    setErroreForm(null);

    const valore = parseFloat(importo.replace(",", "."));
    if (!causale.trim()) {
      setErroreForm("Inserisci una causale.");
      return;
    }
    if (!valore || valore <= 0) {
      setErroreForm("Inserisci un importo maggiore di zero.");
      return;
    }
    if (trasferimento && (!contoDestinazioneId || contoDestinazioneId === contoId)) {
      setErroreForm("Scegli un conto di arrivo diverso dal conto di partenza.");
      return;
    }

    setSalvando(true);
    try {
      const supabase = createClient();

      if (trasferimento) {
        const trasferimentoId = crypto.randomUUID();
        const { data: inserite, error } = await supabase
          .from("movimenti_prima_nota")
          .insert([
            { data, causale: causale.trim(), conto_id: contoId, importo: -valore, stato, trasferimento_id: trasferimentoId },
            { data, causale: causale.trim(), conto_id: contoDestinazioneId, importo: valore, stato, trasferimento_id: trasferimentoId },
          ])
          .select("*");
        if (error) {
          setErroreForm(error.message);
          return;
        }
        const righe = inserite as MovimentoPrimaNota[];
        setMovimenti((prec) => [...righe, ...prec].sort(comparaMovimenti));
        applicaDelta(righe, 1);
      } else {
        const importoConSegno = tipo === "uscita" ? -valore : valore;
        const { data: inserito, error } = await supabase
          .from("movimenti_prima_nota")
          .insert({ data, causale: causale.trim(), conto_id: contoId, importo: importoConSegno, stato })
          .select("*")
          .single();
        if (error) {
          setErroreForm(error.message);
          return;
        }
        const riga = inserito as MovimentoPrimaNota;
        setMovimenti((prec) => [riga, ...prec].sort(comparaMovimenti));
        applicaDelta([riga], 1);
      }

      // Resetta solo causale e importo: data/conto/stato restano com'erano,
      // così inserire più movimenti di fila è più veloce.
      setCausale("");
      setImporto("");
    } finally {
      setSalvando(false);
    }
  }

  // --- Elenco / filtri -----------------------------------------------------
  const [filtroContoId, setFiltroContoId] = useState("");
  const [filtroStato, setFiltroStato] = useState("");
  const [caricandoLista, setCaricandoLista] = useState(false);
  const [erroreEliminazione, setErroreEliminazione] = useState<Record<string, string>>({});
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);

  async function ricaricaMovimenti(nuovoContoId: string, nuovoStato: string) {
    setCaricandoLista(true);
    try {
      const supabase = createClient();
      let query = supabase
        .from("movimenti_prima_nota")
        .select("*")
        .order("data", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);
      if (nuovoContoId) query = query.eq("conto_id", nuovoContoId);
      if (nuovoStato) query = query.eq("stato", nuovoStato);
      const { data: righe, error } = await query;
      if (!error) setMovimenti((righe ?? []) as MovimentoPrimaNota[]);
    } finally {
      setCaricandoLista(false);
    }
  }

  async function eliminaMovimento(m: MovimentoPrimaNota) {
    const collegati = m.trasferimento_id
      ? movimenti.filter((x) => x.trasferimento_id === m.trasferimento_id)
      : [m];
    const conferma = window.confirm(
      collegati.length > 1
        ? "Eliminare questo trasferimento? Verranno eliminate entrambe le righe collegate."
        : "Eliminare questo movimento?"
    );
    if (!conferma) return;

    setEliminandoId(m.id);
    setErroreEliminazione((prec) => ({ ...prec, [m.id]: "" }));
    try {
      const supabase = createClient();
      const ids = collegati.map((c) => c.id);
      const { error } = await supabase.from("movimenti_prima_nota").delete().in("id", ids);
      if (error) {
        setErroreEliminazione((prec) => ({ ...prec, [m.id]: error.message }));
        return;
      }
      setMovimenti((prec) => prec.filter((x) => !ids.includes(x.id)));
      applicaDelta(collegati, -1);
    } finally {
      setEliminandoId(null);
    }
  }

  // --- Importazione incassi giornalieri dal foglio Google (punto 23, 18/9) -
  const [importandoIncassi, setImportandoIncassi] = useState(false);
  const [risultatoImportazione, setRisultatoImportazione] = useState<string | null>(null);
  const [erroreImportazione, setErroreImportazione] = useState<string | null>(null);

  async function ricaricaSaldi() {
    const supabase = createClient();
    const { data } = await supabase.from("v_saldi_conti").select("*");
    if (data) setSaldi(data as SaldoConto[]);
  }

  async function importaIncassi() {
    setImportandoIncassi(true);
    setErroreImportazione(null);
    setRisultatoImportazione(null);
    try {
      const risposta = await fetch("/api/importa-incassi", { method: "POST" });
      const corpo = await risposta.json();
      if (!risposta.ok && risposta.status !== 207) {
        setErroreImportazione(corpo.errore ?? "Errore sconosciuto durante l'importazione.");
        return;
      }
      const schedeConErrore = (corpo.risultati as { scheda: string; movimenti: number; errore?: string }[]).filter(
        (r) => r.errore
      );
      setRisultatoImportazione(
        `${corpo.totaleMovimenti} movimenti creati/aggiornati.` +
          (schedeConErrore.length > 0
            ? ` Problemi su: ${schedeConErrore.map((r) => `${r.scheda} (${r.errore})`).join(", ")}`
            : "")
      );
      // I movimenti creati dall'import potrebbero non rientrare nei filtri
      // correnti (data vecchia, conto diverso): ricarichiamo lista e saldi
      // così quello che si vede è sempre coerente con quanto appena scritto.
      await Promise.all([ricaricaMovimenti(filtroContoId, filtroStato), ricaricaSaldi()]);
    } catch (e) {
      setErroreImportazione(e instanceof Error ? e.message : "Errore di rete durante l'importazione.");
    } finally {
      setImportandoIncassi(false);
    }
  }

  // --- Conferma movimenti pianificati arrivati a scadenza ------------------
  async function confermaMovimento(m: MovimentoPrimaNota) {
    setConfermandoId(m.id);
    setErroreConferma((prec) => ({ ...prec, [m.id]: "" }));
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("movimenti_prima_nota")
        .update({ stato: "effettivo" })
        .eq("id", m.id);
      if (error) {
        setErroreConferma((prec) => ({ ...prec, [m.id]: error.message }));
        return;
      }
      setDaConfermare((prec) => prec.filter((x) => x.id !== m.id));
      // Era già contato nel saldo previsto (era pianificato): ora conta
      // anche nel saldo attuale, il previsto non cambia.
      setSaldi((prec) =>
        prec.map((s) => (s.conto_id === m.conto_id ? { ...s, saldo_attuale: s.saldo_attuale + m.importo } : s))
      );
      setMovimenti((prec) => prec.map((x) => (x.id === m.id ? { ...x, stato: "effettivo" } : x)));
    } finally {
      setConfermandoId(null);
    }
  }

  // Liquidità totale: somma dei saldi attuali di tutti i conti tranne la
  // Carta di credito (che è un debito/spesa, non liquidità disponibile).
  const liquiditaTotale = saldi
    .filter((s) => s.conto_nome !== "Carta di credito")
    .reduce((acc, s) => acc + s.saldo_attuale, 0);
  const liquiditaTotalePrevista = saldi
    .filter((s) => s.conto_nome !== "Carta di credito")
    .reduce((acc, s) => acc + s.saldo_previsto, 0);

  return (
    <div>
      <div className="mb-3 rounded-lg border border-neutral-900 bg-neutral-900 p-3 text-white">
        <p className="text-xs text-neutral-300">Liquidità totale (Volksbank + Trento + Sumup + Cassa + Mutuo)</p>
        <p className="text-xl font-semibold">{formattaEuro(liquiditaTotale)}</p>
        <p className="text-xs text-neutral-400">Previsto: {formattaEuro(liquiditaTotalePrevista)}</p>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {saldi.map((s) => {
          if (s.conto_nome === "Carta di credito") {
            const totale = totaleMeseCarta ?? 0;
            return (
              <div key={s.conto_id} className="rounded-lg border border-neutral-200 bg-white p-3">
                <p className="text-xs text-neutral-500">{s.conto_nome}</p>
                <p className={totale < 0 ? "text-base font-semibold text-red-600" : "text-base font-semibold text-neutral-900"}>
                  {caricandoTotaleCarta ? "…" : formattaEuro(totale)}
                </p>
                <p className="text-xs text-neutral-500">Movimenti del mese</p>
                <input
                  type="month"
                  value={meseCartaCredito}
                  onChange={(e) => {
                    setMeseCartaCredito(e.target.value);
                    caricaTotaleMeseCarta(e.target.value);
                  }}
                  className="mt-1 w-full rounded border border-neutral-200 px-1 py-0.5 text-xs text-neutral-600"
                />
              </div>
            );
          }
          return (
            <div key={s.conto_id} className="rounded-lg border border-neutral-200 bg-white p-3">
              <p className="text-xs text-neutral-500">{s.conto_nome}</p>
              <p className={s.saldo_attuale < 0 ? "text-base font-semibold text-red-600" : "text-base font-semibold text-neutral-900"}>
                {formattaEuro(s.saldo_attuale)}
              </p>
              {s.saldo_previsto !== s.saldo_attuale && (
                <p className="text-xs text-neutral-500">Previsto: {formattaEuro(s.saldo_previsto)}</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <button
          onClick={importaIncassi}
          disabled={importandoIncassi}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {importandoIncassi ? "Importazione in corso…" : "📥 Importa incassi"}
        </button>
        {risultatoImportazione && <span className="text-xs text-neutral-600">{risultatoImportazione}</span>}
        {erroreImportazione && <span className="text-xs text-red-600">Errore: {erroreImportazione}</span>}
      </div>

      {daConfermare.length > 0 && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="mb-1 text-base font-semibold text-amber-900">
            ⚠️ Da confermare ({daConfermare.length})
          </h2>
          <p className="mb-3 text-xs text-amber-800">
            Questi movimenti erano pianificati per oggi o prima. Se sono avvenuti davvero, confermali per
            farli contare nel saldo attuale — altrimenti lasciali così, restano pianificati.
          </p>
          <div className="space-y-1">
            {daConfermare.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm text-neutral-900">
                    {formattaData(m.data)} — {m.causale}
                  </p>
                  <p className="text-xs text-neutral-500">{contiPerId.get(m.conto_id)?.nome ?? "?"}</p>
                  {erroreConferma[m.id] && (
                    <p className="text-xs text-red-600">Errore: {erroreConferma[m.id]}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className={m.importo < 0 ? "text-sm font-medium text-red-600" : "text-sm font-medium text-green-700"}>
                    {formattaEuro(m.importo)}
                  </span>
                  <button
                    onClick={() => confermaMovimento(m)}
                    disabled={confermandoId === m.id}
                    className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    {confermandoId === m.id ? "…" : "✓ È avvenuto"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={salvaMovimento} className="mb-6 rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="mb-3 text-base font-semibold text-neutral-900">Nuovo movimento</h2>

        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-xs text-neutral-500">Data</label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="mt-0.5 block w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-neutral-500">Causale</label>
            <input
              type="text"
              list="causali-suggerite"
              value={causale}
              onChange={(e) => setCausale(e.target.value)}
              placeholder="es. Incasso del Giorno"
              className="mt-0.5 block w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
            />
            <datalist id="causali-suggerite">
              {suggerimentiCausale.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="text-xs text-neutral-500">Importo</label>
            <input
              type="text"
              inputMode="decimal"
              value={importo}
              onChange={(e) => setImporto(e.target.value)}
              placeholder="0,00"
              className="mt-0.5 block w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </div>
        </div>

        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-xs text-neutral-500">{trasferimento ? "Conto di partenza" : "Conto"}</label>
            <select
              value={contoId}
              onChange={(e) => setContoId(e.target.value)}
              className="mt-0.5 block w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
            >
              {conti.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          {!trasferimento && (
            <div>
              <label className="text-xs text-neutral-500">Tipo</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as "entrata" | "uscita")}
                className="mt-0.5 block w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
              >
                <option value="uscita">Uscita</option>
                <option value="entrata">Entrata</option>
              </select>
            </div>
          )}

          {trasferimento && (
            <div>
              <label className="text-xs text-neutral-500">Conto di arrivo</label>
              <select
                value={contoDestinazioneId}
                onChange={(e) => setContoDestinazioneId(e.target.value)}
                className="mt-0.5 block w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
              >
                <option value="">— scegli —</option>
                {conti
                  .filter((c) => c.id !== contoId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs text-neutral-500">Stato</label>
            <select
              value={stato}
              onChange={(e) => setStato(e.target.value as "effettivo" | "pianificato")}
              className="mt-0.5 block w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
            >
              <option value="effettivo">Già avvenuto</option>
              <option value="pianificato">Pianificato (futuro)</option>
            </select>
          </div>

          <div className="flex items-end pb-1.5">
            <label className="flex items-center gap-1.5 text-xs text-neutral-600">
              <input
                type="checkbox"
                checked={trasferimento}
                onChange={(e) => {
                  setTrasferimento(e.target.checked);
                  setContoDestinazioneId("");
                }}
              />
              È uno spostamento fra due miei conti
            </label>
          </div>
        </div>

        {erroreForm && <p className="mb-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">{erroreForm}</p>}

        <button
          type="submit"
          disabled={salvando}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {salvando ? "Salvataggio…" : "Registra movimento"}
        </button>
      </form>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-base font-semibold text-neutral-900">Movimenti recenti</h2>
        <select
          value={filtroContoId}
          onChange={(e) => {
            setFiltroContoId(e.target.value);
            ricaricaMovimenti(e.target.value, filtroStato);
          }}
          className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        >
          <option value="">Tutti i conti</option>
          {conti.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        <select
          value={filtroStato}
          onChange={(e) => {
            setFiltroStato(e.target.value);
            ricaricaMovimenti(filtroContoId, e.target.value);
          }}
          className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        >
          <option value="">Tutti gli stati</option>
          <option value="effettivo">Solo già avvenuti</option>
          <option value="pianificato">Solo pianificati</option>
        </select>
      </div>

      {caricandoLista && <p className="mb-2 text-sm text-neutral-500">Caricamento…</p>}

      {movimenti.length === 0 && !caricandoLista && (
        <p className="text-sm text-neutral-500">Nessun movimento trovato.</p>
      )}

      <div className="space-y-1">
        {movimenti.map((m) => (
          <div
            key={m.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-sm text-neutral-900">
                {formattaData(m.data)} — {m.causale}
                {m.trasferimento_id && (
                  <span className="ml-1.5 rounded-full bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600">
                    trasferimento
                  </span>
                )}
                {m.stato === "pianificato" && (
                  <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                    pianificato
                  </span>
                )}
              </p>
              <p className="text-xs text-neutral-500">{contiPerId.get(m.conto_id)?.nome ?? "?"}</p>
              {erroreEliminazione[m.id] && (
                <p className="text-xs text-red-600">Errore: {erroreEliminazione[m.id]}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className={m.importo < 0 ? "text-sm font-medium text-red-600" : "text-sm font-medium text-green-700"}>
                {formattaEuro(m.importo)}
              </span>
              <button
                onClick={() => eliminaMovimento(m)}
                disabled={eliminandoId === m.id}
                className="text-xs text-neutral-400 hover:text-red-600 disabled:opacity-50"
                title="Elimina"
              >
                {eliminandoId === m.id ? "…" : "✕"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
