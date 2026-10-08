-- ============================================================================
-- Buoni Pasto — collega il rendiconto al movimento "pianificato" creato in
-- Prima Nota (richiesto da Mauro l'8/10, dopo crea-buoni-pasto.sql).
-- Da eseguire una volta sola nell'SQL Editor di Supabase.
-- ============================================================================

alter table rendiconti_buoni_pasto
  add column if not exists movimento_pianificato_id uuid references movimenti_prima_nota(id);
