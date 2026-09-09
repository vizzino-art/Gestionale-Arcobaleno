export default function RiepilogoPage() {
  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-neutral-900">
        Riepilogo
      </h1>
      <p className="text-sm text-neutral-500">
        Prossimo passo: riepilogo ordini da{" "}
        <code className="rounded bg-neutral-100 px-1">storico_ordini</code>{" "}
        con data di consegna calcolata dal giorno del fornitore, e generazione
        del messaggio WhatsApp.
      </p>
    </div>
  );
}
