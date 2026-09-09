export default function OrdinaPage() {
  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-neutral-900">Ordina</h1>
      <p className="text-sm text-neutral-500">
        Prossimo passo: ricostruire qui la logica di composizione ordine
        (conversione in unità di confezione, calcolo omaggi, suggerimento
        automatico del fornitore più conveniente da{" "}
        <code className="rounded bg-neutral-100 px-1">
          v_miglior_fornitore_per_categoria
        </code>
        , messaggio WhatsApp).
      </p>
    </div>
  );
}
