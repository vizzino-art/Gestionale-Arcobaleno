"use client";

import { useState } from "react";
import { PAGINE, type PaginaId } from "@/lib/permessi";
import type { UtenteConPermessi } from "@/components/UtentiClient";

export function GestisciPermessiUtenteModal({
  utente,
  bloccaAmministratore,
  onChiudi,
  onSalvato,
}: {
  utente: UtenteConPermessi;
  // true per l'utente attualmente loggato: non deve poter togliersi da
  // solo i propri poteri di amministratore per errore, restando fuori.
  bloccaAmministratore: boolean;
  onChiudi: () => void;
  onSalvato: (aggiornato: UtenteConPermessi) => void;
}) {
  const [isAdmin, setIsAdmin] = useState(utente.isAdmin);
  const [accessoLimitato, setAccessoLimitato] = useState(utente.accessoLimitato);
  const [pagine, setPagine] = useState<Set<PaginaId>>(new Set(utente.pagineConsentite));
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  function alternaPagina(id: PaginaId) {
    setPagine((prec) => {
      const nuovo = new Set(prec);
      if (nuovo.has(id)) nuovo.delete(id);
      else nuovo.add(id);
      return nuovo;
    });
  }

  async function salva() {
    setSalvando(true);
    setErrore(null);
    try {
      const risposta = await fetch("/api/utenti/permessi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: utente.id,
          email: utente.email,
          isAdmin,
          accessoLimitato,
          pagine: Array.from(pagine),
        }),
      });
      const corpo = await risposta.json();
      if (!risposta.ok) {
        setErrore(corpo.errore ?? "Errore sconosciuto");
        return;
      }
      onSalvato({
        ...utente,
        isAdmin,
        accessoLimitato,
        pagineConsentite: Array.from(pagine),
      });
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Errore di rete");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-lg">
        <h2 className="mb-1 text-base font-semibold text-neutral-900">Permessi di {utente.email}</h2>
        <p className="mb-4 text-xs text-neutral-500">
          Per default un utente vede tutto. Attiva &quot;Accesso limitato&quot; per farlo vedere solo alle
          pagine spuntate qui sotto.
        </p>

        {errore && <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{errore}</p>}

        <label className="mb-3 flex items-center gap-2 text-sm text-neutral-800">
          <input
            type="checkbox"
            checked={isAdmin}
            disabled={bloccaAmministratore}
            onChange={(e) => setIsAdmin(e.target.checked)}
            className="h-4 w-4"
          />
          Amministratore (gestisce i permessi di tutti, vede sempre tutto)
        </label>
        {bloccaAmministratore && (
          <p className="mb-3 -mt-2 text-xs text-neutral-400">
            Non puoi togliere a te stesso i permessi di amministratore da qui.
          </p>
        )}

        <label className="mb-3 flex items-center gap-2 text-sm text-neutral-800">
          <input
            type="checkbox"
            checked={accessoLimitato}
            disabled={isAdmin}
            onChange={(e) => setAccessoLimitato(e.target.checked)}
            className="h-4 w-4"
          />
          Accesso limitato alle sole pagine spuntate
        </label>

        <div className={`mb-4 grid grid-cols-2 gap-2 rounded-lg border p-3 ${accessoLimitato && !isAdmin ? "border-neutral-200" : "border-neutral-100 opacity-40"}`}>
          {PAGINE.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm text-neutral-800">
              <input
                type="checkbox"
                disabled={!accessoLimitato || isAdmin}
                checked={pagine.has(p.id)}
                onChange={() => alternaPagina(p.id)}
                className="h-4 w-4"
              />
              {p.label}
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onChiudi}
            className="rounded-md px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100"
          >
            Annulla
          </button>
          <button
            onClick={salva}
            disabled={salvando}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {salvando ? "Salvataggio…" : "Salva"}
          </button>
        </div>
      </div>
    </div>
  );
}
