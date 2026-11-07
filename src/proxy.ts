import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isAdminEmail } from "@/lib/adminConfig";

// Runs on every request (except static assets — see the matcher below).
// Single active-device enforcement: each Google login overwrites the user's
// one row in miu_active_sessions with a fresh device id (see
// src/app/auth/callback/route.ts). If the "ds_id" cookie on THIS request no
// longer matches that row, this device has been replaced by a newer login
// elsewhere — sign it out immediately, even on API calls, so a device that
// never navigates again still gets caught by its next poll.
export async function proxy(req: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request: req });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) req.cookies.set(name, value);
        response = NextResponse.next({ request: req });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return response;

  // Admin account is exempt from single-device enforcement — it may stay
  // signed in on as many devices as it likes and is never kicked.
  if (isAdminEmail(user.email)) return response;

  const dsId = req.cookies.get("ds_id")?.value ?? null;
  const { data: activeSession } = await supabase
    .from("miu_active_sessions")
    .select("device_session_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const kicked = Boolean(activeSession && dsId && activeSession.device_session_id !== dsId);
  if (kicked) {
    // scope: "local" — the default ("global") revokes the user's refresh
    // token account-wide, which would also log out the *new* device that
    // just replaced this one.
    await supabase.auth.signOut({ scope: "local" });
    response.cookies.delete("ds_id");
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "device_kicked" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/?kicked=1", req.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
