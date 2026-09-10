"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { prossimoOrdineFornitore } from "@/lib/fornitori";
import type { Fornitore } from "@/lib/types";

type Props = {
  fornitori: Fornitore[]; // per calcolare l'ordine del nuovo fornitore
  fornitore: Fornitore | null; // null = nuovo fornitore
  onSalvato: (f: Fornitore) => void;
  onChiudi: () => void;
};

type Form = {
  nome: string;
  telefono: string;
  email: string;
  giorno_consegna: string; // "" = nessuno
  piva: string;
  prefisso_file: string;
  note: string;
};

const GIORNI = [
  { valore: "1", etichetta: "Lunedì" },
  { valore: "2", etichetta: "Martedì" },
  { valore: "3", etichetta: "Mercoledì" },
  { valore: "4", etichetta: "Giovedì" },
  { valore: "5", etichetta: "Venerdì" },
  { valore: "6", etichetta: "Sabato" },
  { valore: "7", etichetta: "Domenica" },
];

function formIniziale(f: Fornitore | null): Form {
  return {
    nome: f?.nome ?? "",
    telefono: f?.telefono ?? "",
    email: f?.email ?? "",
    giorno_consegna: f?.giorno_consegna?.toString() ?? "",
    piva: f?.piva ?? "",
    prefisso_file: f?.prefisso_file ?? "",
    note: f?.note ?? "",
  };
}

export function ModificaFornitoreModal({ fornitori, fornitore, onSalvato, onChiudi }: Props) {
  const supabase = createClient();
  const [form, setForm] = useState<Form>(formIniziale(fornitore));
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  function campo<K extends keyof Form>(chiave: K, valore: Form[K]) {
    setForm((f) => ({ ...f, [chiave]: valore }));
  }

  async function salva() {
    if (form.nome.trim() === "") {
      setErrore("Il nome è obbligatorio.");
      return;
    }
    setSalvando(true);
    setErrore(null);

    const valori = {
      nome: form.nome.trim(),
      telefono: form.telefono.trim() === "" ? null : form.telefono.trim(),
      email: form.email.trim() === "" ? null : form.email.trim(),
      giorno_consegna: form.giorno_consegna === "" ? null : Number(form.giorno_consegna),
      piva: form.piva.trim() === "" ? null : form.piva.trim(),
      prefisso_file: form.prefisso_file.trim() === "" ? null : form.prefisso_file.trim(),
      note: form.note.trim() === "" ? null : form.note.trim(),
    };

    const query = fornitore
      ? supabase.from("fornitori").update(valori).eq("id", fornitore.id)
      : supabase.from("fornitori").insert({ ...valori, ordine: prossimoOrdineFornitore(fornitori) });

    const { data, error } = await query.select("*").single();

    setSalvando(false);
    if (error || !data) {
      setErrore(error?.message ?? "Errore durante il salvataggio.");
      return;
    }
    onSalvato(data as Fornitore);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onChiudi}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <h2 className="text-sm font-semibold text-neutral-900">
            {fornitore ? "Modifica fornitore" : "Nuovo fornitore"}
          </h2>
          <button onClick={onChiudi} className="text-neutral-400 hover:text-neutral-700">
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <label className="block text-xs text-neutral-500">
            Nome *
            <input
              type="text"
              value={form.nome}
              onChange={(e) => campo("nome", e.target.value)}
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            />
          </label>

          <div className="flex gap-3">
            <label className="flex-1 text-xs text-neutral-500">
              Telefono
              <input
                type="text"
                placeholder="es. 3331234567"
                value={form.telefono}
                onChange={(e) => campo("telefono", e.target.value)}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
            </label>
            <label className="flex-1 text-xs text-neutral-500">
              Email
              <input
                type="email"
                value={form.email}
                onChange={(e) => campo("email", e.target.value)}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
            </label>
          </div>

          <label className="block text-xs text-neutral-500">
            Giorno di consegna
            <select
              value={form.giorno_consegna}
              onChange={(e) => campo("giorno_consegna", e.target.value)}
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            >
              <option value="">— nessuno —</option>
              {GIORNI.map((g) => (
                <option key={g.valore} value={g.valore}>
                  {g.etichetta}
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-3">
            <label className="flex-1 text-xs text-neutral-500">
              P.IVA
              <input
                type="text"
                value={form.piva}
                onChange={(e) => campo("piva", e.target.value)}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
            </label>
            <label className="flex-1 text-xs text-neutral-500">
              Prefisso file fatture
              <input
                type="text"
                placeholder="es. IT02522130406"
                value={form.prefisso_file}
                onChange={(e) => campo("prefisso_file", e.target.value)}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
            </label>
          </div>

          <label className="block text-xs text-neutral-500">
            Note
            <textarea
              value={form.note}
              onChange={(e) => campo("note", e.target.value)}
              rows={2}
              className="mt-1 block w-full resize-none rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            />
          </label>

          {errore && <p className="text-sm text-red-600">{errore}</p>}

          <div className="flex gap-2 pt-1">
            <button
              onClick={salva}
              disabled={salvando}
              className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {salvando ? "Salvataggio…" : "Salva"}
            </button>
            <button
              onClick={onChiudi}
              className="rounded-lg px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100"
            >
              Annulla
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
