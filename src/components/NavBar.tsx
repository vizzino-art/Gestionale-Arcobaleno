"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Voce = { href: string; label: string };

// Raggruppamento per area di lavoro (20/9, richiesto da Mauro dopo aver
// visto il semplice "a capo" del primo tentativo: voci non correlate
// finivano una sotto l'altra senza senso). Pagine correlate stanno vicine
// e vanno a capo INSIEME, mai spezzate a metà — così il menu resta
// ordinato anche su schermi stretti, invece di andare a capo a caso in
// mezzo a una riga lunga. Una voce il cui href non compare qui (una pagina
// nuova aggiunta in futuro e non ancora sistemata in un gruppo) non sparisce:
// finisce da sola in un gruppo a sé in fondo, vedi raggruppa() sotto.
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
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {gruppi.map((gruppo) => (
            <div key={gruppo[0].href} className="flex flex-col gap-0.5">
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
                        ? "rounded-md bg-neutral-900 px-3 py-2.5 text-sm font-medium text-white"
                        : "rounded-md px-3 py-2.5 text-sm text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 active:bg-neutral-200"
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
