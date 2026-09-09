// Tipi corrispondenti alle tabelle in supabase/schema.sql

export type Fornitore = {
  id: string;
  nome: string;
  telefono: string | null;
  email: string | null;
  note: string | null;
  piva: string | null;
  prefisso_file: string | null;
  giorno_consegna: number | null;
  ordine: number;
  created_at: string;
};

export type Categoria = {
  id: string;
  nome: string;
};

export type Prodotto = {
  id: string;
  fornitore_id: string;
  categoria_id: string | null;
  codice_articolo: string | null;
  descrizione: string;
  prezzo_listino: number | null;
  sconto1: number | null;
  sconto2: number | null;
  sconto3: number | null;
  prezzo_unitario: number | null;
  um: string | null;
  pezzi_per_confezione: number | null;
  um_confezione: string | null;
  peso_kg_per_unita: number | null;
  quantita_obiettivo: number | null;
  magazzino_attuale: number | null;
  omaggio_ogni: number | null;
  omaggio_gratis: number | null;
  attivo: boolean;
  ordine: number;
  data_aggiornamento: string;
};

export type ConfrontoCategoria = {
  categoria_id: string;
  categoria_nome: string;
  prodotto_id: string;
  descrizione: string;
  fornitore_id: string;
  fornitore_nome: string;
  prezzo_unitario: number | null;
  peso_kg_per_unita: number | null;
  prezzo_per_kg: number | null;
  posizione: number;
};

// Riga di storico_miglior_fornitore con i nomi già risolti (join),
// così come arriva dalla query in Confronta: alimenta le notifiche
// "è cambiato il fornitore più conveniente per <categoria>".
export type CambioMigliorFornitore = {
  id: string;
  categoria_id: string;
  fornitore_id: string;
  prezzo_per_kg: number | null;
  rilevato_il: string;
  categorie: { nome: string } | null;
  fornitori: { nome: string } | null;
};
