import forge from "node-forge";
import { XMLParser } from "fast-xml-parser";

// Legge una fattura elettronica italiana (XML o P7M) e ne estrae i dati
// strutturati direttamente dai campi del tracciato FatturaPA — niente
// lettura "a vista"/IA come per le bolle: qui i dati sono già scritti nei
// campi esatti dal software del fornitore, quindi l'estrazione è esatta.

export type RigaFatturaElettronica = {
  numeroLinea: number;
  codiceArticolo: string | null;
  descrizione: string;
  quantita: number | null;
  um: string | null;
  prezzoUnitario: number | null;
  prezzoTotale: number | null;
  aliquotaIva: number | null;
  ddtNumero: string | null;
  ddtData: string | null; // YYYY-MM-DD
};

export type RataPagamentoFatturaElettronica = {
  numeroRata: number;
  importo: number;
  dataScadenza: string | null; // YYYY-MM-DD
  modalitaPagamento: string | null; // codice MP0x del tracciato FatturaPA
};

export type FatturaElettronicaParsata = {
  fornitorePiva: string;
  fornitoreNome: string;
  numero: string;
  data: string; // YYYY-MM-DD
  tipoDocumento: string; // TD01 fattura, TD04 nota di credito, TD24 fattura differita, ecc.
  importoTotale: number;
  righe: RigaFatturaElettronica[];
  rate: RataPagamentoFatturaElettronica[];
  xml: string; // XML estratto (anche da un P7M), archiviato così com'è
};

// Concatena ricorsivamente i byte di un nodo ASN.1 OCTET STRING, gestendo
// anche la forma "constructed" (contenuto frammentato in più OCTET STRING
// annidate). Necessario perché su alcuni P7M reali (visto con firmatari
// diversi, es. Aruba/Actalis) `forge.pkcs7` non ricompone da solo il
// contenuto in `.content` (risulta vuoto) — bisogna leggerlo a mano dal nodo
// ASN.1 grezzo (`rawCapture.content`).
function concatOctetString(node: forge.asn1.Asn1): string {
  if (typeof node.value === "string") return node.value;
  if (Array.isArray(node.value)) {
    return node.value.map((v) => concatOctetString(v as forge.asn1.Asn1)).join("");
  }
  return "";
}

function estraiXmlDaP7m(bufferP7m: Buffer): string {
  const asn1 = forge.asn1.fromDer(bufferP7m.toString("latin1"));
  const p7 = forge.pkcs7.messageFromAsn1(asn1) as forge.pkcs7.PkcsSignedData & {
    rawCapture?: { content?: forge.asn1.Asn1 };
  };

  const contenuto = p7.content;
  let bytes = typeof contenuto === "string" ? contenuto : contenuto ? contenuto.getBytes() : "";

  if (!bytes && p7.rawCapture?.content) {
    const octetString = (p7.rawCapture.content.value as forge.asn1.Asn1[] | undefined)?.[0];
    if (octetString) bytes = concatOctetString(octetString);
  }

  if (!bytes) {
    throw new Error(
      "Impossibile estrarre il contenuto dal file P7M (struttura della firma non riconosciuta)."
    );
  }

  return Buffer.from(bytes, "latin1").toString("utf-8");
}

function numeroONull(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function testoONull(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function comeArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Nodo = any;

export function parsaFatturaElettronica(
  contenutoFile: Buffer,
  nomeFile: string
): FatturaElettronicaParsata {
  const isP7m = nomeFile.toLowerCase().endsWith(".p7m");
  const xml = isP7m ? estraiXmlDaP7m(contenutoFile) : contenutoFile.toString("utf-8");

  const parser = new XMLParser({
    ignoreAttributes: true,
    // Il tag radice/namespace varia da fornitore a fornitore (ns2:, ns3:,
    // p:...) a seconda del software usato per emettere la fattura —
    // togliendo il prefisso possiamo leggere tutti allo stesso modo.
    removeNSPrefix: true,
    // Teniamo tutto come stringa e convertiamo noi i numeri: evita che il
    // parser "aiuti" convertendo in modo imprevedibile codici articolo
    // numerici o date.
    parseTagValue: false,
  });

  const doc: Nodo = parser.parse(xml);
  const fatt: Nodo = doc?.FatturaElettronica;
  if (!fatt) {
    throw new Error(
      "Il file non sembra una fattura elettronica valida (manca il tag FatturaElettronica)."
    );
  }

  const cedente: Nodo = fatt.FatturaElettronicaHeader?.CedentePrestatore?.DatiAnagrafici;
  const fornitorePiva =
    testoONull(cedente?.IdFiscaleIVA?.IdCodice) ?? testoONull(cedente?.CodiceFiscale) ?? "";
  const fornitoreNome = testoONull(cedente?.Anagrafica?.Denominazione) ?? "Fornitore sconosciuto";

  // In rarissimi casi un unico file di trasmissione può contenere più
  // FatturaElettronicaBody (più fatture nello stesso invio): per il Passo A
  // gestiamo il primo corpo, che copre tutti i casi reali visti finora.
  const corpi = comeArray<Nodo>(fatt.FatturaElettronicaBody);
  const corpo: Nodo = corpi[0];

  const datiGenerali: Nodo = corpo?.DatiGenerali?.DatiGeneraliDocumento;
  const numero = testoONull(datiGenerali?.Numero) ?? "";
  const data = testoONull(datiGenerali?.Data) ?? "";
  const tipoDocumento = testoONull(datiGenerali?.TipoDocumento) ?? "TD01";
  const importoTotale = numeroONull(datiGenerali?.ImportoTotaleDocumento) ?? 0;

  // Mappa NumeroLinea -> {numero DDT, data DDT}: pattern visto es. in
  // Panificio Forner, che fattura mensilmente riepilogando più DDT, ognuno
  // con le sue righe di consegna referenziate per numero di linea.
  const datiDDT = comeArray<Nodo>(corpo?.DatiGenerali?.DatiDDT);
  const ddtPerLinea = new Map<number, { numero: string | null; data: string | null }>();
  for (const d of datiDDT) {
    const riferimenti = comeArray<unknown>(d?.RiferimentoNumeroLinea).map((n) => numeroONull(n));
    for (const rif of riferimenti) {
      if (rif !== null) {
        ddtPerLinea.set(rif, { numero: testoONull(d?.NumeroDDT), data: testoONull(d?.DataDDT) });
      }
    }
  }

  const righeGrezze = comeArray<Nodo>(corpo?.DatiBeniServizi?.DettaglioLinee);
  const righe: RigaFatturaElettronica[] = righeGrezze.map((r) => {
    const numeroLinea = numeroONull(r?.NumeroLinea) ?? 0;
    // CodiceArticolo può comparire più volte con CodiceTipo diversi (es.
    // "Codice Art. fornitore", "CARB", "prod"...): prendiamo il primo
    // valore, sufficiente per riconoscere/abbinare il prodotto.
    const codiciArticolo = comeArray<Nodo>(r?.CodiceArticolo);
    const codiceArticolo =
      codiciArticolo.length > 0 ? testoONull(codiciArticolo[0]?.CodiceValore) : null;
    const ddt = ddtPerLinea.get(numeroLinea);
    return {
      numeroLinea,
      codiceArticolo,
      descrizione: testoONull(r?.Descrizione) ?? "",
      quantita: numeroONull(r?.Quantita),
      um: testoONull(r?.UnitaMisura),
      prezzoUnitario: numeroONull(r?.PrezzoUnitario),
      prezzoTotale: numeroONull(r?.PrezzoTotale),
      aliquotaIva: numeroONull(r?.AliquotaIVA),
      ddtNumero: ddt?.numero ?? null,
      ddtData: ddt?.data ?? null,
    };
  });

  const dettagliPagamento = comeArray<Nodo>(corpo?.DatiPagamento?.DettaglioPagamento);
  const rate: RataPagamentoFatturaElettronica[] = dettagliPagamento.map((p, i) => ({
    numeroRata: i + 1,
    importo: numeroONull(p?.ImportoPagamento) ?? 0,
    dataScadenza: testoONull(p?.DataScadenzaPagamento),
    modalitaPagamento: testoONull(p?.ModalitaPagamento),
  }));

  return {
    fornitorePiva,
    fornitoreNome,
    numero,
    data,
    tipoDocumento,
    importoTotale,
    righe,
    rate,
    xml,
  };
}

// Etichette leggibili per i codici "ModalitaPagamento" del tracciato
// FatturaPA più comuni nelle fatture di Mauro — usate solo per la
// visualizzazione, mai per logica di business.
export const ETICHETTE_MODALITA_PAGAMENTO: Record<string, string> = {
  MP01: "Contanti",
  MP02: "Assegno",
  MP03: "Assegno circolare",
  MP05: "Bonifico",
  MP08: "Carta di pagamento",
  MP09: "RID",
  MP12: "RIBA",
  MP19: "SEPA Direct Debit",
  MP22: "Contanti presso Tesoreria",
};

export const ETICHETTE_TIPO_DOCUMENTO: Record<string, string> = {
  TD01: "Fattura",
  TD02: "Acconto/anticipo su fattura",
  TD04: "Nota di credito",
  TD05: "Nota di debito",
  TD24: "Fattura differita",
  TD26: "Cessione di beni ammortizzabili",
};
