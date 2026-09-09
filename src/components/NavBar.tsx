import Link from "next/link";

const VOCI = [
  { href: "/fornitori", label: "Fornitori" },
  { href: "/ordina", label: "Ordina" },
  { href: "/pannello", label: "Pannello" },
  { href: "/riepilogo", label: "Riepilogo" },
  { href: "/confronta", label: "Confronta" },
];

export function NavBar() {
  return (
    <nav className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center gap-1 overflow-x-auto px-4 py-3">
        <span className="mr-4 shrink-0 text-sm font-semibold text-neutral-900">
          Gestionale Ordini Arcobaleno
        </span>
        {VOCI.map((voce) => (
          <Link
            key={voce.href}
            href={voce.href}
            className="shrink-0 rounded-md px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
          >
            {voce.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
