"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Controparte } from "@/lib/types";

type Props = {
  ditta: Controparte | null;
  onSalvato: (d: Controparte) => void;
  onChiudi: () => void;
};

type Form = {
  nome: string;
  iban: string;
  piva: string;
  sdi: string;
  indirizzo: string;
  citta: string;
  provincia: string;
  cap: string;
  rappresentante: string;
  cell_rappresentante: string;
};

function formIniziale(d: Controparte | null): Form {
  return {
    nome: d?.nome ?? "",
    iban: d?.iban ?? "",
    piva: d?.piva ?? "",
    sdi: d?.sdi ?? "",
    indirizzo: d?.indirizzo ?? "",
    citta: d?.citta ?? "",
    provincia: d?.provincia ?? "",
    cap: d?.cap ?? "",
    rappresentante: d?.rappresentante ?? "",
    cell_rappresentante: d?.cell_rappresentante ?? "",
  };
}

export function ModificaDittaModal({ ditta, onSalvato, onChiudi }: Props) {
  const supabase = createClient();
  const [form, setForm] = useState<Form>(formIniziale(ditta));
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

    const testo = (v: string) => (v.trim() === "" ? null : v.trim());

    const valori = {
      nome: form.nome.trim(),
      iban: testo(form.iban),
      piva: testo(form.piva),
      sdi: testo(form.sdi),
      indirizzo: testo(form.indirizzo),
      citta: testo(form.citta),
      provincia: testo(form.provincia),
      cap: testo(form.cap),
      rappresentante: testo(form.rappresentante),
      cell_rappresentante: testo(form.cell_rappresentante),
    };

    const query = ditta
      ? supabase.from("controparti").update(valori).eq("id", ditta.id)
      : supabase.from("controparti").insert(valori);

    const { data, error } = await query.select("*").single();

    setSalvando(false);
    if (error || !data) {
      setErrore(error?.message ?? "Errore durante il salvataggio.");
      return;
    }
    onSalvato(data as Controparte);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onChiudi}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-4">
          <h2 className="text-sm font-semibold text-neutral-900">{ditta ? "Modifica ditta" : "Nuova ditta"}</h2>
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
              P.IVA
              <input
                type="text"
                value={form.piva}
                onChange={(e) => campo("piva", e.target.value)}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
            </label>
            <label className="flex-1 text-xs text-neutral-500">
              Codice SDI
              <input
                type="text"
                value={form.sdi}
                onChange={(e) => campo("sdi", e.target.value)}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
            </label>
          </div>

          <label className="block text-xs text-neutral-500">
            IBAN
            <input
              type="text"
              value={form.iban}
              onChange={(e) => campo("iban", e.target.value)}
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            />
          </label>

          <label className="block text-xs text-neutral-500">
            Indirizzo
            <input
              type="text"
              value={form.indirizzo}
              onChange={(e) => campo("indirizzo", e.target.value)}
              className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            />
          </label>

          <div className="flex gap-3">
            <label className="flex-1 text-xs text-neutral-500">
              Città
              <input
                type="text"
                value={form.citta}
                onChange={(e) => campo("citta", e.target.value)}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
            </label>
            <label className="w-16 text-xs text-neutral-500">
              Prov.
              <input
                type="text"
                maxLength={2}
                value={form.provincia}
                onChange={(e) => campo("provincia", e.target.value.toUpperCase())}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm uppercase outline-none focus:border-neutral-500"
              />
            </label>
            <label className="w-24 text-xs text-neutral-500">
              CAP
              <input
                type="text"
                value={form.cap}
                onChange={(e) => campo("cap", e.target.value)}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
            </label>
          </div>

          <div className="flex gap-3">
            <label className="flex-1 text-xs text-neutral-500">
              Rappresentante
              <input
                type="text"
                value={form.rappresentante}
                onChange={(e) => campo("rappresentante", e.target.value)}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
            </label>
            <label className="flex-1 text-xs text-neutral-500">
              Cell. rappresentante
              <input
                type="text"
                value={form.cell_rappresentante}
                onChange={(e) => campo("cell_rappresentante", e.target.value)}
                className="mt-1 block w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
              />
            </label>
          </div>

          {errore && <p className="text-sm text-red-600">{errore}</p>}

          <div className="flex gap-2 pt-1">
            <button
              onClick={salva}
              disabled={salvando}
              className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
            >
              {salvando ? "Salvataggio…" : "Salva"}
            </button>
            <button onClick={onChiudi} className="rounded-lg px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100">
              Annulla
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
