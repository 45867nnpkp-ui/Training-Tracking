"use client";

import { formatDate, formatKg } from "@/lib/format";

export interface ChartPoint {
  date: string;
  weight: number;
  oneRepMax: number;
}

/** Einfaches Liniendiagramm: Arbeitsgewicht und geschätztes 1RM über die Zeit. */
export default function HistoryChart({ points }: { points: ChartPoint[] }) {
  if (points.length < 2) {
    return <p className="text-sm text-neutral-500">Das Diagramm erscheint ab zwei Einheiten.</p>;
  }
  const W = 320;
  const H = 170;
  const pad = { l: 36, r: 8, t: 10, b: 22 };
  const values = points.flatMap((p) => [p.weight, p.oneRepMax]);
  const min = Math.floor(Math.min(...values) * 0.95);
  const max = Math.ceil(Math.max(...values) * 1.05);
  const x = (i: number) => pad.l + (i / (points.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min || 1)) * (H - pad.t - pad.b);
  const line = (key: "weight" | "oneRepMax") => points.map((p, i) => `${x(i)},${y(p[key])}`).join(" ");

  return (
    <figure className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Verlauf von Gewicht und geschätztem 1RM">
        {[min, (min + max) / 2, max].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="#262626" />
            <text x={pad.l - 4} y={y(v) + 4} textAnchor="end" fontSize="10" fill="#737373">
              {formatKg(Math.round(v))}
            </text>
          </g>
        ))}
        <polyline points={line("oneRepMax")} fill="none" stroke="#38bdf8" strokeWidth="2" strokeDasharray="4 3" />
        <polyline points={line("weight")} fill="none" stroke="#10b981" strokeWidth="2.5" />
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.weight)} r="3" fill="#10b981" />
        ))}
        <text x={pad.l} y={H - 6} fontSize="10" fill="#737373">
          {formatDate(points[0].date, false)}
        </text>
        <text x={W - pad.r} y={H - 6} fontSize="10" fill="#737373" textAnchor="end">
          {formatDate(points[points.length - 1].date, false)}
        </text>
      </svg>
      <figcaption className="flex gap-4 text-sm text-neutral-400">
        <span><span className="text-emerald-500">━</span> Arbeitsgewicht</span>
        <span><span className="text-sky-400">┅</span> geschätztes 1RM (Epley)</span>
      </figcaption>
    </figure>
  );
}
