# Stato migrazione — Gestionale Ordini Arcobaleno

## Fase 1 — Infrastruttura (in corso)

Fatto (lato Claude, 9 settembre 2026):
- Scaffold Next.js 16 (TypeScript, Tailwind, App Router) con client Supabase
  (browser + server) e middleware di autenticazione
- Pagina di login (magic link via email, nessuna registrazione pubblica —
  solo utenti invitati da Supabase)
- 5 pagine base: Fornitori, Ordina, Pannello, Riepilogo, Confronta
- Schema database completo in `supabase/schema.sql`, **testato end-to-end**
  su Postgres locale prima di consegnarlo (tabelle, calcolo automatico
  sconti a cascata, vista di confronto prezzi, trigger di notifica cambio
  fornitore più conveniente — un bug nel trigger è stato trovato e corretto
  durante il test)

Da fare (lato Mauro):
- [ ] Creare un nuovo progetto Supabase
- [ ] Eseguire `supabase/schema.sql` nell'SQL Editor del progetto
- [ ] Invitare gli utenti autorizzati in Supabase → Authentication → Users
- [ ] Creare repo GitHub `vizzino-art/Gestionale-Arcobaleno` e caricare il
  codice (istruzioni passo-passo fornite in chat)
- [ ] Collegare il repo a Vercel e impostare le variabili d'ambiente da
  `.env.local.example`

## Fase 2 — Migrazione dati (da iniziare)

Portare su Supabase i dati reali attualmente nel foglio Google (ID
`1SPuXpQZ61z2AtIPQpQ_MMUH4VGTCiqkwoYG9ZPyy0aw`): Fornitori, Prodotti,
Categorie, StoricoPrezziFatture. Come per Schio Sub, probabilmente via
script SQL generati da Claude e lanciati da Mauro nell'SQL Editor
(il sandbox cloud di Claude non raggiunge supabase.co direttamente).

## Fase 3 — Ricostruzione UI e logica (da iniziare)

Portare su Ordina/Pannello/Riepilogo tutta la logica esistente in
Codice.gs/StoricoPrezzi.gs: conversione in unità di confezione, calcolo
omaggi, messaggio WhatsApp con data di consegna, storico prezzi visibile
per prodotto.

## Fase 4 — Import automatico fatture da Dropbox (da iniziare)

Il trigger settimanale Apps Script (`aggiornaStoricoPrezziTutti`) diventa
un cron job Vercel che chiama l'API Dropbox e scrive in
`storico_prezzi_fatture` + `file_elaborati`.

## Note tecniche

- **Confronto prezzi automatico** (richiesta di Mauro): la vista
  `v_confronto_categorie` calcola il prezzo al KG di ogni prodotto attivo e
  lo classifica per categoria; `v_miglior_fornitore_per_categoria` espone
  solo il primo. Un trigger su `prodotti` registra in
  `storico_miglior_fornitore` ogni volta che il fornitore più conveniente
  di una categoria cambia — questo alimenta la notifica automatica. Ancora
  da fare: il collegamento prodotto→categoria resta manuale in questa
  fase; l'idea discussa è proporlo automaticamente per descrizione simile,
  da confermare con un click.
- **Autenticazione**: sostituita la whitelist hardcoded in Codice.gs con
  l'elenco utenti di Supabase Auth (nessuna registrazione pubblica, accesso
  passwordless via magic link).
