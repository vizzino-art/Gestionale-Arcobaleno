import Link from "next/link";

const MODULI = [
  {
    href: "/fornitori",
    titolo: "Fornitori",
    descrizione: "Anagrafica fornitori, contatti e giorno di consegna",
  },
  {
    href: "/ordina",
    titolo: "Ordina",
    descrizione: "Composizione ordine per fornitore, con suggerimento del più conveniente",
  },
  {
    href: "/pannello",
    titolo: "Pannello",
    descrizione: "Catalogo prodotti e storico prezzi per singolo articolo",
  },
  {
    href: "/riepilogo",
    titolo: "Riepilogo",
    descrizione: "Riepilogo ordini e messaggio WhatsApp per il fornitore",
  },
  {
    href: "/confronta",
    titolo: "Confronta",
    descrizione: "Confronto prezzi automatico tra fornitori per categoria",
  },
];

export default function HomePage() {
  return (
    <div>
      <h1 className="mb-6 text-lg font-semibold text-neutral-900">
        Panoramica
      </h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {MODULI.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-neutral-300 hover:shadow"
          >
            <h2 className="mb-1 font-medium text-neutral-900">{m.titolo}</h2>
            <p className="text-sm text-neutral-500">{m.descrizione}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
