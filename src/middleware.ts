import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_RENEW_BELOW_SEC,
  createSessionToken,
  sessionCookieOptions,
  verifySessionToken,
} from "@/lib/auth";

// Alles außer Login, Health-Check und statischen PWA-Dateien braucht eine Sitzung.
export const config = {
  matcher: ["/((?!_next/|login|api/login|api/health|sw\\.js|manifest\\.webmanifest|icons/|favicon\\.ico).*)"],
};

export async function middleware(req: NextRequest) {
  const remaining = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);

  if (remaining === null) {
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();
  // Gleitende Sitzung: bei Nutzung wieder auf 90 Tage verlängern.
  if (remaining < SESSION_RENEW_BELOW_SEC) {
    res.cookies.set(SESSION_COOKIE, await createSessionToken(), sessionCookieOptions());
  }
  return res;
}
