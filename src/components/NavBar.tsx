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
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-3 py-2 sm:px-4">
        <Link href="/" className="shrink-0">
          <Image
            src="/logo-arcobaleno.png"
            alt="Arcobaleno"
            width={642}
            height={226}
            priority
            className="h-9 w-auto sm:h-10"
          />
        </Link>
        <div className="relative min-w-0 flex-1">
          <div className="flex gap-1 overflow-x-auto [-webkit-overflow-scrolling:touch]">
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
          {/* Ombra a destra: indica che si può scorrere per vedere le voci fuori schermo su mobile */}
          <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white to-transparent" />
        </div>
      </div>
    </nav>
  );
}
