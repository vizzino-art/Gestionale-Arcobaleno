-- ============================================================================
-- Gestionale Ordini Arcobaleno — Prima Nota: collegamento coi pagamenti
-- fatture (punto 23, richiesto da Mauro il 17/9)
-- Da eseguire nell'SQL Editor del progetto Supabase (una volta sola), dopo
-- crea-prima-nota.sql.
--
-- Quando Mauro segna una rata come pagata in Registro Fatture, l'app crea
-- (o aggiorna) automaticamente un movimento collegato in Prima Nota, con
-- causale standard "<fornitore> SF <numero> del <data>". Questa colonna
-- tiene il collegamento uno-a-uno fra rata e movimento, così se Mauro
-- corregge data/metodo di un pagamento già registrato, il movimento in
-- Prima Nota si aggiorna invece di duplicarsi.
-- ============================================================================

alter table movimenti_prima_nota
  add column if not exists rata_pagamento_id uuid references rate_pagamento_fatture(id) on delete set null;

-- Un solo movimento per rata: rende possibile l'upsert (onConflict) usato
-- dall'app invece di dover cercare/cancellare a mano il movimento precedente.
-- Vincolo unico NON parziale di proposito (niente "where ... is not null"):
-- Postgres tratta più NULL come sempre distinti tra loro, quindi i tanti
-- movimenti inseriti a mano (rata_pagamento_id = null) restano comunque
-- liberi di convivere — il vincolo blocca solo due righe con lo STESSO id
-- di rata. Una versione "parziale" dell'indice non sarebbe invece
-- utilizzabile dall'upsert di Supabase, che genera un semplice
-- "on conflict (rata_pagamento_id)" senza poter ripetere il predicato.
create unique index if not exists idx_movimenti_rata_pagamento_unica
  on movimenti_prima_nota(rata_pagamento_id);
