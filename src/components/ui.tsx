"use client";

import { useEffect, useState } from "react";
import { formatKg, parseDecimal } from "@/lib/format";

/** Aktuelle Uhrzeit, jede Sekunde neu (für Timer). */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function Button({
  className = "",
  variant = "secondary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  const styles = {
    primary: "bg-emerald-600 text-white active:bg-emerald-700",
    secondary: "bg-neutral-800 text-neutral-100 active:bg-neutral-700",
    danger: "bg-red-900/60 text-red-100 active:bg-red-900",
    ghost: "bg-transparent text-neutral-300 active:bg-neutral-800",
  }[variant];
  return (
    <button
      type="button"
      className={`min-h-12 rounded-xl px-4 font-semibold disabled:opacity-40 ${styles} ${className}`}
      {...props}
    />
  );
}

/**
 * Große Zahl mit −/+ Buttons. Direkte Eingabe per Tastatur möglich
 * (Komma oder Punkt). `placeholder` wird grau angezeigt, solange nichts
 * eingetragen ist, und dient beim ersten Tippen auf −/+ als Startwert.
 */
export function Stepper({
  value,
  placeholder,
  step,
  unit,
  decimals,
  onChange,
  label,
}: {
  value: number | null;
  placeholder?: number | null;
  step: number;
  unit?: string;
  decimals: boolean;
  onChange: (v: number | null) => void;
  label: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const base = value ?? placeholder ?? null;

  function bump(dir: 1 | -1) {
    const start = base ?? 0;
    // Beim ersten Tippen den grauen Vorwert übernehmen, statt ihn zu verändern.
    if (value === null && placeholder !== null && placeholder !== undefined) {
      onChange(placeholder);
      return;
    }
    const next = Math.max(0, Math.round((start + dir * step) * 100) / 100);
    onChange(next);
  }

  return (
    <div className="flex items-center gap-1" aria-label={label}>
      <button
        type="button"
        aria-label={`${label} verringern`}
        onClick={() => bump(-1)}
        className="h-14 w-10 shrink-0 rounded-xl bg-neutral-800 text-2xl font-bold active:bg-neutral-700"
      >
        −
      </button>
      <div className="relative min-w-0 flex-1">
        <input
          type="text"
          inputMode={decimals ? "decimal" : "numeric"}
          aria-label={label}
          value={draft ?? (value === null ? "" : formatKg(value))}
          placeholder={placeholder === null || placeholder === undefined ? "–" : formatKg(placeholder)}
          onFocus={(e) => {
            setDraft(value === null ? "" : formatKg(value));
            e.currentTarget.select();
          }}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft !== null) {
              const parsed = parseDecimal(draft);
              onChange(parsed === null ? null : decimals ? parsed : Math.round(parsed));
            }
            setDraft(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className="h-14 w-full rounded-xl bg-neutral-950 text-center text-2xl font-bold outline-none placeholder:text-neutral-600 focus:ring-2 focus:ring-emerald-500"
        />
        {unit && <span className="pointer-events-none absolute inset-x-0 bottom-0.5 text-center text-[10px] text-neutral-500">{unit}</span>}
      </div>
      <button
        type="button"
        aria-label={`${label} erhöhen`}
        onClick={() => bump(1)}
        className="h-14 w-10 shrink-0 rounded-xl bg-neutral-800 text-2xl font-bold active:bg-neutral-700"
      >
        +
      </button>
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "green" | "amber" | "blue" | "red" }) {
  const styles = {
    neutral: "bg-neutral-800 text-neutral-300",
    green: "bg-emerald-900/60 text-emerald-300",
    amber: "bg-amber-900/50 text-amber-300",
    blue: "bg-sky-900/50 text-sky-300",
    red: "bg-red-900/50 text-red-300",
  }[tone];
  return <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${styles}`}>{children}</span>;
}
