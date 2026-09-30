-- Collegamento manuale bolla <-> fattura elettronica, per i casi in cui il
-- confronto automatico (numero DDT letto dalla bolla vs numero/DDT della
-- fattura elettronica) non riesce ad abbinarli da solo — es. numeri di DDT
-- scritti in modo troppo diverso tra loro. Una riga per bolla collegata:
-- una bolla può essere collegata a una sola fattura per volta, ma una
-- fattura può avere più bolle collegate (es. fattura riepilogativa mensile
-- su più DDT).
create table if not exists collegamenti_bolla_fattura (
  id uuid primary key default gen_random_uuid(),
  fornitore_id uuid not null references fornitori(id),
  numero_ddt text not null,
  data_ddt date not null,
  fattura_id uuid not null references fatture_ricevute(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (fornitore_id, numero_ddt, data_ddt)
);

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY (stesso criterio del resto del gestionale: squadra
-- piccola e fidata, chi è autenticato può leggere e scrivere)
-- ----------------------------------------------------------------------------
alter table collegamenti_bolla_fattura enable row level security;

drop policy if exists "utenti autenticati" on collegamenti_bolla_fattura;
create policy "utenti autenticati" on collegamenti_bolla_fattura
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
