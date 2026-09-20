"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Voce = { href: string; label: string };

// Raggruppamento per area di lavoro (20/9, richiesto da Mauro dopo due
// tentativi scartati: prima un semplice "a capo" mischiava voci non
// correlate senza senso; poi impilare le voci correlate una sopra l'altra
// creava buchi bianchi sotto i gruppi da una sola voce, sembrava rotto.
// Ogni gruppo di più voci è ora un'unica "pillola" con bordino, tutte le
// sue voci affiancate alla stessa altezza — nessun buco, e quando non
// c'entrano tutte su una riga la pillola va a capo intera, mai spezzata.
const GRUPPI: string[][] = [
  ["/fornitori"],
  ["/ordina", "/riepilogo"],
  ["/pannello", "/confronta"],
  ["/registra-bolla", "/storico-bolle", "/registro-fatture"],
  ["/prima-nota", "/corrispettivi"],
];

function raggruppa(voci: Voce[]): Voce[][] {
  const usati = new Set<string>();
  const gruppi: Voce[][] = [];
  for (const hrefs of GRUPPI) {
    const trovate = hrefs
      .map((h) => voci.find((v) => v.href === h))
      .filter((v): v is Voce => v !== undefined);
    trovate.forEach((v) => usati.add(v.href));
    if (trovate.length > 0) gruppi.push(trovate);
  }
  // Qualsiasi voce non elencata sopra (es. "Utenti", o una pagina futura
  // non ancora assegnata a un gruppo) resta comunque visibile, da sola.
  for (const v of voci) {
    if (!usati.has(v.href)) gruppi.push([v]);
  }
  return gruppi;
}

// Le voci mostrate arrivano dal layout server (src/app/(app)/layout.tsx),
// già filtrate in base ai permessi dell'utente loggato (punto 13, 19/9) —
// così un utente con accesso limitato non vede nemmeno il link a una
// pagina che non può aprire.
export function NavBar({ voci, mostraUtenti }: { voci: Voce[]; mostraUtenti: boolean }) {
  const percorso = usePathname();
  const tutteLeVoci = mostraUtenti ? [...voci, { href: "/utenti", label: "👤 Utenti" }] : voci;
  const gruppi = raggruppa(tutteLeVoci);

  return (
    <nav className="border-b border-neutral-200 bg-white">
      <div className="mx-auto max-w-5xl px-3 py-2 sm:px-4">
        <Link href="/" className="mb-2 inline-block">
          <Image
            src="/logo-arcobaleno.png"
            alt="Arcobaleno"
            width={642}
            height={226}
            priority
            className="h-9 w-auto sm:h-10"
          />
        </Link>
        <div className="flex flex-wrap items-start gap-2">
          {gruppi.map((gruppo) => (
            <div
              key={gruppo[0].href}
              className={
                gruppo.length > 1
                  ? "flex divide-x divide-neutral-200 overflow-hidden rounded-md border border-neutral-200"
                  : undefined
              }
            >
              {gruppo.map((voce) => {
                // Voce attiva se il percorso coincide esattamente, o se e'
                // una sotto-pagina di quella voce (es. /pannello/qualcosa).
                const attiva = percorso === voce.href || percorso?.startsWith(voce.href + "/");
                return (
                  <Link
                    key={voce.href}
                    href={voce.href}
                    aria-current={attiva ? "page" : undefined}
                    className={
                      attiva
                        ? `${gruppo.length === 1 ? "rounded-md " : ""}bg-neutral-900 px-3 py-2.5 text-sm font-medium text-white`
                        : `${gruppo.length === 1 ? "rounded-md " : ""}px-3 py-2.5 text-sm text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 active:bg-neutral-200`
                    }
                  >
                    {voce.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </nav>
  );
}
