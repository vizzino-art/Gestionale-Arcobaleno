import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gestionale Ordini Arcobaleno",
  description: "Gestione ordini, fornitori e storico prezzi per Pizzeria Arcobaleno",
};

// Script diagnostico TEMPORANEO: cattura qualsiasi errore JavaScript non
// gestito (compreso il caso in cui blocchi l'esecuzione di tutto il resto
// del codice, es. su un browser datato che non supporta qualche
// funzionalità moderna) e lo mostra in un banner rosso in cima alla
// pagina, senza bisogno di collegare il dispositivo a un computer.
// Scritto volutamente in JavaScript "vecchio stile" (var, function,
// niente funzionalità recenti) per poter girare anche su motori molto
// datati. Da rimuovere una volta individuata la causa del problema di
// accesso dall'iPad (issue: login non funzionante su iOS 15.8.8).
const scriptDiagnosticoErrori = `
(function () {
  window.__erroriJsDebug = [];
  function registra(msg) {
    window.__erroriJsDebug.push(msg);
    provaMostra();
  }
  function provaMostra() {
    if (!document.body) return;
    // Se non c'è ancora nessun errore registrato non creiamo nulla: senza
    // questo controllo il banner compariva vuoto ad ogni caricamento
    // pagina (veniva creato comunque al DOMContentLoaded qui sotto).
    if (!window.__erroriJsDebug || window.__erroriJsDebug.length === 0) return;
    var banner = document.getElementById('debug-errore-js');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'debug-errore-js';
      banner.style.position = 'fixed';
      banner.style.top = '0';
      banner.style.left = '0';
      banner.style.right = '0';
      banner.style.maxHeight = '35vh';
      banner.style.overflowY = 'auto';
      banner.style.zIndex = '999999';
      banner.style.background = '#b91c1c';
      banner.style.color = '#fff';
      banner.style.padding = '10px 40px 10px 10px';
      banner.style.fontSize = '13px';
      banner.style.fontFamily = 'monospace';
      banner.style.whiteSpace = 'pre-wrap';
      banner.style.wordBreak = 'break-word';
      // Senza questo il banner, restando fisso sopra il resto della
      // pagina, blocca i click su menu/pulsanti sottostanti: qui i click
      // "attraversano" il banner e arrivano a quello che c'è sotto, tranne
      // sul pulsante di chiusura qui sotto che resta cliccabile.
      banner.style.pointerEvents = 'none';

      var chiudi = document.createElement('button');
      chiudi.textContent = 'Chiudi';
      chiudi.style.position = 'absolute';
      chiudi.style.top = '8px';
      chiudi.style.right = '8px';
      chiudi.style.pointerEvents = 'auto';
      chiudi.style.background = '#fff';
      chiudi.style.color = '#b91c1c';
      chiudi.style.border = 'none';
      chiudi.style.borderRadius = '4px';
      chiudi.style.padding = '4px 8px';
      chiudi.style.fontSize = '12px';
      chiudi.style.cursor = 'pointer';
      chiudi.onclick = function () {
        banner.style.display = 'none';
      };
      banner.appendChild(chiudi);

      var testo = document.createElement('div');
      testo.id = 'debug-errore-js-testo';
      banner.insertBefore(testo, chiudi);

      document.body.insertBefore(banner, document.body.firstChild);
    }
    var testoEl = document.getElementById('debug-errore-js-testo');
    if (testoEl) testoEl.textContent = window.__erroriJsDebug.join('\\n');
  }
  window.onerror = function (message, source, lineno, colno) {
    registra('Errore JS: ' + message + ' (riga ' + lineno + ':' + colno + ')');
    return false;
  };
  window.addEventListener('unhandledrejection', function (event) {
    var motivo = 'sconosciuto';
    try {
      motivo = (event && event.reason && event.reason.message) ? event.reason.message : String(event.reason);
    } catch (e) {}
    registra('Promise non gestita: ' + motivo);
  });
  document.addEventListener('DOMContentLoaded', provaMostra);
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: scriptDiagnosticoErrori }} />
        {children}
      </body>
    </html>
  );
}
