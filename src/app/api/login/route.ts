import { NextResponse } from "next/server";
import { SESSION_COOKIE, createSessionToken, safeEqual, sessionCookieOptions } from "@/lib/auth";

export async function POST(req: Request) {
  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: "APP_PASSWORD ist auf dem Server nicht gesetzt." }, { status: 500 });
  }
  const body = (await req.json().catch(() => null)) as { password?: unknown } | null;
  const password = typeof body?.password === "string" ? body.password : "";

  if (!safeEqual(password, expected)) {
    // Bremst Durchprobieren von Passwörtern aus.
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ error: "Falsches Passwort" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(), sessionCookieOptions());
  return res;
}
