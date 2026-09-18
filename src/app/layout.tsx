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
    var banner = document.getElementById('debug-errore-js');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'debug-errore-js';
      banner.style.position = 'fixed';
      banner.style.top = '0';
      banner.style.left = '0';
      banner.style.right = '0';
      banner.style.zIndex = '999999';
      banner.style.background = '#b91c1c';
      banner.style.color = '#fff';
      banner.style.padding = '10px';
      banner.style.fontSize = '13px';
      banner.style.fontFamily = 'monospace';
      banner.style.whiteSpace = 'pre-wrap';
      banner.style.wordBreak = 'break-word';
      document.body.insertBefore(banner, document.body.firstChild);
    }
    banner.textContent = window.__erroriJsDebug.join('\\n');
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
