// Einzelnutzer-Login (SPEC.md, Abschnitt 2): Passwort aus APP_PASSWORD,
// langlebige Sitzung per httpOnly-Cookie. Das Cookie enthält nur das
// Ablaufdatum plus eine HMAC-Signatur mit SESSION_SECRET – kein Passwort.
// Nutzt Web Crypto, damit es auch in der Middleware (Edge-Runtime) läuft.

export const SESSION_COOKIE = "tt_session";
export const SESSION_MAX_AGE_SEC = 90 * 24 * 60 * 60; // 90 Tage
/** Ab dieser Restlaufzeit wird das Cookie bei Nutzung automatisch verlängert. */
export const SESSION_RENEW_BELOW_SEC = 83 * 24 * 60 * 60;

const encoder = new TextEncoder();

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET fehlt oder ist zu kurz (mindestens 16 Zeichen).");
  }
  return secret;
}

function toBase64Url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toBase64Url(await crypto.subtle.sign("HMAC", key, encoder.encode(data)));
}

/** Vergleich in konstanter Zeit (verhindert Timing-Angriffe). */
export function safeEqual(a: string, b: string): boolean {
  const ab = encoder.encode(a);
  const bb = encoder.encode(b);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < Math.max(ab.length, bb.length); i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

export async function createSessionToken(now = Date.now()): Promise<string> {
  const payload = `v1.${now + SESSION_MAX_AGE_SEC * 1000}`;
  return `${payload}.${await hmac(payload)}`;
}

/** Liefert die Restlaufzeit in Sekunden, oder null wenn ungültig/abgelaufen. */
export async function verifySessionToken(token: string | undefined, now = Date.now()): Promise<number | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  const expires = Number(parts[1]);
  if (!Number.isFinite(expires) || expires <= now) return null;
  const expected = await hmac(`${parts[0]}.${parts[1]}`);
  if (!safeEqual(expected, parts[2])) return null;
  return Math.floor((expires - now) / 1000);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  };
}
