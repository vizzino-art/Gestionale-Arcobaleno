export default function PannelloPage() {
  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-neutral-900">
        Pannello
      </h1>
      <p className="text-sm text-neutral-500">
        Prossimo passo: catalogo prodotti con modifica inline e storico
        prezzi da{" "}
        <code className="rounded bg-neutral-100 px-1">
          storico_prezzi_fatture
        </code>{" "}
        per prodotto (frecce aumento/diminuzione rispetto alla fattura
        precedente).
      </p>
    </div>
  );
}
