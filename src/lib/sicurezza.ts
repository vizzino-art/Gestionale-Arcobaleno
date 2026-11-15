// Modulo Sicurezza + HACCP (15/11/2026) — logica pura dello scadenzario.
// Tabelle sic_* create da supabase/crea-sicurezza-haccp.sql; qui nessuna
// query, solo il calcolo dello stato di ogni adempimento per persona, così
// la pagina e (in futuro) il job delle email usano esattamente le stesse regole.

export type Persona = {
  id: string;
  tipo: "dipendente" | "socio_titolare";
  cognome: string;
  nome: string;
  codice_busta: string | null;
  mansione: string | null;
  data_assunzione: string | null;
  data_cessazione: string | null;
  fine_contratto: string | null;
  conservare_fino_al: string | null;
  datore_lavoro: boolean;
  addetto_antincendio: boolean;
  addetto_primo_soccorso: boolean;
  rls: boolean;
  contratto_dropbox?: string | null;
  note: string | null;
};

export type Corso = {
  id: string;
  nome: string;
  categoria: "sicurezza" | "haccp";
  validita_mesi: number | null;
  giorni_nuovo_assunto: number | null;
  entro_il: string | null;
  richiesto_per: "tutti" | "datore_lavoro" | "antincendio" | "primo_soccorso" | "rls";
  rinnova: string | null;
  ordine: number;
  attivo: boolean;
};

export type Formazione = {
  id: string;
  persona_id: string;
  corso_id: string;
  stato: "completato" | "in_corso";
  data_corso: string | null;
  scadenza: string | null;
  ente: string | null;
  ore: number | null;
  attestato_path: string | null;
  note: string | null;
};

export type Visita = {
  id: string;
  persona_id: string;
  tipo: string;
  data_visita: string;
  giudizio: string | null;
  prossima_scadenza: string | null;
  note: string | null;
};

// Stati dal più grave al meno grave.
export type Stato = "scaduto" | "mancante" | "in_scadenza" | "da_fare" | "in_corso" | "ok";

export const GRAVITA: Record<Stato, number> = {
  scaduto: 5,
  mancante: 5,
  in_scadenza: 3,
  da_fare: 2,
  in_corso: 1,
  ok: 0,
};

export function colore(s: Stato): "rosso" | "giallo" | "grigio" | "verde" {
  if (s === "scaduto" || s === "mancante") return "rosso";
  if (s === "in_scadenza" || s === "da_fare") return "giallo";
  if (s === "in_corso") return "grigio";
  return "verde";
}

// Gruppi = colonne dello scadenzario e contatori in alto.
export type GruppoId = "sicurezza" | "visita" | "haccp" | "incarichi";
export const GRUPPI: { id: GruppoId; label: string }[] = [
  { id: "sicurezza", label: "Formazione sicurezza" },
  { id: "visita", label: "Visita medica" },
  { id: "haccp", label: "HACCP" },
  { id: "incarichi", label: "Incarichi" },
];

// I corsi "da lavoratore": non richiesti al datore di lavoro (Ivana),
// deciso con Mauro il 15/11. HACCP invece vale per tutti, lei compresa.
const CORSI_LAVORATORE = new Set(["formazione_generale", "formazione_specifica", "aggiornamento_lavoratori"]);

const ABBREVIAZIONI: Record<string, string> = {
  formazione_generale: "Generale",
  formazione_specifica: "Specifica",
  haccp_norme: "Norme",
  haccp_alimentaristi: "Corso",
  antincendio: "Antincendio",
  primo_soccorso: "Primo socc.",
  rls: "RLS",
  rspp_datore: "RSPP",
  corso_datore_16h: "Datore 16h",
};

export const GIORNI_PREAVVISO = 90; // "3 mesi prima", come da richiesta

export type Esito = {
  chiave: string; // corso_id oppure "visita"
  etichetta: string; // nome breve
  stato: Stato;
  data: string | null; // scadenza, o termine entro cui farlo
  gruppo: GruppoId;
};

export type RigaScadenzario = {
  persona: Persona;
  esiti: Esito[];
  peggiore: number; // gravità massima, per ordinare
};

// --- date (stringhe ISO "AAAA-MM-GG", nessun problema di fuso orario) ---

export function aggiungiMesi(iso: string, mesi: number): string {
  const [a, m, g] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + mesi, g));
  return d.toISOString().slice(0, 10);
}

export function aggiungiGiorni(iso: string, giorni: number): string {
  const [a, m, g] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1, g + giorni));
  return d.toISOString().slice(0, 10);
}

export function formattaData(iso: string | null): string {
  if (!iso) return "—";
  const [a, m, g] = iso.split("-");
  return `${g}/${m}/${a.slice(2)}`;
}

export function oggiRoma(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(new Date());
}

function statoDaScadenza(scadenza: string | null, oggi: string): Stato {
  if (!scadenza) return "ok"; // non scade (es. formazione generale)
  if (scadenza < oggi) return "scaduto";
  if (scadenza <= aggiungiGiorni(oggi, GIORNI_PREAVVISO)) return "in_scadenza";
  return "ok";
}

function gruppoDelCorso(c: Corso): GruppoId {
  if (c.categoria === "haccp") return "haccp";
  if (CORSI_LAVORATORE.has(c.id)) return "sicurezza";
  return "incarichi";
}

export function corsoRichiesto(c: Corso, p: Persona): boolean {
  if (!c.attivo || c.rinnova) return false; // chi "rinnova" conta dentro il corso rinnovato
  if (p.datore_lavoro && CORSI_LAVORATORE.has(c.id)) return false;
  switch (c.richiesto_per) {
    case "tutti":
      return true;
    case "datore_lavoro":
      return p.datore_lavoro;
    case "antincendio":
      return p.addetto_antincendio;
    case "primo_soccorso":
      return p.addetto_primo_soccorso;
    case "rls":
      return p.rls;
  }
}

function esitoCorso(c: Corso, p: Persona, corsi: Corso[], formazioni: Formazione[], oggi: string): Esito {
  // Il corso stesso più quelli che lo rinnovano (es. aggiornamento → specifica).
  const validi = new Set([c.id, ...corsi.filter((x) => x.rinnova === c.id).map((x) => x.id)]);
  const mie = formazioni.filter((f) => f.persona_id === p.id && validi.has(f.corso_id));
  const completate = mie
    .filter((f) => f.stato === "completato" && f.data_corso)
    .sort((a, b) => (b.data_corso! > a.data_corso! ? 1 : -1));
  const base = { chiave: c.id, etichetta: ABBREVIAZIONI[c.id] ?? c.nome, gruppo: gruppoDelCorso(c) };

  const ultima = completate[0];
  if (ultima) {
    const corsoUltima = corsi.find((x) => x.id === ultima.corso_id) ?? c;
    const scadenza =
      ultima.scadenza ??
      (corsoUltima.validita_mesi ? aggiungiMesi(ultima.data_corso!, corsoUltima.validita_mesi) : null);
    return { ...base, stato: statoDaScadenza(scadenza, oggi), data: scadenza };
  }

  if (mie.some((f) => f.stato === "in_corso")) return { ...base, stato: "in_corso", data: null };

  // Mai fatto: c'è ancora tempo (nuovo assunto / scadenza una tantum) o è mancante?
  let termine: string | null = c.entro_il;
  if (!termine && c.giorni_nuovo_assunto != null && p.data_assunzione) {
    termine = aggiungiGiorni(p.data_assunzione, c.giorni_nuovo_assunto);
  }
  if (termine && termine >= oggi) return { ...base, stato: "da_fare", data: termine };
  return { ...base, stato: "mancante", data: termine };
}

function esitoVisita(p: Persona, visite: Visita[], oggi: string): Esito {
  const ultima = visite
    .filter((v) => v.persona_id === p.id)
    .sort((a, b) => (b.data_visita > a.data_visita ? 1 : -1))[0];
  const base = { chiave: "visita", etichetta: "Visita", gruppo: "visita" as GruppoId };
  if (!ultima) return { ...base, stato: "mancante", data: null };
  return { ...base, stato: statoDaScadenza(ultima.prossima_scadenza, oggi), data: ultima.prossima_scadenza };
}

export function calcolaScadenzario(
  persone: Persona[],
  corsi: Corso[],
  formazioni: Formazione[],
  visite: Visita[],
  oggi: string
): RigaScadenzario[] {
  const ordinati = [...corsi].sort((a, b) => a.ordine - b.ordine);
  return persone
    .map((p) => {
      const esiti = [
        ...ordinati.filter((c) => corsoRichiesto(c, p)).map((c) => esitoCorso(c, p, corsi, formazioni, oggi)),
        esitoVisita(p, visite, oggi),
      ];
      return { persona: p, esiti, peggiore: Math.max(0, ...esiti.map((e) => GRAVITA[e.stato])) };
    })
    .sort(
      (a, b) =>
        b.peggiore - a.peggiore ||
        a.persona.cognome.localeCompare(b.persona.cognome, "it") ||
        a.persona.nome.localeCompare(b.persona.nome, "it")
    );
}

// Contatori in alto: per ogni gruppo, quante PERSONE hanno almeno un
// adempimento rosso (scaduto/mancante) e quante almeno uno giallo.
export function contaPerGruppo(righe: RigaScadenzario[]) {
  return GRUPPI.map((g) => {
    let rossi = 0;
    let gialli = 0;
    for (const r of righe) {
      const delGruppo = r.esiti.filter((e) => e.gruppo === g.id);
      if (delGruppo.some((e) => colore(e.stato) === "rosso")) rossi++;
      else if (delGruppo.some((e) => colore(e.stato) === "giallo")) gialli++;
    }
    return { ...g, rossi, gialli };
  });
}

// Link per aprire l'attestato nel sito di Dropbox (i file restano lì).
export function linkDropbox(path: string): string {
  const i = path.lastIndexOf("/");
  const cartella = path.slice(0, i);
  const file = path.slice(i + 1);
  return `https://www.dropbox.com/home${encodeURI(cartella)}?preview=${encodeURIComponent(file)}`;
}
