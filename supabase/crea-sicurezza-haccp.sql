-- ============================================================================
-- Modulo Sicurezza + HACCP — PASSO 1: tabelle e catalogo corsi (15/11/2026)
--
-- Scadenzario di corsi sicurezza/HACCP e visite mediche per dipendenti,
-- soci e titolare di Arcobaleno. I dipendenti arriveranno dalle buste paga
-- su Dropbox (passo successivo); soci e titolare si inseriscono a mano.
--
-- Da eseguire UNA volta nell'SQL Editor di Supabase (progetto
-- gestionale-arcobaleno). È idempotente: rilanciarlo non fa danni.
--
-- Differenza voluta rispetto alle altre tabelle del gestionale: qui la RLS
-- NON è "tutti gli autenticati" ma SOLO gli amministratori (is_admin in
-- profili_utente, oggi Mauro e Roberto). Ci sono dati personali dei
-- dipendenti e giudizi di idoneità: un account limitato (es. papà) non li
-- deve poter leggere neanche passando dall'API.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. PERSONE: dipendenti (da busta paga o inseriti a mano) + soci/titolare
-- ----------------------------------------------------------------------------
create table if not exists sic_persone (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'dipendente'
    check (tipo in ('dipendente', 'socio_titolare')),
  cognome text not null,
  nome text not null,
  -- Codice dipendente come compare in busta paga (es. '00066'): serve ad
  -- abbinare in automatico la persona quando si legge il PDF mensile.
  codice_busta text unique,
  mansione text,
  data_assunzione date,
  data_cessazione date,
  -- Scadenza contratto a termine / intermittente (da busta paga).
  fine_contratto date,
  -- Conservazione storico: 10 anni dalla cessazione, poi si valuta a mano.
  -- Nessuna cancellazione automatica.
  conservare_fino_al date generated always as
    ((data_cessazione + interval '10 years')::date) stored,
  -- Incarichi: decidono quali corsi vengono richiesti alla persona.
  datore_lavoro boolean not null default false,
  addetto_antincendio boolean not null default false,
  addetto_primo_soccorso boolean not null default false,
  rls boolean not null default false,
  origine text not null default 'manuale'
    check (origine in ('manuale', 'busta_paga')),
  -- Percorso del contratto su Dropbox, se collegato al momento dell'assunzione.
  contratto_dropbox text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ----------------------------------------------------------------------------
-- 2. CATALOGO CORSI: periodicità e regole, modificabili dall'app
-- ----------------------------------------------------------------------------
create table if not exists sic_corsi (
  id text primary key,
  nome text not null,
  categoria text not null check (categoria in ('sicurezza', 'haccp')),
  -- Validità in mesi; NULL = non scade.
  validita_mesi integer,
  -- Entro quanti giorni dall'assunzione va fatto da un nuovo assunto;
  -- NULL = nessun termine automatico.
  giorni_nuovo_assunto integer,
  -- Scadenza fissa una tantum (es. corso datore di lavoro entro 23/05/2027).
  entro_il date,
  -- A chi è richiesto.
  richiesto_per text not null default 'tutti'
    check (richiesto_per in ('tutti', 'datore_lavoro', 'antincendio',
                             'primo_soccorso', 'rls')),
  -- Se valorizzato, questo corso rinnova quello indicato (es. l'aggiornamento
  -- lavoratori rinnova la formazione specifica: vale il più recente dei due).
  rinnova text references sic_corsi(id),
  ordine integer not null default 0,
  attivo boolean not null default true
);

-- Valori iniziali presi dal foglio SICUREZZA_AGGIORNAMENTO_CORSO e dalla
-- normativa vista insieme. Da confermare con il consulente: si cambiano
-- poi dalla pagina "Catalogo corsi" senza toccare il codice.
insert into sic_corsi (id, nome, categoria, validita_mesi, giorni_nuovo_assunto, entro_il, richiesto_per, rinnova, ordine) values
  ('formazione_generale',      'Formazione generale lavoratori',        'sicurezza', null, 60,   null,         'tutti',          null,                   10),
  ('formazione_specifica',     'Formazione specifica lavoratori',       'sicurezza', 60,   60,   null,         'tutti',          null,                   20),
  ('aggiornamento_lavoratori', 'Aggiornamento lavoratori',              'sicurezza', 60,   null, null,         'tutti',          'formazione_specifica', 30),
  ('antincendio',              'Addetto antincendio',                   'sicurezza', 60,   null, null,         'antincendio',    null,                   40),
  ('primo_soccorso',           'Addetto primo soccorso',                'sicurezza', 36,   null, null,         'primo_soccorso', null,                   50),
  ('rls',                      'RLS',                                   'sicurezza', 12,   null, null,         'rls',            null,                   60),
  ('rspp_datore',              'RSPP datore di lavoro',                 'sicurezza', 60,   null, null,         'datore_lavoro',  null,                   70),
  ('corso_datore_16h',         'Corso datore di lavoro (16 ore)',       'sicurezza', 60,   null, '2027-05-23', 'datore_lavoro',  null,                   80),
  ('haccp_norme',              'HACCP - Norme di comportamento firmate','haccp',     null, 30,   null,         'tutti',          null,                   90),
  ('haccp_alimentaristi',      'HACCP - Formazione alimentaristi',      'haccp',     36,   180,  null,         'tutti',          null,                  100)
on conflict (id) do nothing;


-- ----------------------------------------------------------------------------
-- 3. CORSI FATTI
-- ----------------------------------------------------------------------------
create table if not exists sic_formazioni (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references sic_persone(id) on delete cascade,
  corso_id text not null references sic_corsi(id),
  -- 'in_corso' serve per casi come "corso online attivato" non ancora finito.
  stato text not null default 'completato'
    check (stato in ('completato', 'in_corso')),
  data_corso date,
  -- Calcolata dall'app (data_corso + validità), ma modificabile a mano.
  scadenza date,
  ente text,
  ore numeric(5,1),
  -- Percorso del PDF nello Storage (bucket creato al passo degli attestati).
  attestato_path text,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  check (stato = 'in_corso' or data_corso is not null)
);
create index if not exists sic_formazioni_persona_idx on sic_formazioni(persona_id);


-- ----------------------------------------------------------------------------
-- 4. VISITE MEDICHE — solo dati amministrativi, nessun dato sanitario
-- ----------------------------------------------------------------------------
create table if not exists sic_visite (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references sic_persone(id) on delete cascade,
  tipo text not null default 'periodica'
    check (tipo in ('preventiva', 'periodica', 'su_richiesta', 'rientro')),
  data_visita date not null,
  giudizio text
    check (giudizio in ('idoneo', 'idoneo_con_prescrizioni',
                        'non_idoneo_temporaneo', 'non_idoneo_permanente')),
  -- Indicata dal medico competente.
  prossima_scadenza date,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);
create index if not exists sic_visite_persona_idx on sic_visite(persona_id);


-- ----------------------------------------------------------------------------
-- 5. REGISTRO EMAIL INVIATE — evita di mandare due volte lo stesso avviso
-- ----------------------------------------------------------------------------
create table if not exists sic_notifiche_log (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid references sic_persone(id) on delete cascade,
  -- Cosa riguarda: un corso del catalogo oppure la visita medica.
  oggetto text not null,
  tipo_avviso text not null check (tipo_avviso in ('3_mesi', 'scaduto', 'richiamo')),
  scadenza date not null,
  inviata_il timestamptz not null default now()
);
create index if not exists sic_notifiche_log_idx
  on sic_notifiche_log(persona_id, oggetto, tipo_avviso, scadenza);


-- ----------------------------------------------------------------------------
-- 6. SICUREZZA (RLS): solo amministratori
-- ----------------------------------------------------------------------------
alter table sic_persone       enable row level security;
alter table sic_corsi         enable row level security;
alter table sic_formazioni    enable row level security;
alter table sic_visite        enable row level security;
alter table sic_notifiche_log enable row level security;

-- Funzione di appoggio: true se l'utente collegato è amministratore.
-- security definer + search_path fisso (come da correzioni Security Advisor).
create or replace function sic_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profili_utente
    where user_id = (select auth.uid()) and is_admin
  );
$$;

do $$
declare
  t text;
begin
  foreach t in array array['sic_persone', 'sic_corsi', 'sic_formazioni',
                           'sic_visite', 'sic_notifiche_log']
  loop
    execute format('drop policy if exists "solo admin" on %I', t);
    execute format(
      'create policy "solo admin" on %I for all to authenticated '
      'using ((select sic_is_admin())) with check ((select sic_is_admin()))', t);
  end loop;
end $$;
