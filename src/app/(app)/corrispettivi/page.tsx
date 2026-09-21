import { CorrispettiviClient } from "@/components/CorrispettiviClient";

export default function CorrispettiviPage() {
  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold text-neutral-900">Corrispettivi</h1>
      <p className="mb-4 text-sm text-neutral-500">
        I dati inseriti qui vengono scritti direttamente nel foglio Google &quot;2026 - Corrispettivi IVA
        10%&quot;, nelle stesse celle di sempre — la webapp sull&apos;iPad continua a funzionare come prima,
        senza nessuna modifica.
      </p>
      <CorrispettiviClient />
    </div>
  );
}
