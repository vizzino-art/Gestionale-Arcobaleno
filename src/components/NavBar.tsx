"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Voce = { href: string; label: string };

// Le voci mostrate arrivano dal layout server (src/app/(app)/layout.tsx),
// già filtrate in base ai permessi dell'utente loggato (punto 13, 19/9) —
// così un utente con accesso limitato non vede nemmeno il link a una
// pagina che non può aprire.
export function NavBar({ voci, mostraUtenti }: { voci: Voce[]; mostraUtenti: boolean }) {
  const percorso = usePathname();
  const tutteLeVoci = mostraUtenti ? [...voci, { href: "/utenti", label: "👤 Utenti" }] : voci;

  return (
    <nav className="border-b border-neutral-200 bg-white">
      {/* flex-wrap invece di scorrimento orizzontale (20/9, richiesto da
          Mauro): con più voci di quante ne stiano su una riga, quelle in
          più vanno a capo su una seconda riga invece di sparire dietro uno
          scroll — tutto resta visibile a colpo d'occhio. */}
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-1 px-3 py-2 sm:px-4">
        <Link href="/" className="mr-2 shrink-0">
          <Image
            src="/logo-arcobaleno.png"
            alt="Arcobaleno"
            width={642}
            height={226}
            priority
            className="h-9 w-auto sm:h-10"
          />
        </Link>
        {tutteLeVoci.map((voce) => {
          // Voce attiva se il percorso coincide esattamente, o se e' una
          // sotto-pagina di quella voce (es. /pannello/qualcosa).
          const attiva = percorso === voce.href || percorso?.startsWith(voce.href + "/");
          return (
            <Link
              key={voce.href}
              href={voce.href}
              aria-current={attiva ? "page" : undefined}
              className={
                attiva
                  ? "shrink-0 rounded-md bg-neutral-900 px-3 py-2.5 text-sm font-medium text-white"
                  : "shrink-0 rounded-md px-3 py-2.5 text-sm text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 active:bg-neutral-200"
              }
            >
              {voce.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
