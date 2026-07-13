import { NextResponse } from "next/server";
import { sb } from "@/lib/supabase-server";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";
  if (code) await sb().auth.exchangeCodeForSession(code);
  return NextResponse.redirect(new URL(next, url.origin));
}
