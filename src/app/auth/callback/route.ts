import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdminEmail } from "@/lib/adminConfig";

// Overwrites the user's single active-session row with a brand new device id.
// Whichever device held the old id gets kicked out by proxy.ts on its next request.
// Writes with the user's OWN just-exchanged session (RLS lets a user upsert
// only their own row — see supabase/migrations/0001_nhim_bien_schema.sql),
// so no service-role key is needed for this feature.
async function rotateActiveSession(supabase: SupabaseClient, userId: string, userAgent: string | null): Promise<string> {
  const deviceSessionId = crypto.randomUUID();
  const { error } = await supabase.from("nhim_bien_active_sessions").upsert(
    { user_id: userId, device_session_id: deviceSessionId, user_agent: userAgent, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  if (error) throw error;
  return deviceSessionId;
}

// Google OAuth redirects here with ?code=... after the user consents.
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/?error=missing_code`);
  }

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/?error=auth_failed`);
  }

  // Admin account is exempt from single-device enforcement (see proxy.ts) —
  // skip rotating a device session for it entirely so it never gets kicked.
  if (!isAdminEmail(data.user.email)) {
    try {
      const deviceSessionId = await rotateActiveSession(supabase, data.user.id, req.headers.get("user-agent"));
      const cookieStore = await cookies();
      cookieStore.set("ds_id", deviceSessionId, {
        httpOnly: false,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    } catch {
      // Table/policies not migrated yet (supabase/migrations/0001_nhim_bien_schema.sql)
      // — don't block sign-in over it, just skip single-device enforcement for this session.
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
