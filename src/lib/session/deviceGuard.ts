"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function readDsIdCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )ds_id=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function clearDsIdCookie() {
  if (typeof document === "undefined") return;
  document.cookie = "ds_id=; Max-Age=0; path=/";
}

// Watches for this account logging in on another device. The server rotates
// miu_active_sessions.device_session_id on every login (see
// auth/callback/route.ts); once this device's cookie no longer matches that
// row, it has been replaced. Realtime gives an (almost) instant kick; the 45s
// poll against a proxy-guarded endpoint is the fallback if the realtime
// socket never connects (some networks block websockets, or the
// "alter publication supabase_realtime add table ..." line in
// supabase/migrations/0001_miu_schema.sql hasn't been run).
export function startDeviceGuard(userId: string, onKicked: () => void): () => void {
  const supabase = getSupabaseBrowserClient();
  const localDsId = readDsIdCookie();

  const channel = supabase
    .channel(`miu-active-session-${userId}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "miu_active_sessions", filter: `user_id=eq.${userId}` },
      (payload: { new: { device_session_id?: string } }) => {
        const newId = payload.new.device_session_id;
        if (newId && newId !== localDsId) onKicked();
      }
    )
    .subscribe();

  const interval = setInterval(async () => {
    try {
      const res = await fetch("/api/session/ping", { cache: "no-store" });
      if (res.status === 401) onKicked();
    } catch {
      // transient network error — the next poll or the realtime channel will catch a real kick
    }
  }, 45_000);

  return () => {
    clearInterval(interval);
    supabase.removeChannel(channel);
  };
}
