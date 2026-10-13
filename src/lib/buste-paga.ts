// Lettura automatica del PDF con le buste paga mensili (una pagina per
// dipendente), richiesta da Mauro il 13/10 per smettere di ricopiare a mano
// ogni stipendio in Prima Nota. Il modulo arriva sempre dallo stesso
// software (Studio L.A. Elaborazioni Paghe) con lo stesso identico layout
// ogni mese, ed è un vero PDF testuale (non una scansione): i dati si
// leggono per intero dal testo, niente IA — stessa filosofia già usata per
// le fatture elettroniche in src/lib/fattura-elettronica.ts.
//
// Messa a punto leggendo per intero 17 buste paga reali di settembre 2026
// fornite da Mauro: due casi limite emersi e gestiti qui sotto (vedi
// estraiNetto) — un dipendente a zero (aspettativa non retribuita) stampa
// la parola "ZERO" invece di un importo, e una nota libera sotto il totale
// può contenere date scritte male che altrimenti verrebbero scambiate per
// l'importo.

const MESI_IT = [
  "GENNAIO",
  "FEBBRAIO",
  "MARZO",
  "APRILE",
  "MAGGIO",
  "GIUGNO",
  "LUGLIO",
  "AGOSTO",
  "SETTEMBRE",
  "OTTOBRE",
  "NOVEMBRE",
  "DICEMBRE",
] as const;

const PERIODO_RE = new RegExp(`\\b(${MESI_IT.join("|")})\\s+(\\d{4})\\b`);

// "00002 Canton Enrico CNTNRC92M31E970C - ..." → cattura il nome e cognome
// fra il codice dipendente (5 cifre) e il codice fiscale che segue.
const DIPENDENTE_RE = /\b(\d{5})\s+([A-ZÀ-Ü][\wÀ-ü'. ]*?)\s+[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\s*-/;

// Un importo scritto come l'Italia lo scrive davvero: migliaia col punto,
// due decimali con la virgola, segno meno davanti o dietro. Volutamente
// rigido (niente numeri "nudi" tipo "062026") per non prendere per sbaglio
// pezzi di una data scritta male in una nota libera della busta paga.
const IMPORTO_RE = /^-?\d{1,3}(?:\.\d{3})*,\d{2}-?$/;

export type RigaBustaPaga = {
  pagina: number;
  nomeCompleto: string | null;
  // Default ragionevole per la causale: l'ultima parola del nome completo,
  // che per "Cognome Nome" è il nome proprio — nei test reali coincideva
  // quasi sempre con quanto Mauro scrive già a mano (es. "Canton Enrico" →
  // "Enrico"). Resta comunque un campo modificabile nella UI: qualche
  // dipendente ha un nomignolo diverso dal nome anagrafico (es. "Saadia"
  // scritto "Saida" nel file di Mauro), impossibile da indovinare da solo.
  nomeSuggerito: string | null;
  mese: string | null;
  anno: number | null;
  netto: number | null;
  // Pagina non letta bene: mai inventare un numero, segnalarla e lasciare
  // che sia Mauro a decidere (stesso principio già seguito per le bolle).
  avviso: string | null;
};

function capitalizzaMese(mese: string): string {
  return mese.charAt(0) + mese.slice(1).toLowerCase();
}

// Cerca, partendo dalla fine della pagina e andando all'indietro dal timbro
// "Studio L. A. Elaborazioni Paghe", il primo token che sia un importo ben
// formato oppure la parola "ZERO" (stampata quando il netto è zero, es.
// dipendente in aspettativa non retribuita per l'intero mese). Non si ferma
// al primo token qualsiasi subito prima del timbro: un'eventuale nota
// libera fra il totale e il timbro (es. una data scritta senza "/" che
// sembrerebbe un numero) viene scavalcata perché non è un importo valido.
function estraiNetto(parole: string[]): { netto: number | null; avviso: string | null } {
  const idxStudio = parole.indexOf("Studio");
  if (idxStudio === -1) {
    return { netto: null, avviso: "Non trovo il fondo pagina (\"Studio L. A. Elaborazioni Paghe\")." };
  }
  let j = idxStudio - 1;
  while (j >= 0 && (/^\d{2}:\d{2}$/.test(parole[j]) || /^\d{2}\/\d{2}\/\d{4}$/.test(parole[j]))) {
    j--;
  }
  const limite = Math.max(0, j - 15);
  while (j >= limite) {
    const token = parole[j];
    if (token === "ZERO") return { netto: 0, avviso: null };
    if (IMPORTO_RE.test(token)) {
      const negativo = token.startsWith("-") || token.endsWith("-");
      const valore = Number(token.replace(/-/g, "").replace(/\./g, "").replace(",", "."));
      return { netto: negativo ? -valore : valore, avviso: null };
    }
    j--;
  }
  return { netto: null, avviso: "Non trovo il \"Netto a pagare\" in fondo alla pagina." };
}

// testoPerPagina: il testo di ogni pagina del PDF, dove le parole di una
// stessa riga sono separate da spazi (vedi il pagerender personalizzato
// nella route API — il rendering di default di pdf-parse le incolla senza
// spazio, che romperebbe tutte le ricerche qui sotto).
export function estraiBustePaga(testoPerPagina: string[]): RigaBustaPaga[] {
  return testoPerPagina.map((testoPagina, indice) => {
    const testoPiatto = testoPagina.replace(/\n/g, " ");
    const parole = testoPiatto.split(/\s+/).filter(Boolean);

    const matchDipendente = testoPiatto.match(DIPENDENTE_RE);
    const nomeCompleto = matchDipendente ? matchDipendente[2].trim().replace(/\s+/g, " ") : null;
    const paroleNome = nomeCompleto ? nomeCompleto.split(" ") : [];
    const nomeSuggerito = paroleNome.length > 0 ? paroleNome[paroleNome.length - 1] : null;

    const matchPeriodo = testoPiatto.match(PERIODO_RE);
    const mese = matchPeriodo ? capitalizzaMese(matchPeriodo[1]) : null;
    const anno = matchPeriodo ? Number(matchPeriodo[2]) : null;

    const { netto, avviso: avvisoNetto } = estraiNetto(parole);

    const avvisi: string[] = [];
    if (!nomeCompleto) avvisi.push("non trovo il nome del dipendente");
    if (!mese || !anno) avvisi.push("non trovo il mese/anno di competenza");
    if (avvisoNetto) avvisi.push(avvisoNetto);

    return {
      pagina: indice + 1,
      nomeCompleto,
      nomeSuggerito,
      mese,
      anno,
      netto,
      avviso: avvisi.length > 0 ? `Pagina ${indice + 1}: ${avvisi.join("; ")}.` : null,
    };
  });
}
