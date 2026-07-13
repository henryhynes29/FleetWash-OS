import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "anon",
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (all: { name: string; value: string; options?: CookieOptions }[]) => {
          all.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          all.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  const path = req.nextUrl.pathname;
  const isPublic = path === "/login" || path.startsWith("/auth") || path.startsWith("/join");
  if (!user && !isPublic) return NextResponse.redirect(new URL("/login", req.url));
  if (user && (path.startsWith("/office") || path.startsWith("/field") || path === "/")) {
    const { data: p } = await supabase.from("profiles").select("role").eq("user_id", user.id).single();
    if (p?.role === "client" && !path.startsWith("/portal")) return NextResponse.redirect(new URL("/portal", req.url));
    if (path.startsWith("/office") && p?.role !== "owner") return NextResponse.redirect(new URL(p?.role === "client" ? "/portal" : "/field", req.url));
    if (path.startsWith("/field") && p?.role === "client") return NextResponse.redirect(new URL("/portal", req.url));
  }
  return res;
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"] };
