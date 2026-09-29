import { NextResponse } from "next/server";
import { loadBootstrap } from "@/lib/server/bootstrap";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await loadBootstrap());
}
