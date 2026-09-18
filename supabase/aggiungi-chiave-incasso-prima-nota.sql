-- ============================================================================
-- Gestionale Ordini Arcobaleno — Prima Nota: importazione incassi giornalieri
-- da Google Sheet (richiesto da Mauro il 18/9)
-- Da eseguire nell'SQL Editor del progetto Supabase (una volta sola), dopo
-- crea-prima-nota.sql.
--
-- Quando si preme "Importa incassi" in Prima Nota, l'app legge il foglio
-- Google "2026 - Corrispettivi IVA 10%" e crea un movimento per ogni
-- incasso giornaliero diverso da zero (SumUp, Mastercard, Visa, Bancomat,
-- Contanti). Questa colonna tiene un riferimento univoco per ogni singola
-- combinazione giorno+tipo di incasso, così premere di nuovo il bottone
-- aggiorna il movimento esistente (se l'importo sul foglio è cambiato)
-- invece di crearne uno duplicato.
-- ============================================================================

alter table movimenti_prima_nota
  add column if not exists chiave_incasso text unique;
