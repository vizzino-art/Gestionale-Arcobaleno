"use client";

import { useMemo, useState } from "react";

type Punto = {
  data: string; // ISO
  prezzo: number;
};

type Props = {
  punti: Punto[];
};

const LARGHEZZA = 400;
const ALTEZZA = 160;
const PAD_SX = 42;
const PAD_DX = 10;
const PAD_SU = 10;
const PAD_GIU = 22;

function formattaData(iso: string): string {
  return new Date(iso).toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

// Grafico a linea semplice, senza librerie esterne: un solo prodotto per
// volta (una sola serie), quindi non serve una legenda — il titolo del
// modale sopra già identifica di cosa si tratta. Un punto per ogni prezzo
// registrato, posizionato in base alla data reale (non un indice) così le
// consegne più fitte o più rade nel tempo si vedono a colpo d'occhio.
export function GraficoStoricoPrezzo({ punti }: Props) {
  const [indiceHover, setIndiceHover] = useState<number | null>(null);

  const dati = useMemo(() => {
    if (punti.length < 2) return null;

    const tempi = punti.map((p) => new Date(p.data).getTime());
    const prezzi = punti.map((p) => p.prezzo);
    const tMin = Math.min(...tempi);
    const tMax = Math.max(...tempi);
    let pMin = Math.min(...prezzi);
    let pMax = Math.max(...prezzi);
    // Un po' di margine sopra/sotto: un prezzo piatto (pMin === pMax) non
    // deve schiacciare la linea contro un bordo.
    if (pMin === pMax) {
      pMin -= 1;
      pMax += 1;
    } else {
      const margine = (pMax - pMin) * 0.1;
      pMin -= margine;
      pMax += margine;
    }

    const x = (t: number) =>
      tMax === tMin
        ? PAD_SX + (LARGHEZZA - PAD_SX - PAD_DX) / 2
        : PAD_SX + ((t - tMin) / (tMax - tMin)) * (LARGHEZZA - PAD_SX - PAD_DX);
    const y = (p: number) =>
      ALTEZZA - PAD_GIU - ((p - pMin) / (pMax - pMin)) * (ALTEZZA - PAD_SU - PAD_GIU);

    const coordinate = punti.map((p, i) => ({ x: x(tempi[i]), y: y(p.prezzo), p, t: tempi[i] }));
    const path = coordinate.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");

    return { coordinate, path, pMin, pMax };
  }, [punti]);

  if (!dati) {
    return (
      <p className="mb-3 text-xs text-neutral-400">
        Serve almeno un secondo prezzo registrato per mostrare il grafico.
      </p>
    );
  }

  const attivo = indiceHover != null ? dati.coordinate[indiceHover] : null;

  return (
    <div className="relative mb-4">
      <svg
        viewBox={`0 0 ${LARGHEZZA} ${ALTEZZA}`}
        className="w-full touch-none"
        onMouseLeave={() => setIndiceHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const xRel = ((e.clientX - rect.left) / rect.width) * LARGHEZZA;
          let migliore = 0;
          let distanzaMinima = Infinity;
          dati.coordinate.forEach((c, i) => {
            const d = Math.abs(c.x - xRel);
            if (d < distanzaMinima) {
              distanzaMinima = d;
              migliore = i;
            }
          });
          setIndiceHover(migliore);
        }}
      >
        {/* Etichette prezzo min/max: assi minimi, solo i due riferimenti utili */}
        <text x={2} y={PAD_SU + 4} className="fill-neutral-400" fontSize="9">
          €{dati.pMax.toFixed(2)}
        </text>
        <text x={2} y={ALTEZZA - PAD_GIU} className="fill-neutral-400" fontSize="9">
          €{dati.pMin.toFixed(2)}
        </text>

        {/* Linea di base recessiva, solo per dare un riferimento visivo */}
        <line
          x1={PAD_SX}
          y1={ALTEZZA - PAD_GIU}
          x2={LARGHEZZA - PAD_DX}
          y2={ALTEZZA - PAD_GIU}
          stroke="currentColor"
          className="text-neutral-200"
          strokeWidth={1}
        />

        <path d={dati.path} fill="none" stroke="#2563eb" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {dati.coordinate.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={i === indiceHover ? 4 : 2.5} fill="#2563eb" />
        ))}

        {attivo && (
          <line
            x1={attivo.x}
            y1={PAD_SU}
            x2={attivo.x}
            y2={ALTEZZA - PAD_GIU}
            stroke="#2563eb"
            strokeOpacity={0.25}
            strokeWidth={1}
          />
        )}

        {/* Date di inizio/fine, uniche etichette sull'asse orizzontale */}
        <text x={PAD_SX} y={ALTEZZA - 6} className="fill-neutral-400" fontSize="9">
          {formattaData(punti[0].data)}
        </text>
        <text x={LARGHEZZA - PAD_DX} y={ALTEZZA - 6} textAnchor="end" className="fill-neutral-400" fontSize="9">
          {formattaData(punti[punti.length - 1].data)}
        </text>
      </svg>

      {attivo && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 rounded-md bg-neutral-900 px-2 py-1 text-[10px] whitespace-nowrap text-white shadow"
          style={{
            left: `${(attivo.x / LARGHEZZA) * 100}%`,
            top: `${(attivo.y / ALTEZZA) * 100}%`,
            marginTop: "-1.75rem",
          }}
        >
          {formattaData(attivo.p.data)} · €{attivo.p.prezzo.toFixed(2)}
        </div>
      )}
    </div>
  );
}
