"use client";

import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.href = "/";
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Login fehlgeschlagen");
    } catch {
      setError("Keine Verbindung zum Server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <h1 className="text-3xl font-bold">Training</h1>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-neutral-400">Passwort</span>
          <input
            type="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-14 rounded-xl border border-neutral-700 bg-neutral-900 px-4 text-lg outline-none focus:border-emerald-500"
          />
        </label>
        {error && <p className="text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={busy || password.length === 0}
          className="h-14 rounded-xl bg-emerald-600 text-lg font-semibold disabled:opacity-40"
        >
          {busy ? "…" : "Einloggen"}
        </button>
      </form>
      <p className="text-sm text-neutral-500">Du bleibst 90 Tage eingeloggt.</p>
    </main>
  );
}
