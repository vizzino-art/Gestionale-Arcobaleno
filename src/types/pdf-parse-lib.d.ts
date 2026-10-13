// @types/pdf-parse copre solo "pdf-parse" (il punto d'ingresso principale),
// non "pdf-parse/lib/pdf-parse.js" — importato direttamente in
// src/app/api/leggi-buste-paga/route.ts per evitare un bug noto del
// pacchetto nel suo index.js (vedi il commento in quel file). Stessa firma
// della funzione già tipizzata da @types/pdf-parse.
declare module "pdf-parse/lib/pdf-parse.js" {
  import pdfParse from "pdf-parse";
  export default pdfParse;
}
