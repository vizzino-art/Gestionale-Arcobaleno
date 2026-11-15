-- ============================================================================
-- Modulo Sicurezza + HACCP — PASSO 4: registro delle buste paga lette (15/11/2026)
--
-- Ogni PDF mensile delle buste paga letto da Dropbox viene annotato qui, così
-- non viene riletto due volte e nella pagina si vede "ultima busta letta".
-- Da eseguire UNA volta nell'SQL Editor di Supabase. Idempotente.
-- ============================================================================

create table if not exists sic_buste_lette (
  id uuid primary key default gen_random_uuid(),
  percorso text not null unique,          -- percorso del PDF su Dropbox
  content_hash text,                      -- se il file cambia, viene riletto
  anno integer,
  mese integer,
  dipendenti integer not null default 0,  -- pagine/dipendenti trovati
  nuovi integer not null default 0,       -- persone create
  aggiornati integer not null default 0,  -- persone modificate
  avvisi text,                            -- problemi di lettura, se ci sono
  letta_il timestamptz not null default now()
);

alter table sic_buste_lette enable row level security;

drop policy if exists "solo admin" on sic_buste_lette;
create policy "solo admin" on sic_buste_lette for all to authenticated
  using ((select sic_is_admin())) with check ((select sic_is_admin()));
