-- ============================================================================
-- Gestionale Ordini Arcobaleno — Fresco / Gelo / Ambiente per prodotto
-- (richiesto da Mauro il 17/9, usando Ordina da cellulare)
--
-- Colora solo il riquadro "Magazzino" in Ordina in base a come si conserva
-- il prodotto, indipendentemente dal colore di riga scelto per la categoria.
-- Nullo di proposito sui prodotti esistenti: nessuna riclassificazione
-- automatica indovinata, si assegna con lo strumento "🧊 Fresco/Gelo/Ambiente"
-- in Pannello (o dal modulo Modifica prodotto per i prodotti nuovi).
-- ============================================================================

alter table prodotti
  add column if not exists tipo_conservazione text
  check (tipo_conservazione in ('fresco', 'gelo', 'ambiente'));
