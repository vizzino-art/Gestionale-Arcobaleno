-- Sistema permessi per pagina (punto 13 + accesso Corrispettivi, deciso il 19/9).
--
-- Filosofia: per default OGNI utente vede tutto il gestionale, esattamente
-- come oggi — nessuna riga in profili_utente = accesso pieno, quindi questa
-- migrazione non toglie nulla a nessun account esistente. Un amministratore
-- può poi "limitare" un utente specifico dalla pagina Utenti: da quel
-- momento quell'utente vede SOLO le pagine che gli sono state spuntate.
--
-- "Utenti" (la pagina che gestisce questi permessi) non è mai una pagina
-- "concedibile": la vedono solo gli amministratori, indipendentemente da
-- qualsiasi riga qui dentro — vedi src/lib/permessi.ts.

create table if not exists profili_utente (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  is_admin boolean not null default false,
  accesso_limitato boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists permessi_pagina (
  user_id uuid not null references profili_utente(user_id) on delete cascade,
  pagina text not null,
  primary key (user_id, pagina)
);

alter table profili_utente enable row level security;
alter table permessi_pagina enable row level security;

-- Ogni utente autenticato può leggere SOLO la propria riga (serve al
-- gestionale per sapere se stesso è admin / ha accesso limitato / quali
-- pagine vede). La gestione dei permessi di ALTRI utenti (pagina Utenti)
-- passa sempre da un Route Handler lato server con la Service Role, mai
-- da qui — per questo non serve nessuna policy di insert/update/delete.
drop policy if exists "utenti leggono il proprio profilo" on profili_utente;
create policy "utenti leggono il proprio profilo"
  on profili_utente for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "utenti leggono i propri permessi pagina" on permessi_pagina;
create policy "utenti leggono i propri permessi pagina"
  on permessi_pagina for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Amministratori iniziali (19/9): Mauro e suo fratello Roberto. Idempotente
-- e sicuro anche se uno dei due account non ha ancora un login su
-- Supabase — in quel caso semplicemente non seleziona nessuna riga per
-- quell'email, senza errori; va rilanciata dopo aver creato il login.
insert into profili_utente (user_id, email, is_admin)
select id, email, true
from auth.users
where email in ('vizzino@gmail.com', 'vizzinoroberto@gmail.com')
on conflict (user_id) do update set is_admin = true;
