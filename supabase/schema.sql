-- ============================================================================
-- Gestionale Ordini Arcobaleno — schema iniziale Supabase
-- Da eseguire nell'SQL Editor del progetto Supabase (una volta sola).
-- Traduzione in tabelle relazionali del foglio Google Sheets attuale
-- (Fornitori, Prodotti, Categorie, StoricoPrezzi/StoricoPrezziFatture,
-- StoricoOrdini, FileElaborati).
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- FORNITORI
-- ----------------------------------------------------------------------------
create table if not exists fornitori (
  id                uuid primary key default gen_random_uuid(),
  nome              text not null,
  telefono          text,
  email             text,
  note              text,
  piva              text,
  prefisso_file     text,        -- prefisso usato per riconoscere le fatture su Dropbox
  giorno_consegna   smallint,    -- 1=lunedì ... 7=domenica
  ordine            integer not null default 0,  -- ordinamento manuale (frecce ▲▼)
  created_at        timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- CATEGORIE (per confronto prezzi tra fornitori)
-- ----------------------------------------------------------------------------
create table if not exists categorie (
  id      uuid primary key default gen_random_uuid(),
  nome    text not null unique
);

-- ----------------------------------------------------------------------------
-- PRODOTTI
-- ----------------------------------------------------------------------------
create table if not exists prodotti (
  id                    uuid primary key default gen_random_uuid(),
  fornitore_id          uuid not null references fornitori(id) on delete cascade,
  categoria_id          uuid references categorie(id) on delete set null,
  codice_articolo       text,
  descrizione           text not null,

  -- prezzo di listino + sconti a cascata (fino a 3), come nel foglio attuale
  prezzo_listino        numeric(10,4),
  sconto1               numeric(5,2),
  sconto2               numeric(5,2),
  sconto3               numeric(5,2),
  prezzo_unitario       numeric(10,4), -- netto, ricalcolato automaticamente (vedi trigger sotto)

  um                    text,          -- unità di misura di acquisto (es. KG, PZ, CT)
  pezzi_per_confezione  numeric(10,2), -- per conversione in unità d'ordine reale
  um_confezione         text,
  peso_kg_per_unita     numeric(10,4), -- per normalizzare il confronto tra fornitori diversi

  quantita_obiettivo    numeric(10,2),
  magazzino_attuale     numeric(10,2),

  omaggio_ogni          numeric(10,2), -- "ogni X ordinate, Y in omaggio"
  omaggio_gratis        numeric(10,2),

  attivo                boolean not null default true,
  ordine                integer not null default 0,
  data_aggiornamento    timestamptz not null default now()
);

create index if not exists idx_prodotti_fornitore on prodotti(fornitore_id);
create index if not exists idx_prodotti_categoria on prodotti(categoria_id);

-- ----------------------------------------------------------------------------
-- STORICO PREZZI DA FATTURA (import da Dropbox)
-- ----------------------------------------------------------------------------
create table if not exists storico_prezzi_fatture (
  id                uuid primary key default gen_random_uuid(),
  prodotto_id       uuid references prodotti(id) on delete cascade,
  fornitore_id      uuid not null references fornitori(id) on delete cascade,
  data              date not null,
  numero_fattura    text,
  prezzo            numeric(10,4) not null,
  quantita          numeric(10,2),
  created_at        timestamptz not null default now()
);

create index if not exists idx_storico_prezzi_prodotto_data
  on storico_prezzi_fatture(prodotto_id, data desc);

-- ----------------------------------------------------------------------------
-- STORICO ORDINI
-- ----------------------------------------------------------------------------
create table if not exists storico_ordini (
  id            uuid primary key default gen_random_uuid(),
  prodotto_id   uuid references prodotti(id) on delete set null,
  data          date not null default current_date,
  quantita      numeric(10,2),
  note          text,
  created_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- FILE ELABORATI (per non rielaborare due volte la stessa fattura Dropbox)
-- ----------------------------------------------------------------------------
create table if not exists file_elaborati (
  id                  uuid primary key default gen_random_uuid(),
  fornitore_id        uuid not null references fornitori(id) on delete cascade,
  nome_file           text not null,
  data_elaborazione   timestamptz not null default now(),
  unique (fornitore_id, nome_file)
);

-- ----------------------------------------------------------------------------
-- STORICO "MIGLIOR FORNITORE" PER CATEGORIA
-- Log di quando cambia il fornitore più conveniente in una categoria:
-- alimenta la notifica automatica (vedi trigger più sotto).
-- ----------------------------------------------------------------------------
create table if not exists storico_miglior_fornitore (
  id              uuid primary key default gen_random_uuid(),
  categoria_id    uuid not null references categorie(id) on delete cascade,
  fornitore_id    uuid not null references fornitori(id),
  prezzo_per_kg   numeric(10,4),
  rilevato_il     timestamptz not null default now()
);

create index if not exists idx_storico_miglior_categoria
  on storico_miglior_fornitore(categoria_id, rilevato_il desc);

-- ============================================================================
-- AUTOMAZIONE 1 — ricalcolo del prezzo netto (sconti a cascata)
-- Ogni volta che cambia prezzo_listino/sconto1/2/3, prezzo_unitario si
-- ricalcola da solo: elimina il calcolo manuale che c'era nel foglio.
-- ============================================================================
create or replace function calcola_prezzo_unitario()
returns trigger as $$
begin
  new.prezzo_unitario :=
    coalesce(new.prezzo_listino, 0)
    * (1 - coalesce(new.sconto1, 0) / 100.0)
    * (1 - coalesce(new.sconto2, 0) / 100.0)
    * (1 - coalesce(new.sconto3, 0) / 100.0);
  new.data_aggiornamento := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_calcola_prezzo_unitario on prodotti;
create trigger trg_calcola_prezzo_unitario
  before insert or update of prezzo_listino, sconto1, sconto2, sconto3
  on prodotti
  for each row
  execute function calcola_prezzo_unitario();

-- ============================================================================
-- AUTOMAZIONE 2 — confronto prezzi automatico tra fornitori
-- Vista sempre aggiornata con il prezzo al KG di ogni prodotto attivo,
-- e la posizione in classifica dentro la sua categoria (1 = più conveniente).
-- Questa alimenta il suggerimento automatico in Ordina/Pannello.
-- ============================================================================
create or replace view v_confronto_categorie as
select
  c.id as categoria_id,
  c.nome as categoria_nome,
  p.id as prodotto_id,
  p.descrizione,
  p.fornitore_id,
  f.nome as fornitore_nome,
  p.prezzo_unitario,
  p.peso_kg_per_unita,
  case when p.peso_kg_per_unita > 0
       then round(p.prezzo_unitario / p.peso_kg_per_unita, 4)
       else null
  end as prezzo_per_kg,
  rank() over (
    partition by c.id
    order by (case when p.peso_kg_per_unita > 0
                    then p.prezzo_unitario / p.peso_kg_per_unita
                    else p.prezzo_unitario
              end) asc nulls last
  ) as posizione
from prodotti p
join categorie c on c.id = p.categoria_id
join fornitori f on f.id = p.fornitore_id
where p.attivo = true;

-- Solo il fornitore più conveniente per categoria (per il pannello/notifiche)
create or replace view v_miglior_fornitore_per_categoria as
select *
from v_confronto_categorie
where posizione = 1;

-- ----------------------------------------------------------------------------
-- Trigger: ogni volta che arriva un nuovo prezzo prodotto, ricontrolla se il
-- "migliore" della sua categoria è cambiato e, se sì, lo registra in
-- storico_miglior_fornitore (da qui parte la notifica in app).
-- ----------------------------------------------------------------------------
create or replace function aggiorna_miglior_fornitore()
returns trigger as $$
declare
  v_categoria_id uuid;
  v_nuovo_migliore record;
  v_ultimo_registrato record;
begin
  select categoria_id into v_categoria_id from prodotti where id = new.id;

  if v_categoria_id is null then
    return new;
  end if;

  select fornitore_id, prezzo_per_kg
    into v_nuovo_migliore
    from v_miglior_fornitore_per_categoria
    where categoria_id = v_categoria_id
    limit 1;

  if v_nuovo_migliore is null then
    return new;
  end if;

  select fornitore_id
    into v_ultimo_registrato
    from storico_miglior_fornitore
    where categoria_id = v_categoria_id
    order by rilevato_il desc
    limit 1;

  if v_ultimo_registrato is null
     or v_ultimo_registrato.fornitore_id is distinct from v_nuovo_migliore.fornitore_id then
    insert into storico_miglior_fornitore (categoria_id, fornitore_id, prezzo_per_kg)
    values (v_categoria_id, v_nuovo_migliore.fornitore_id, v_nuovo_migliore.prezzo_per_kg);
  end if;

  return new;
end;
$$ language plpgsql;

-- NB: nessun filtro "of <colonne>" di proposito. prezzo_unitario cambia
-- indirettamente (via trg_calcola_prezzo_unitario quando si tocca
-- prezzo_listino/sconto1/2/3), e "update of X" in Postgres scatta in base
-- alle colonne nella SET della query originale, non al valore finale dopo
-- gli altri trigger — quindi un filtro qui perderebbe questi casi.
drop trigger if exists trg_aggiorna_miglior_fornitore on prodotti;
create trigger trg_aggiorna_miglior_fornitore
  after insert or update
  on prodotti
  for each row
  execute function aggiorna_miglior_fornitore();

-- ============================================================================
-- STORICO PREZZI PER PRODOTTO (ultimo pagato + minimo storico)
-- Alimenta la card prodotto in Ordina: "Ultimo pagato: €X · Minimo: €Y".
-- ============================================================================
-- NB: esclude le righe a prezzo 0 (es. Birra Ingross registra l'omaggio come
-- riga duplicata dello stesso prodotto a prezzo 0, "Sconto merce"/#SM#): non
-- sono prezzi reali pagati, stesso criterio già usato nel vecchio gestionale.
create or replace view v_storico_prodotto as
select
  s.prodotto_id,
  s.ultimo_pagato,
  s.ultimo_pagato_data,
  m.prezzo_minimo
from (
  select distinct on (prodotto_id)
    prodotto_id, prezzo as ultimo_pagato, data as ultimo_pagato_data
  from storico_prezzi_fatture
  where prodotto_id is not null and prezzo > 0
  order by prodotto_id, data desc, created_at desc
) s
join (
  select prodotto_id, min(prezzo) as prezzo_minimo
  from storico_prezzi_fatture
  where prodotto_id is not null and prezzo > 0
  group by prodotto_id
) m using (prodotto_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- Squadra piccola e fidata: chiunque sia autenticato (utenti invitati da
-- Supabase, niente registrazione pubblica) può leggere e scrivere.
-- ============================================================================
alter table fornitori enable row level security;
alter table categorie enable row level security;
alter table prodotti enable row level security;
alter table storico_prezzi_fatture enable row level security;
alter table storico_ordini enable row level security;
alter table file_elaborati enable row level security;
alter table storico_miglior_fornitore enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'fornitori', 'categorie', 'prodotti', 'storico_prezzi_fatture',
    'storico_ordini', 'file_elaborati', 'storico_miglior_fornitore'
  ]
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
