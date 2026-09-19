"use client";

import { useState } from "react";
import { PAGINE, type PaginaId } from "@/lib/permessi";
import { GestisciPermessiUtenteModal } from "@/components/GestisciPermessiUtenteModal";

export type UtenteConPermessi = {
  id: string;
  email: string;
  isAdmin: boolean;
  accessoLimitato: boolean;
  pagineConsentite: PaginaId[];
};

function descrizioneAccesso(u: UtenteConPermessi): string {
  if (u.isAdmin) return "Amministratore — vede tutto";
  if (!u.accessoLimitato) return "Vede tutto";
  if (u.pagineConsentite.length === 0) return "Accesso limitato — nessuna pagina ancora concessa";
  const etichette = PAGINE.filter((p) => u.pagineConsentite.includes(p.id)).map((p) => p.label);
  return `Solo: ${etichette.join(", ")}`;
}

export function UtentiClient({
  utentiIniziali,
  utenteAttualeId,
}: {
  utentiIniziali: UtenteConPermessi[];
  utenteAttualeId: string;
}) {
  const [utenti, setUtenti] = useState(utentiIniziali);
  const [inModifica, setInModifica] = useState<UtenteConPermessi | null>(null);

  return (
    <div className="space-y-2">
      {utenti.map((u) => (
        <div
          key={u.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-white p-3"
        >
          <div>
            <p className="text-sm font-medium text-neutral-900">{u.email}</p>
            <p className="text-xs text-neutral-500">{descrizioneAccesso(u)}</p>
          </div>
          <button
            onClick={() => setInModifica(u)}
            className="shrink-0 rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
          >
            Gestisci
          </button>
        </div>
      ))}

      {inModifica && (
        <GestisciPermessiUtenteModal
          utente={inModifica}
          bloccaAmministratore={inModifica.id === utenteAttualeId && inModifica.isAdmin}
          onChiudi={() => setInModifica(null)}
          onSalvato={(aggiornato) => {
            setUtenti((prec) => prec.map((x) => (x.id === aggiornato.id ? aggiornato : x)));
            setInModifica(null);
          }}
        />
      )}
    </div>
  );
}
