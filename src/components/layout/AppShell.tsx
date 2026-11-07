"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { navItems } from "./navItems";
import { useAppStore } from "@/store/useAppStore";
import { getOverallCourseProgress } from "@/lib/progress";
import { getCourse } from "@/data/courses";
import { isSupabaseConfigured, getSupabaseBrowserClient } from "@/lib/supabase/client";
import { startDeviceGuard, clearDsIdCookie } from "@/lib/session/deviceGuard";
import { isAdminEmail } from "@/lib/adminConfig";
import { subscribeCloudUnitLocks } from "@/lib/supabase/sync";
import { ProgressBar } from "@/components/ui/ProgressBar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentProfile, hydrated, hydrate, syncFromCloud, refreshUnitLocks, logout, selectedCourseId } =
    useAppStore();

  useEffect(() => {
    hydrate();
    void syncFromCloud();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hydrated && !currentProfile) {
      router.replace("/");
    }
  }, [hydrated, currentProfile, router]);

  // Hồ sơ lưu trên máy có thể còn trong khi phiên Google đã mất (hết hạn, hoặc
  // bị đăng xuất từ thiết bị khác). Khi đó mọi thao tác ghi lên máy chủ đều bị
  // từ chối (401) — admin tưởng đã mở khóa bài nhưng học viên không thấy — nên
  // bắt đăng nhập lại thay vì chạy tiếp với hồ sơ "ma".
  useEffect(() => {
    if (!hydrated || !currentProfile || !isSupabaseConfigured()) return;
    let cancelled = false;
    (async () => {
      const {
        data: { session },
      } = await getSupabaseBrowserClient().auth.getSession();
      if (cancelled || session) return;
      logout();
      router.replace("/?error=session_expired");
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, currentProfile?.id]);

  // Admin mở/khóa bài → học viên đang mở app thấy ngay, không cần tải lại trang:
  // Realtime báo gần như tức thì; poll 15s + khi quay lại tab là dự phòng cho
  // mạng chặn websocket hoặc khi máy ngủ làm rớt kết nối.
  useEffect(() => {
    if (!hydrated || !currentProfile || !isSupabaseConfigured()) return;

    const refresh = () => void refreshUnitLocks();
    const unsubscribe = subscribeCloudUnitLocks(refresh);
    const interval = setInterval(refresh, 15_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);

    return () => {
      unsubscribe();
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, currentProfile?.id]);

  // Mỗi tài khoản chỉ hoạt động trên 1 thiết bị — nếu tài khoản này vừa đăng
  // nhập ở thiết bị khác, thiết bị hiện tại tự đăng xuất (xem proxy.ts +
  // src/lib/session/deviceGuard.ts). Tài khoản admin được miễn — đăng nhập
  // bao nhiêu thiết bị cũng được.
  useEffect(() => {
    if (!hydrated || !currentProfile || currentProfile.role === "admin" || !isSupabaseConfigured()) return;

    let stopGuard: (() => void) | null = null;
    let cancelled = false;

    async function onKicked() {
      await getSupabaseBrowserClient().auth.signOut();
      clearDsIdCookie();
      logout();
      router.replace("/?kicked=1");
    }

    (async () => {
      const {
        data: { user },
      } = await getSupabaseBrowserClient().auth.getUser();
      if (cancelled || !user || isAdminEmail(user.email)) return;
      stopGuard = startDeviceGuard(user.id, onKicked);
    })();

    return () => {
      cancelled = true;
      stopGuard?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, currentProfile?.id]);

  if (!hydrated || !currentProfile) {
    return (
      <div className="flex-1 flex items-center justify-center text-caramel">
        Đang tải...
      </div>
    );
  }

  const overallPct = getOverallCourseProgress(currentProfile.id, selectedCourseId);
  const courseTitle = getCourse(selectedCourseId).title;
  const items =
    currentProfile.role === "admin"
      ? [...navItems, { href: "/admin", label: "Quản trị", icon: "🛡️" }]
      : navItems;

  return (
    <div className="flex-1 flex flex-col md:flex-row min-h-screen">
      <aside className="md:w-64 shrink-0 bg-white/70 backdrop-blur border-b md:border-b-0 md:border-r border-gold-light/60 flex md:flex-col">
        <div className="p-4 md:p-6 flex items-center gap-3 border-b border-gold-light/60 md:border-b-0">
          <Image
            src="/avatars/ms-nhim-bien.png"
            alt="Ms. Nhím Biển"
            width={44}
            height={44}
            className="rounded-full ring-2 ring-gold"
          />
          <div className="hidden sm:block">
            <p className="font-bold text-brown leading-tight">VIP COACH</p>
            <p className="text-xs text-caramel leading-tight">Ms. Nhím Biển</p>
          </div>
        </div>

        <nav className="flex md:flex-col flex-1 md:p-4 gap-1 overflow-x-auto md:overflow-visible">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link flex items-center gap-2 px-4 py-3 md:rounded-xl text-sm font-medium whitespace-nowrap transition ${
                  active
                    ? "gold-gradient text-brown shadow-sm"
                    : "text-caramel hover:bg-ivory"
                }`}
              >
                <span className={`nav-icon ${active ? "nav-icon-active" : ""}`}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:block p-4 border-t border-gold-light/60">
          <p className="text-xs text-caramel mb-2">Tiến độ {courseTitle}: {currentProfile.name}</p>
          <ProgressBar percent={overallPct} />
          <button
            onClick={async () => {
              if (isSupabaseConfigured()) {
                await getSupabaseBrowserClient().auth.signOut();
              }
              logout();
              router.replace("/");
            }}
            className="mt-4 text-xs text-caramel/70 hover:text-caramel underline"
          >
            {isSupabaseConfigured() ? "Đăng xuất" : "Đổi hồ sơ học viên"}
          </button>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8 max-w-6xl w-full mx-auto">{children}</main>
    </div>
  );
}
