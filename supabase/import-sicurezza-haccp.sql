-- ============================================================================
-- Modulo Sicurezza + HACCP — PASSO 2: import dati iniziali (15/11/2026)
-- Fonti: foglio SICUREZZA AGGIORNAMETO CORSO.xlsx, buste paga (date assunzione/
-- cessazione, codici), attestati in Dropbox /Arcobaleno/Sicurezza (verificati
-- uno per uno). ID fissi: rilanciarlo non crea doppioni.
-- ============================================================================

insert into sic_persone (id, tipo, cognome, nome, codice_busta, mansione, data_assunzione, data_cessazione, fine_contratto, datore_lavoro, addetto_antincendio, addetto_primo_soccorso, rls, origine, note) values
  ('74ebf4bf-31df-5865-b982-45ee7cbe19d7', 'socio_titolare', 'Farina', 'Ivana', null, 'Titolare - Datore di lavoro / RSPP', null, null, null, true, false, false, false, 'manuale', 'Titolare e OSA (manuale HACCP)'),
  ('ef2ec85e-9e9c-56ac-85f0-d74e89b7f975', 'socio_titolare', 'Vizzino', 'Francesco', null, 'Socio lavoratore', null, null, null, false, false, false, false, 'manuale', 'Socio che lavora in pizzeria: obblighi da lavoratore'),
  ('d515cd62-69e6-5b16-9273-c08d7a2bd1d7', 'dipendente', 'Canton', 'Enrico', '00002', 'Aiuto Pizzaiolo', '2012-10-06', null, null, false, false, false, false, 'busta_paga', null),
  ('011b8df5-82aa-549b-bbbd-545f83137f56', 'dipendente', 'Vizzino', 'Roberto', '00007', 'Resp. Addetto alla Sala', '2015-04-14', null, null, false, false, false, false, 'busta_paga', null),
  ('e7d95c99-42b7-5d19-b0d5-d7982a5f7769', 'dipendente', 'Pupa', 'Lulzim', '00008', 'Cuoco', '2015-06-01', null, null, false, false, false, false, 'busta_paga', null),
  ('4d10b4c0-5bc1-51b5-9e73-b500dec640d0', 'dipendente', 'Vizzino', 'Mauro', '00012', 'Pizzaiolo/Addetto alla Sala', '2016-01-01', null, null, false, true, true, true, 'busta_paga', 'Responsabile Piano di Autocontrollo HACCP'),
  ('3f9f500a-b7a1-5294-9fe1-1c8e47c39c23', 'dipendente', 'Cestaro', 'Ramona Daiana', '00033', 'Cameriera', '2021-07-20', null, null, false, false, false, false, 'busta_paga', null),
  ('c3c5c427-4120-5452-adc2-63eee840f9dc', 'dipendente', 'Nascinguerra', 'Giulia', '00037', 'Aiuto Cameriera', '2022-05-21', null, null, false, false, false, false, 'busta_paga', null),
  ('b571f732-1e6f-5a02-81a4-3227ddb26a0a', 'dipendente', 'Daoudi', 'Saadia', '00044', 'Commis di cucina', '2023-02-01', null, null, false, false, false, false, 'busta_paga', null),
  ('1de05f8c-a71c-53c8-bf74-483eb6ba8c3e', 'dipendente', 'Tondo', 'Sara', '00045', 'Commis di sala', '2023-03-06', null, null, false, false, false, false, 'busta_paga', null),
  ('bc1963a1-611b-56bc-a3fd-eda5ef7ddfbb', 'dipendente', 'Guderzo', 'Lisa', '00053', 'Addetta alle pulizie', '2023-10-21', null, null, false, false, false, false, 'busta_paga', null),
  ('14beef79-1226-5507-82e4-2b5974eda188', 'dipendente', 'Orlando', 'Mattia', '00055', 'Addetto pulizie e lavapiatti', '2023-11-01', null, null, false, false, false, false, 'busta_paga', null),
  ('eaea3469-4636-5c56-9d29-2afd7f675eb2', 'dipendente', 'Pontarollo', 'Ilaria', '00057', 'Aiuto cameriera', '2024-05-16', null, null, false, false, false, false, 'busta_paga', null),
  ('9ac88ca4-ef12-571b-a207-b0e01e04ec30', 'dipendente', 'Grego', 'Marco', '00060', 'Cameriere', '2025-02-01', null, null, false, false, false, false, 'busta_paga', 'Formazione generale/specifica precedente non documentata (presente solo aggiornamento 2024)'),
  ('7a833506-fc07-5f61-9875-eed1e7fd9643', 'dipendente', 'Novello', 'Francesca', '00061', 'Cameriera', '2025-06-01', null, null, false, false, false, false, 'busta_paga', null),
  ('f0e40658-eb44-57dd-8480-ef6f3439bf97', 'dipendente', 'Pagliarusco', 'Benedetta', '00065', 'Cameriera (intermittente)', '2025-10-03', null, '2026-12-31', false, false, false, false, 'busta_paga', null),
  ('1ec202ef-5e43-5447-ae62-676294ccf8b5', 'dipendente', 'Petkovic', 'Luka', '00066', 'Aiuto pizzaiolo (intermittente)', '2026-02-07', null, '2026-12-31', false, false, false, false, 'busta_paga', null),
  ('c46bde84-1b6e-54d6-9380-6707eb3c0093', 'dipendente', 'Cavalli', 'Nicole', '00068', 'Aiuto Cameriera (intermittente)', '2026-10-01', null, '2027-04-30', false, false, false, false, 'busta_paga', null),
  ('7108c5e2-6554-5cf2-a6f1-68d67fc6099e', 'dipendente', 'Nascinguerra', 'Aurora', '00040', 'Aiuto Cameriera', '2022-10-08', '2026-09-04', null, false, false, false, false, 'busta_paga', null),
  ('4b72cfe4-06ed-5ccf-bc64-f34dbe000946', 'dipendente', 'Mezzalira', 'Lara', '00047', 'Aiuto Cameriera', '2023-05-18', '2025-01-02', null, false, false, false, false, 'busta_paga', null),
  ('bd279fc6-027b-5e63-bc7c-3f9ea4f15702', 'dipendente', 'Vivian', 'Ilaria', '00054', 'Cameriera', '2023-10-21', '2025-02-26', null, false, false, false, false, 'busta_paga', null)
on conflict (id) do nothing;

insert into sic_formazioni (id, persona_id, corso_id, stato, data_corso, scadenza, ente, ore, attestato_path, note) values
  ('4513204a-be22-5871-ab32-041a8c96bea5', '74ebf4bf-31df-5865-b982-45ee7cbe19d7', 'rspp_datore', 'completato', '2021-05-22', '2026-05-22', 'FAD', 6, '/Arcobaleno/Sicurezza/Corso_RSPP_Farina_Ivana.pdf', 'Aggiornamento datore di lavoro RSPP rischio basso'),
  ('744f8dbc-a752-5c93-8086-fdd802874874', '4d10b4c0-5bc1-51b5-9e73-b500dec640d0', 'formazione_generale', 'completato', '2016-01-25', null, null, null, null, null),
  ('535d0815-faf4-5964-bc78-f46db5dbb711', '4d10b4c0-5bc1-51b5-9e73-b500dec640d0', 'formazione_specifica', 'completato', '2016-01-25', '2021-01-25', null, null, null, null),
  ('bcbd5b6f-e17f-5aec-9132-4bbfd051894e', '4d10b4c0-5bc1-51b5-9e73-b500dec640d0', 'aggiornamento_lavoratori', 'completato', '2021-05-21', '2026-05-21', 'FAD', null, '/Arcobaleno/Sicurezza/Corso_Sicurezza_Vizzino_Mauro.pdf', null),
  ('dfd04835-27e3-5d14-b813-0ae0446cb35c', '4d10b4c0-5bc1-51b5-9e73-b500dec640d0', 'rls', 'completato', '2024-04-11', '2025-04-11', 'E-learning', 4, '/Arcobaleno/Sicurezza/RLS_Mauro_Vizzino.pdf', 'Aggiornamento RLS'),
  ('dbf5cff1-7909-5ff6-a85d-38bbf97f340d', '4d10b4c0-5bc1-51b5-9e73-b500dec640d0', 'antincendio', 'completato', '2024-04-04', '2029-04-04', 'Confcommercio Bassano', 2, '/Arcobaleno/Sicurezza/Corso_Antincendio_Mauro_Vizzino.pdf', 'Aggiornamento addetto antincendio livello 1'),
  ('0b39d38d-6ffd-568c-91b9-d65c9ba6543c', '4d10b4c0-5bc1-51b5-9e73-b500dec640d0', 'primo_soccorso', 'completato', '2024-02-05', '2027-02-05', null, null, null, 'Attestato non trovato su Dropbox'),
  ('7355d5ef-3028-528e-8b79-51f5b6b7afb0', '011b8df5-82aa-549b-bbbd-545f83137f56', 'formazione_generale', 'completato', '2016-01-25', null, null, null, null, null),
  ('7a126ce8-dbca-5c2d-baaf-066f77bd9242', '011b8df5-82aa-549b-bbbd-545f83137f56', 'formazione_specifica', 'completato', '2016-01-25', '2021-01-25', null, null, null, null),
  ('f2d3ffbb-431f-5a5e-9aa5-ce7e9babadeb', '011b8df5-82aa-549b-bbbd-545f83137f56', 'aggiornamento_lavoratori', 'completato', '2021-05-20', '2026-05-20', 'FAD', null, '/Arcobaleno/Sicurezza/Corso_Sicurezza_Vizzino_Roberto.pdf', null),
  ('a8d46284-7d55-591c-8cf4-5fb0fc9bab10', 'ef2ec85e-9e9c-56ac-85f0-d74e89b7f975', 'formazione_generale', 'completato', '2012-11-19', null, null, null, null, null),
  ('40e9b24a-fb67-5fc0-b65f-499773500fdc', 'ef2ec85e-9e9c-56ac-85f0-d74e89b7f975', 'formazione_specifica', 'completato', '2012-11-19', '2017-11-19', null, null, null, null),
  ('45560abd-6288-56ed-a65c-1cd2b405a5ac', 'ef2ec85e-9e9c-56ac-85f0-d74e89b7f975', 'aggiornamento_lavoratori', 'completato', '2024-03-22', '2029-03-22', 'E-learning', 6, '/Arcobaleno/Sicurezza/Corso_Sicurezza_Vizzino_Francesco.pdf', null),
  ('808c6ce6-7d11-5e5e-be61-debe0a31ca41', 'e7d95c99-42b7-5d19-b0d5-d7982a5f7769', 'formazione_generale', 'completato', '2016-01-25', null, null, null, null, null),
  ('2f059cff-c02d-5084-8f4a-ea7114e4e976', 'e7d95c99-42b7-5d19-b0d5-d7982a5f7769', 'formazione_specifica', 'completato', '2016-01-25', '2021-01-25', null, null, null, null),
  ('dd25eac9-051d-5783-a003-46b0d63ed543', 'e7d95c99-42b7-5d19-b0d5-d7982a5f7769', 'aggiornamento_lavoratori', 'completato', '2021-06-02', '2026-06-02', 'FAD', null, '/Arcobaleno/Sicurezza/Corso_Sicurezza_Lulzim_Pupa.pdf', null),
  ('aa76584e-dbc1-52d6-8cc3-fd325ed5e781', 'd515cd62-69e6-5b16-9273-c08d7a2bd1d7', 'formazione_generale', 'completato', '2012-11-16', null, null, null, null, null),
  ('c0df1428-1e06-5eaa-89c7-46b4fba2d504', 'd515cd62-69e6-5b16-9273-c08d7a2bd1d7', 'formazione_specifica', 'completato', '2012-11-16', '2017-11-16', null, null, null, null),
  ('574258d1-47af-5d24-a2d2-bfe5a3e85df8', 'd515cd62-69e6-5b16-9273-c08d7a2bd1d7', 'aggiornamento_lavoratori', 'completato', '2024-03-31', '2029-03-31', 'E-learning', 6, '/Arcobaleno/Sicurezza/Corso_Sicurezza_Canton_Enrico.pdf', null),
  ('6bdf0c11-3e97-5e09-8e52-75df8d3a129c', 'f0e40658-eb44-57dd-8480-ef6f3439bf97', 'formazione_generale', 'completato', '2018-12-08', null, null, null, null, null),
  ('a4332853-6523-5b4b-a8ce-d7164f238148', 'f0e40658-eb44-57dd-8480-ef6f3439bf97', 'formazione_specifica', 'completato', '2018-12-08', '2023-12-08', null, null, null, null),
  ('bdbcf774-9077-54dd-b93d-eb7ef567c8c9', 'f0e40658-eb44-57dd-8480-ef6f3439bf97', 'aggiornamento_lavoratori', 'completato', '2024-04-01', '2029-04-01', 'E-learning', 6, '/Arcobaleno/Sicurezza/Corso_Sicurezza_Pagliarusco_Benedetta.pdf', null),
  ('43c3e626-1ffd-5668-a751-9a58776ceddd', 'c3c5c427-4120-5452-adc2-63eee840f9dc', 'formazione_generale', 'completato', '2020-04-01', null, null, null, null, null),
  ('f898145b-503f-5da1-83e2-876a20365d94', 'c3c5c427-4120-5452-adc2-63eee840f9dc', 'aggiornamento_lavoratori', 'completato', '2024-04-23', '2029-04-23', 'E-learning', 6, '/Arcobaleno/Sicurezza/Corso_Sicurezza_Nascinguerra_Giulia.pdf', null),
  ('d3fef444-92b2-592b-b5d3-499b53a427a6', '7108c5e2-6554-5cf2-a6f1-68d67fc6099e', 'formazione_generale', 'completato', '2022-09-08', null, 'Universita di Padova', 4, '/Arcobaleno/Sicurezza/Corso_Sicurezza_Base_Nascinguerra_Aurora.pdf', null),
  ('4179f499-8f78-54e2-b4f3-fb4b71c950eb', '7108c5e2-6554-5cf2-a6f1-68d67fc6099e', 'aggiornamento_lavoratori', 'completato', '2024-04-05', '2029-04-05', 'E-learning', 6, '/Arcobaleno/Sicurezza/Corso_Sicurezza_Nascinguerra_Aurora.pdf', null),
  ('b549d45e-200c-5c2d-babf-e5490a8b553f', 'bd279fc6-027b-5e63-bc7c-3f9ea4f15702', 'formazione_generale', 'completato', '2023-10-24', null, null, null, null, null),
  ('694831b4-aaae-5225-b278-774516e2728d', 'bd279fc6-027b-5e63-bc7c-3f9ea4f15702', 'formazione_specifica', 'completato', '2023-11-07', '2028-11-07', null, null, null, null),
  ('ceefbe04-bc9b-5fc3-bce5-41f87aad5c9d', '1de05f8c-a71c-53c8-bf74-483eb6ba8c3e', 'formazione_generale', 'in_corso', null, null, null, null, null, 'Corso online attivato, non risulta completato'),
  ('4ec27a13-b712-58c8-8831-a20ad4a86d69', '3f9f500a-b7a1-5294-9fe1-1c8e47c39c23', 'formazione_generale', 'in_corso', null, null, null, null, null, 'Corso online attivato, non risulta completato'),
  ('61a74394-848c-581e-80d0-9869f6a0d9e1', '9ac88ca4-ef12-571b-a207-b0e01e04ec30', 'aggiornamento_lavoratori', 'completato', '2024-12-17', '2029-12-17', 'Corso online', 6, '/Arcobaleno/Sicurezza/Corso_Sicurezza_Base_Grego_Marco.pdf', null),
  ('5d910ecf-b0bf-5f33-ae62-a9abd305bccb', '9ac88ca4-ef12-571b-a207-b0e01e04ec30', 'haccp_alimentaristi', 'completato', '2023-05-15', '2026-05-15', 'Ricerche Sicurezza Srl', 2, '/Arcobaleno/Sicurezza/Corso_Sicurezza_Grego_Marco.pdf', 'Corso igiene alimenti 2 ore (la norma Veneto chiede almeno 3 ore)'),
  ('6f17811d-88f2-5b61-97ac-edaf86a1ef5e', 'eaea3469-4636-5c56-9d29-2afd7f675eb2', 'formazione_generale', 'completato', '2019-12-21', null, 'Liceo Brocchi (scuola)', 4, '/Arcobaleno/Sicurezza/Corso_Sicurezza_Pontarollo_Ilaria.pdf', 'Solo formazione generale: specifica mancante'),
  ('0effcebc-b545-5625-9864-8d2a7ee5d617', '4b72cfe4-06ed-5ccf-bc64-f34dbe000946', 'formazione_generale', 'completato', '2024-04-15', null, 'Confcommercio Bassano', 4, '/Arcobaleno/Sicurezza/Corso_Sicurezza_Mezzalira_Lara.pdf', 'Corso unico 8 ore generale + specifica rischio basso'),
  ('94ace165-53cc-5e18-871a-e843f9337124', '4b72cfe4-06ed-5ccf-bc64-f34dbe000946', 'formazione_specifica', 'completato', '2024-04-29', '2029-04-29', 'Confcommercio Bassano', 4, '/Arcobaleno/Sicurezza/Corso_Sicurezza_Mezzalira_Lara.pdf', 'Corso unico 8 ore generale + specifica rischio basso'),
  ('83c09be2-4a2d-56c3-b1ab-9ca913c6726e', 'b571f732-1e6f-5a02-81a4-3227ddb26a0a', 'formazione_generale', 'completato', '2024-04-15', null, 'Confcommercio Bassano', 4, '/Arcobaleno/Sicurezza/Corso_Sicurezza_Saadia_Daoudi.pdf', 'Corso unico 8 ore generale + specifica rischio basso'),
  ('471fea04-627a-5f9c-95f2-f5d3359253e0', 'b571f732-1e6f-5a02-81a4-3227ddb26a0a', 'formazione_specifica', 'completato', '2024-04-29', '2029-04-29', 'Confcommercio Bassano', 4, '/Arcobaleno/Sicurezza/Corso_Sicurezza_Saadia_Daoudi.pdf', 'Corso unico 8 ore generale + specifica rischio basso'),
  ('a8960cd2-1d35-5cf9-be34-4d222a1eec2a', '14beef79-1226-5507-82e4-2b5974eda188', 'formazione_generale', 'completato', '2024-04-15', null, 'Confcommercio Bassano', 4, '/Arcobaleno/Sicurezza/Corso_Sicurezza_Orlando_Mattia.pdf', 'Corso unico 8 ore generale + specifica rischio basso'),
  ('8a86af8f-4e30-5e38-9f44-42720cd5c123', '14beef79-1226-5507-82e4-2b5974eda188', 'formazione_specifica', 'completato', '2024-04-29', '2029-04-29', 'Confcommercio Bassano', 4, '/Arcobaleno/Sicurezza/Corso_Sicurezza_Orlando_Mattia.pdf', 'Corso unico 8 ore generale + specifica rischio basso'),
  ('18ef86f3-12d9-553d-b048-8fa8b9b6ee42', 'bc1963a1-611b-56bc-a3fd-eda5ef7ddfbb', 'formazione_generale', 'completato', '2024-04-15', null, 'Confcommercio Bassano', 4, '/Arcobaleno/Sicurezza/Corso_Sicurezza_Guderzo_Lisa.pdf', 'Corso unico 8 ore generale + specifica rischio basso'),
  ('b1adc7f3-e2cc-5ee6-a2d1-54a1aba324a6', 'bc1963a1-611b-56bc-a3fd-eda5ef7ddfbb', 'formazione_specifica', 'completato', '2024-04-29', '2029-04-29', 'Confcommercio Bassano', 4, '/Arcobaleno/Sicurezza/Corso_Sicurezza_Guderzo_Lisa.pdf', 'Corso unico 8 ore generale + specifica rischio basso')
on conflict (id) do nothing;

insert into sic_visite (id, persona_id, tipo, data_visita, prossima_scadenza, note) values
  ('32c80bc0-3826-5a5d-808a-f02f9fecc88f', '4d10b4c0-5bc1-51b5-9e73-b500dec640d0', 'periodica', '2025-02-21', '2027-02-21', 'Da foglio Excel; giudizio da completare'),
  ('83cad875-69aa-5fee-a2b9-ee4fd7c27c31', '74ebf4bf-31df-5865-b982-45ee7cbe19d7', 'periodica', '2024-08-02', '2026-08-02', 'Da foglio Excel; giudizio da completare'),
  ('9e12898b-36eb-5bc2-9924-449afea8b5c7', '011b8df5-82aa-549b-bbbd-545f83137f56', 'periodica', '2024-08-02', '2026-08-02', 'Da foglio Excel; giudizio da completare'),
  ('54e07eeb-ac2d-5ae5-a1d1-d4792d41f059', 'ef2ec85e-9e9c-56ac-85f0-d74e89b7f975', 'periodica', '2024-08-02', '2026-08-02', 'Da foglio Excel; giudizio da completare'),
  ('0a5aa31b-e2dc-5878-b2f0-94827bcab7ec', 'e7d95c99-42b7-5d19-b0d5-d7982a5f7769', 'periodica', '2024-08-02', '2026-08-02', 'Da foglio Excel; giudizio da completare'),
  ('b5e15f39-8905-5e88-b6f2-ac89da5949c1', 'd515cd62-69e6-5b16-9273-c08d7a2bd1d7', 'periodica', '2024-08-02', '2026-08-02', 'Da foglio Excel; giudizio da completare'),
  ('1ecb9df2-4272-5649-9238-f37d36ae2a4e', 'f0e40658-eb44-57dd-8480-ef6f3439bf97', 'periodica', '2024-01-11', '2026-01-10', 'Da foglio Excel; giudizio da completare'),
  ('c2aa347d-e243-5e94-b8cf-189f8e69af95', 'c3c5c427-4120-5452-adc2-63eee840f9dc', 'periodica', '2024-04-19', '2026-04-19', 'Da foglio Excel; giudizio da completare'),
  ('a6980735-c8db-59ca-b448-2dc3ad8e2ccb', '7108c5e2-6554-5cf2-a6f1-68d67fc6099e', 'periodica', '2024-11-08', '2026-11-08', 'Da foglio Excel; giudizio da completare'),
  ('eb47f865-60fa-5996-9237-121e2647a4e2', 'eaea3469-4636-5c56-9d29-2afd7f675eb2', 'periodica', '2024-06-21', '2026-06-21', 'Da foglio Excel; giudizio da completare'),
  ('5c8059cd-60bd-58a6-a6bf-8fdb2270cd4b', '9ac88ca4-ef12-571b-a207-b0e01e04ec30', 'periodica', '2025-02-21', '2027-02-21', 'Da foglio Excel; giudizio da completare'),
  ('0e66ccb2-2eaf-5c79-8cdb-04564c9c8f30', '1de05f8c-a71c-53c8-bf74-483eb6ba8c3e', 'periodica', '2025-11-14', '2027-11-14', 'Da foglio Excel; giudizio da completare'),
  ('a9956664-3e42-547a-ae0a-9cb3731eb048', 'b571f732-1e6f-5a02-81a4-3227ddb26a0a', 'periodica', '2025-03-07', '2027-03-07', 'Da foglio Excel; giudizio da completare'),
  ('8b436165-bacb-5e71-9017-1d9de1ebdf0a', '14beef79-1226-5507-82e4-2b5974eda188', 'periodica', '2025-11-07', '2027-11-07', 'Da foglio Excel; giudizio da completare'),
  ('74fe1a9c-97cd-5e50-b785-a1c3712efbfb', '3f9f500a-b7a1-5294-9fe1-1c8e47c39c23', 'periodica', '2023-12-01', '2025-11-30', 'Da foglio Excel; giudizio da completare'),
  ('7eec8269-a1c6-5238-b256-90ebfd9441d0', 'bc1963a1-611b-56bc-a3fd-eda5ef7ddfbb', 'periodica', '2025-11-14', '2027-11-14', 'Da foglio Excel; giudizio da completare'),
  ('b10b2cf4-400e-59a2-b5c6-3efc5dbb2a1b', '7a833506-fc07-5f61-9875-eed1e7fd9643', 'periodica', '2025-03-07', '2027-03-07', 'Da foglio Excel; giudizio da completare')
on conflict (id) do nothing;
