-- ============================================================================
-- Gestionale Ordini Arcobaleno — correzioni Security Advisor (18/9)
-- Stesso identico schema già applicato con successo il 10/9 alle altre viste
-- e funzioni: qui mancava solo su v_saldi_conti (creata dopo, per Prima
-- Nota) e su unisci_prodotti (creata dopo, per "Prodotti doppi").
-- ============================================================================

-- ERRORE "Security Definer View": senza security_invoker=true la vista
-- viene eseguita con i permessi dell'admin invece che dell'utente
-- collegato, bypassando la Row Level Security.
alter view public.v_saldi_conti set (security_invoker = true);

-- WARNING "Function Search Path Mutable": cerca la funzione per nome
-- (qualunque sia la sua firma esatta, senza doverla indovinare) e le
-- fissa un search_path esplicito.
do $$
declare
  sig text;
begin
  select p.oid::regprocedure::text into sig
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'unisci_prodotti';

  if sig is not null then
    execute format('alter function %s set search_path = public', sig);
  end if;
end $$;
