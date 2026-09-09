# Gestionale Ordini Arcobaleno

Migrazione del gestionale ordini/fornitori/storico prezzi di Pizzeria
Arcobaleno da Google Apps Script + Sheets a Next.js + Supabase (stesso
percorso tecnico già usato per il gestionale di Schio Sub).

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind)
- **Supabase** — database Postgres, autenticazione (magic link, solo utenti
  invitati), storage
- **Vercel** — hosting + cron job per l'import automatico delle fatture da
  Dropbox

## Struttura

- `src/app/(app)/` — le 5 sezioni: Fornitori, Ordina, Pannello, Riepilogo,
  Confronta (dietro login, vedi `src/middleware.ts`)
- `src/app/login/` — pagina di accesso
- `src/lib/supabase/` — client Supabase (browser e server)
- `supabase/schema.sql` — schema del database: tabelle, calcolo automatico
  degli sconti a cascata, vista di confronto prezzi tra fornitori, log delle
  variazioni del fornitore più conveniente

## Setup

1. `npm install`
2. Creare un progetto Supabase, poi eseguire `supabase/schema.sql`
   nell'SQL Editor
3. Copiare `.env.local.example` in `.env.local` e compilare con le chiavi
   del progetto Supabase
4. In Supabase → Authentication → Users, invitare manualmente gli utenti
   autorizzati (niente registrazione pubblica)
5. `npm run dev`

## Stato

Vedi `stato-migrazione.md` per lo stato di avanzamento della migrazione.
