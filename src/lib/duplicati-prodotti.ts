// Individua coppie di prodotti dello stesso fornitore che sembrano lo
// stesso prodotto inserito due volte (es. per una creazione al volo da
// Registra bolla che non ha riconosciuto una variante di nome). Non decide
// nulla da sola: propone soltanto, è Mauro a scegliere quale tenere.
import type { Prodotto } from "./types";

function normalizzaTesto(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9À-Ù]+/g, " ").trim();
}

// Bidirezionale per lo stesso motivo del match in Registra bolla: un nome
// più corto ("Stracchino") e uno più lungo ("Stracchino COMALAT gr. 1000")
// vanno riconosciuti come simili in entrambi i versi, non solo in uno.
function punteggioSomiglianza(descA: string, descB: string): number {
  const a = normalizzaTesto(descA);
  const b = normalizzaTesto(descB);
  if (a === b) return 1;

  const paroleA = a.split(" ").filter((w) => w.length > 2);
  const paroleB = b.split(" ").filter((w) => w.length > 2);
  const insiemeA = new Set(a.split(" "));
  const insiemeB = new Set(b.split(" "));

  const versoAB = paroleA.length ? paroleA.filter((w) => insiemeB.has(w)).length / paroleA.length : 0;
  const versoBA = paroleB.length ? paroleB.filter((w) => insiemeA.has(w)).length / paroleB.length : 0;

  return Math.max(versoAB, versoBA);
}

export type CoppiaSospetta = {
  a: Prodotto;
  b: Prodotto;
  punteggio: number;
  stessoPrezzo: boolean;
};

const SOGLIA_SOMIGLIANZA = 0.6;

export function trovaCoppieSospette(prodotti: Prodotto[]): CoppiaSospetta[] {
  const perFornitore = new Map<string, Prodotto[]>();
  for (const p of prodotti) {
    const lista = perFornitore.get(p.fornitore_id);
    if (lista) lista.push(p);
    else perFornitore.set(p.fornitore_id, [p]);
  }

  const coppie: CoppiaSospetta[] = [];
  for (const lista of perFornitore.values()) {
    for (let i = 0; i < lista.length; i++) {
      for (let j = i + 1; j < lista.length; j++) {
        const a = lista[i];
        const b = lista[j];
        const punteggio = punteggioSomiglianza(a.descrizione, b.descrizione);
        if (punteggio < SOGLIA_SOMIGLIANZA) continue;
        const stessoPrezzo =
          a.prezzo_unitario != null &&
          b.prezzo_unitario != null &&
          Math.abs(a.prezzo_unitario - b.prezzo_unitario) < 0.01;
        coppie.push({ a, b, punteggio, stessoPrezzo });
      }
    }
  }

  // Prima le coppie con prezzo identico (segnale più forte di doppione
  // vero), poi per somiglianza decrescente.
  return coppie.sort(
    (x, y) => Number(y.stessoPrezzo) - Number(x.stessoPrezzo) || y.punteggio - x.punteggio
  );
}
