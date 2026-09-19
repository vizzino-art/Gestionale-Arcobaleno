import type { SupabaseClient } from "@supabase/supabase-js";

// Sistema permessi per pagina (punto 13 + accesso Corrispettivi, 19/9) —
// vedi supabase/crea-permessi-utenti.sql per la filosofia generale.
//
// Elenco delle pagine "concedibili": per ciascuna, l'id salvato in
// permessi_pagina, il percorso e l'etichetta mostrata in NavBar. "Utenti"
// (questa stessa pagina di gestione) NON è qui dentro apposta: è visibile
// solo a chi ha is_admin=true, mai concedibile a un utente limitato.
export type PaginaId =
  | "fornitori"
  | "ordina"
  | "pannello"
  | "riepilogo"
  | "confronta"
  | "registra-bolla"
  | "storico-bolle"
  | "registro-fatture"
  | "prima-nota"
  | "corrispettivi";

export const PAGINE: { id: PaginaId; href: string; label: string }[] = [
  { id: "fornitori", href: "/fornitori", label: "Fornitori" },
  { id: "ordina", href: "/ordina", label: "Ordina" },
  { id: "pannello", href: "/pannello", label: "Pannello" },
  { id: "riepilogo", href: "/riepilogo", label: "Riepilogo" },
  { id: "confronta", href: "/confronta", label: "Confronta" },
  { id: "registra-bolla", href: "/registra-bolla", label: "Registra bolla" },
  { id: "storico-bolle", href: "/storico-bolle", label: "Storico bolle" },
  { id: "registro-fatture", href: "/registro-fatture", label: "Registro Fatture" },
  { id: "prima-nota", href: "/prima-nota", label: "Prima Nota" },
  { id: "corrispettivi", href: "/corrispettivi", label: "Corrispettivi" },
];

export type Permessi = {
  isAdmin: boolean;
  accessoLimitato: boolean;
  // Rilevante solo se accessoLimitato è true.
  pagineConsentite: PaginaId[];
};

// Default per chi non ha ancora nessuna riga in profili_utente: accesso
// pieno, esattamente il comportamento di ogni account prima di questa
// funzione — nessun utente esistente perde qualcosa introducendo il sistema.
const ACCESSO_PIENO: Permessi = { isAdmin: false, accessoLimitato: false, pagineConsentite: [] };

export async function leggiPermessi(
  supabase: SupabaseClient,
  userId: string
): Promise<Permessi> {
  const { data: profilo } = await supabase
    .from("profili_utente")
    .select("is_admin, accesso_limitato")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profilo) return ACCESSO_PIENO;

  if (!profilo.accesso_limitato) {
    return { isAdmin: profilo.is_admin, accessoLimitato: false, pagineConsentite: [] };
  }

  const { data: righe } = await supabase
    .from("permessi_pagina")
    .select("pagina")
    .eq("user_id", userId);

  return {
    isAdmin: profilo.is_admin,
    accessoLimitato: true,
    pagineConsentite: (righe ?? []).map((r) => r.pagina as PaginaId),
  };
}

export function puoVedere(permessi: Permessi, pagina: PaginaId): boolean {
  if (permessi.isAdmin) return true;
  if (!permessi.accessoLimitato) return true;
  return permessi.pagineConsentite.includes(pagina);
}

// Trova a quale pagina "concedibile" appartiene un percorso (es.
// "/ordina/qualcosa" -> "ordina"), o null se il percorso non corrisponde a
// nessuna di queste (es. "/", "/login", "/utenti", "/api/...").
export function paginaDaPercorso(pathname: string): PaginaId | null {
  const trovata = PAGINE.find(
    (p) => pathname === p.href || pathname.startsWith(p.href + "/")
  );
  return trovata?.id ?? null;
}
