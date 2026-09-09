"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [inviato, setInviato] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [caricamento, setCaricamento] = useState(false);

  async function inviaLink(e: React.FormEvent) {
    e.preventDefault();
    setCaricamento(true);
    setErrore(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Solo utenti già invitati da Supabase possono accedere:
        // niente creazione automatica di nuovi account.
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/`,
      },
    });

    setCaricamento(false);
    if (error) {
      setErrore(error.message);
    } else {
      setInviato(true);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-neutral-900">
          Gestionale Ordini Arcobaleno
        </h1>
        <p className="mb-6 text-sm text-neutral-500">
          Accedi con la tua email autorizzata.
        </p>

        {inviato ? (
          <p className="text-sm text-green-700">
            Ti abbiamo inviato un link di accesso a {email}. Controlla la
            posta.
          </p>
        ) : (
          <form onSubmit={inviaLink} className="space-y-4">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@esempio.it"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            />
            <button
              type="submit"
              disabled={caricamento}
              className="w-full rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {caricamento ? "Invio..." : "Invia link di accesso"}
            </button>
            {errore && <p className="text-sm text-red-600">{errore}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
