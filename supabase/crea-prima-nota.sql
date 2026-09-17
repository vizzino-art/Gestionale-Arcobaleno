-- ============================================================================
-- Gestionale Ordini Arcobaleno — Prima Nota (Fase 1: base)
-- Da eseguire nell'SQL Editor del progetto Supabase (una volta sola), dopo
-- schema.sql. Aggiunge il registro movimenti multi-conto che sostituisce
-- (in modo incrementale, a partire da questa base) il file Excel
-- "Prima_Nota_Fornitori.xlsx" usato finora fuori dal gestionale.
--
-- Questa è solo la base: tabella conti/movimenti, saldi calcolati,
-- inserimento rapido. L'importazione dello storico (15.932 righe esistenti)
-- e la sincronizzazione automatica con il file Excel su OneDrive sono
-- passi successivi, da fare dopo aver testato questa base.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- CONTI
-- I 6 conti tenuti nel file Excel attuale (colonne C/E/G/I/K/M della scheda
-- PrimaNota). "ordine" decide l'ordine di visualizzazione nelle schermate.
-- ----------------------------------------------------------------------------
create table if not exists conti (
  id      uuid primary key default gen_random_uuid(),
  nome    text not null unique,
  ordine  integer not null default 0
);

insert into conti (nome, ordine) values
  ('Volksbank', 1),
  ('Trento', 2),
  ('Sumup', 3),
  ('Cassa', 4),
  ('Mutuo', 5),
  ('Carta di credito', 6)
on conflict (nome) do nothing;

-- ----------------------------------------------------------------------------
-- MOVIMENTI
-- Un movimento tocca un solo conto (importo positivo = entrata, negativo =
-- uscita). Uno spostamento fra due conti propri (es. versamento contanti in
-- banca, come nel file Excel) diventa DUE righe collegate da
-- trasferimento_id: una in uscita dal conto di partenza, una in entrata nel
-- conto di arrivo — così il saldo di ogni singolo conto resta sempre
-- corretto senza calcoli speciali.
--
-- "stato": effettivo = già avvenuto, entra nel saldo attuale. pianificato =
-- inserito in anticipo (es. una rata futura di un finanziamento) per sapere
-- che liquidità ci sarà: entra solo nel saldo previsto.
-- ----------------------------------------------------------------------------
create table if not exists movimenti_prima_nota (
  id                  uuid primary key default gen_random_uuid(),
  data                date not null,
  causale             text not null,
  conto_id            uuid not null references conti(id),
  importo             numeric(12,2) not null,
  stato               text not null default 'effettivo' check (stato in ('effettivo', 'pianificato')),
  trasferimento_id    uuid,
  note                text,
  created_at          timestamptz not null default now()
);

create index if not exists idx_movimenti_conto_data on movimenti_prima_nota(conto_id, data desc);
create index if not exists idx_movimenti_data on movimenti_prima_nota(data desc);
create index if not exists idx_movimenti_trasferimento
  on movimenti_prima_nota(trasferimento_id) where trasferimento_id is not null;

-- ----------------------------------------------------------------------------
-- SALDI PER CONTO
-- saldo_attuale: solo i movimenti già avvenuti (stato = 'effettivo').
-- saldo_previsto: effettivo + pianificato, cioè quanto resterà considerando
-- anche gli impegni futuri già inseriti (es. le rate messe in programma).
-- ----------------------------------------------------------------------------
create or replace view v_saldi_conti as
select
  c.id as conto_id,
  c.nome as conto_nome,
  c.ordine,
  coalesce(sum(m.importo) filter (where m.stato = 'effettivo'), 0) as saldo_attuale,
  coalesce(sum(m.importo), 0) as saldo_previsto
from conti c
left join movimenti_prima_nota m on m.conto_id = c.id
group by c.id, c.nome, c.ordine
order by c.ordine;

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY (stesso criterio del resto del gestionale: squadra
-- piccola e fidata, chi è autenticato può leggere e scrivere)
-- ----------------------------------------------------------------------------
alter table conti enable row level security;
alter table movimenti_prima_nota enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['conti', 'movimenti_prima_nota']
  loop
    execute format(
      'drop policy if exists "utenti autenticati" on %I;
       create policy "utenti autenticati" on %I
       for all
       using (auth.role() = ''authenticated'')
       with check (auth.role() = ''authenticated'');',
      t, t
    );
  end loop;
end $$;
