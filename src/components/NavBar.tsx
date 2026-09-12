"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const VOCI = [
  { href: "/fornitori", label: "Fornitori" },
  { href: "/ordina", label: "Ordina" },
  { href: "/pannello", label: "Pannello" },
  { href: "/riepilogo", label: "Riepilogo" },
  { href: "/confronta", label: "Confronta" },
  { href: "/registra-bolla", label: "Registra bolla" },
  { href: "/storico-bolle", label: "Storico bolle" },
];

export function NavBar() {
  const percorso = usePathname();

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
            {VOCI.map((voce) => {
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
