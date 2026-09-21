// Icone ufficiali dei metodi di pagamento per la pagina Corrispettivi
// (punto 23, 21/9, richiesto da Mauro dopo aver visto la pagina la prima
// volta: "usiamo i loghi ufficiali"). Path SVG presi dalla libreria open
// source "Simple Icons" (simpleicons.org, licenza CC0 — icone pensate
// apposta per questo uso, marchio dell'azienda ridisegnato in una forma
// semplice riconoscibile, non il file originale dell'azienda) — copiati
// qui come costanti invece di installare l'intero pacchetto npm (>3000
// icone, ~26 MB) solo per due, per non appesantire inutilmente il
// progetto: se ne serve un'altra in futuro, vedi simpleicons.org.
//
// Le altre icone richieste da Mauro (SumUp, Satispay, Edenred, Bancomat,
// Volksbank, Agenzia Entrate) NON sono su Simple Icons — vedi il
// messaggio di Claude del 21/9 nella chat per come procurarle.
function Svg({ path, colore, titolo }: { path: string; colore: string; titolo: string }) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill={colore}
      xmlns="http://www.w3.org/2000/svg"
      className="inline-block align-middle"
    >
      <title>{titolo}</title>
      <path d={path} />
    </svg>
  );
}

export function IconaMastercard() {
  return (
    <Svg
      titolo="Mastercard"
      colore="#EB001B"
      path="M11.343 18.031c.058.049.12.098.181.146-1.177.783-2.59 1.238-4.107 1.238C3.32 19.416 0 16.096 0 12c0-4.095 3.32-7.416 7.416-7.416 1.518 0 2.931.456 4.105 1.238-.06.051-.12.098-.165.15C9.6 7.489 8.595 9.688 8.595 12c0 2.311 1.001 4.51 2.748 6.031zm5.241-13.447c-1.52 0-2.931.456-4.105 1.238.06.051.12.098.165.15C14.4 7.489 15.405 9.688 15.405 12c0 2.31-1.001 4.507-2.748 6.031-.058.049-.12.098-.181.146 1.177.783 2.588 1.238 4.107 1.238C20.68 19.416 24 16.096 24 12c0-4.094-3.32-7.416-7.416-7.416zM12 6.174c-.096.075-.189.15-.28.231C10.156 7.764 9.169 9.765 9.169 12c0 2.236.987 4.236 2.551 5.595.09.08.185.158.28.232.096-.074.189-.152.28-.232 1.563-1.359 2.551-3.359 2.551-5.595 0-2.235-.987-4.236-2.551-5.595-.09-.08-.184-.156-.28-.231z"
    />
  );
}

export function IconaVisa() {
  return (
    <Svg
      titolo="Visa"
      colore="#1A1F71"
      path="M9.112 8.262L5.97 15.758H3.92L2.374 9.775c-.094-.368-.175-.503-.461-.658C1.447 8.864.677 8.627 0 8.479l.046-.217h3.3a.904.904 0 01.894.764l.817 4.338 2.018-5.102zm8.033 5.049c.008-1.979-2.736-2.088-2.717-2.972.006-.269.262-.555.822-.628a3.66 3.66 0 011.913.336l.34-1.59a5.207 5.207 0 00-1.814-.333c-1.917 0-3.266 1.02-3.278 2.479-.012 1.079.963 1.68 1.698 2.04.756.367 1.01.603 1.006.931-.005.504-.602.725-1.16.734-.975.015-1.54-.263-1.992-.473l-.351 1.642c.453.208 1.289.39 2.156.398 2.037 0 3.37-1.006 3.377-2.564m5.061 2.447H24l-1.565-7.496h-1.656a.883.883 0 00-.826.55l-2.909 6.946h2.036l.405-1.12h2.488zm-2.163-2.656l1.02-2.815.588 2.815zm-8.16-4.84l-1.603 7.496H8.34l1.605-7.496z"
    />
  );
}
