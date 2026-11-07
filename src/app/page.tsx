"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppStore } from "@/store/useAppStore";
import {
  getProfileByEmail,
  pullCloudProfileAndProgress,
  migrateProfileToCloudId,
  setCloudUserId,
  pullUnitLocksFromCloud,
} from "@/lib/storage";
import { isSupabaseConfigured, getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { InstallAppOverlayButton } from "@/components/layout/InstallAppButton";
import type { Profile } from "@/types";

type GoogleProfile = { id: string; email: string; name: string; photoUrl: string | null };

const ERROR_MESSAGES: Record<string, string> = {
  missing_code: "Đăng nhập bị hủy hoặc thiếu mã xác thực. Vui lòng thử lại.",
  auth_failed: "Đăng nhập Google thất bại. Vui lòng thử lại.",
  session_expired: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại bằng Google.",
};

// Design's native pixel size — the overlay hit-boxes below are measured as
// percentages of this, so they track the image at any responsive scale.
const ART_W = 1448;
const ART_H = 1086;
const GOOGLE_BTN = { left: 26.24, top: 49.54, width: 52.28, height: 8.1 };
const TAI_APP_BTN = { left: 38.67, top: 67.59, width: 22.73, height: 8.11 };
const CARD_BOX = { left: 21.5, top: 44.3, width: 61.5, height: 33.2 };

function pct(box: { left: number; top: number; width: number; height: number }) {
  return {
    left: `${box.left}%`,
    top: `${box.top}%`,
    width: `${box.width}%`,
    height: `${box.height}%`,
  };
}

export default function HomePage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
      {isSupabaseConfigured() ? (
        <Suspense fallback={<LoginArtwork />}>
          <GoogleLoginPanel />
        </Suspense>
      ) : (
        <div className="gap-8 flex flex-col items-center">
          <Brand />
          <DemoLoginPanel />
        </div>
      )}
    </div>
  );
}

function LoginArtwork({ children }: { children?: React.ReactNode }) {
  return (
    <div className="relative w-full mx-auto" style={{ maxWidth: ART_W, aspectRatio: `${ART_W} / ${ART_H}` }}>
      <Image
        src="/login-bg.jpg"
        alt="VIP Coach Ms. Nhím Biển — English for a Brighter You"
        fill
        priority
        sizes="(min-width: 1448px) 1448px, 100vw"
        className="object-contain select-none rounded-2xl"
      />
      {children}
    </div>
  );
}

function Brand() {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-4 mb-4">
        <Image src="/avatars/mr-leo.png" alt="Mr. Leo" width={72} height={72} className="rounded-full ring-4 ring-gold" />
        <Image src="/avatars/ms-nhim-bien.png" alt="Ms. Nhím Biển" width={72} height={72} className="rounded-full ring-4 ring-gold" />
      </div>
      <h1 className="text-3xl md:text-4xl font-extrabold text-brown">VIP COACH MS. NHÍM BIỂN</h1>
      <p className="text-caramel mt-2">
        Giao tiếp tiếng Anh kèm 1-1 cùng Mr. Leo — Khóa Starter, 25 bài
      </p>
    </div>
  );
}

function GoogleLoginPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hydrate, selectProfile, addProfile } = useAppStore();

  const [checking, setChecking] = useState(true);
  const [googleProfile, setGoogleProfile] = useState<GoogleProfile | null>(null);
  const [avatar, setAvatar] = useState<Profile["avatar"]>("ms-miu");
  const [submitting, setSubmitting] = useState(false);
  const errorParam = searchParams.get("error");
  const kicked = searchParams.get("kicked") === "1";

  useEffect(() => {
    hydrate();
    let cancelled = false;

    (async () => {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;

      if (!user || !user.email) {
        setChecking(false);
        return;
      }

      const email = user.email;
      const name =
        (user.user_metadata?.full_name as string | undefined) ||
        (user.user_metadata?.name as string | undefined) ||
        email.split("@")[0];
      const photoUrl = (user.user_metadata?.avatar_url as string | undefined) || null;

      setCloudUserId(user.id);
      await pullUnitLocksFromCloud();
      if (cancelled) return;

      // 1) This Google account already has a cloud profile (from any device) — use it.
      const cloudProfile = await pullCloudProfileAndProgress(user.id);
      if (cancelled) return;
      if (cloudProfile) {
        hydrate();
        selectProfile(cloudProfile.id);
        router.replace("/dashboard");
        return;
      }

      // 2) No cloud profile yet. A local profile for this email may already exist
      //    (created before cloud sync existed) — adopt it under the cloud id.
      const existing = getProfileByEmail(email);
      if (existing) {
        const migrated = await migrateProfileToCloudId(existing, user.id);
        if (cancelled) return;
        hydrate();
        selectProfile(migrated.id);
        router.replace("/dashboard");
        return;
      }

      setGoogleProfile({ id: user.id, email, name, photoUrl });
      setChecking(false);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGoogleSignIn() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  function handleConfirmAvatar() {
    if (!googleProfile) return;
    setSubmitting(true);
    addProfile(googleProfile.name, avatar, googleProfile.email, googleProfile.id);
    router.replace("/dashboard");
  }

  if (checking) {
    return <LoginArtwork />;
  }

  if (googleProfile) {
    return (
      <LoginArtwork>
        <div className="absolute flex flex-col" style={pct(CARD_BOX)}>
          <Card className="w-full h-full flex flex-col items-center justify-center gap-3 sm:gap-4 p-3 sm:p-6">
            <div className="text-center">
              <p className="text-xs sm:text-sm font-semibold text-brown">Chào {googleProfile.name}!</p>
              <p className="text-[10px] sm:text-xs text-caramel mt-1">Chọn nhân vật đồng hành cho bạn</p>
            </div>
            <div className="flex justify-center gap-3 sm:gap-4">
              {(["ms-miu", "mr-leo"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => setAvatar(a)}
                  className={`rounded-full p-1 transition ${avatar === a ? "ring-4 ring-gold" : "ring-2 ring-transparent opacity-60"}`}
                >
                  <Image
                    src={`/avatars/${a}.png`}
                    alt={a}
                    width={56}
                    height={56}
                    className="rounded-full w-10 h-10 sm:w-14 sm:h-14"
                  />
                </button>
              ))}
            </div>
            <Button className="w-full max-w-[240px] text-sm" onClick={handleConfirmAvatar} disabled={submitting}>
              Bắt đầu học
            </Button>
          </Card>
        </div>
      </LoginArtwork>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {errorParam && ERROR_MESSAGES[errorParam] && (
        <p className="text-sm text-red-600 text-center">{ERROR_MESSAGES[errorParam]}</p>
      )}
      {kicked && (
        <p className="text-sm text-caramel text-center max-w-md">
          Tài khoản này vừa đăng nhập ở một thiết bị khác nên đã bị đăng xuất tại đây — mỗi tài khoản chỉ hoạt
          động trên 1 thiết bị. Đăng nhập lại nếu đây là thiết bị bạn muốn dùng.
        </p>
      )}
      <LoginArtwork>
        <button
          aria-label="Đăng nhập bằng Google"
          onClick={handleGoogleSignIn}
          className="absolute rounded-full cursor-pointer hover:brightness-105 active:brightness-95 transition"
          style={pct(GOOGLE_BTN)}
        />
        <InstallAppOverlayButton style={pct(TAI_APP_BTN)} />
      </LoginArtwork>
    </div>
  );
}

function DemoLoginPanel() {
  const router = useRouter();
  const { profiles, hydrate, hydrated, selectProfile, addProfile, removeProfile, setProfileEmail } =
    useAppStore();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatar, setAvatar] = useState<Profile["avatar"]>("ms-miu");
  const [showForm, setShowForm] = useState(false);
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null);
  const [editingEmailValue, setEditingEmailValue] = useState("");

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  function handleEnter(id: string) {
    selectProfile(id);
    router.push("/dashboard");
  }

  function handleCreate() {
    if (!name.trim()) return;
    addProfile(name, avatar, email);
    router.push("/dashboard");
  }

  function startEditEmail(p: Profile) {
    setEditingEmailId(p.id);
    setEditingEmailValue(p.email ?? "");
  }

  function saveEditEmail(id: string) {
    setProfileEmail(id, editingEmailValue);
    setEditingEmailId(null);
  }

  return (
    <>
      <Card className="w-full max-w-md p-6">
        <p className="text-xs text-caramel/70 text-center mb-4">
          ⚠️ Đăng nhập Google chưa được cấu hình — đang dùng chế độ demo tạm thời.
        </p>
        {!hydrated ? (
          <p className="text-center text-caramel">Đang tải...</p>
        ) : (
          <>
            {profiles.length > 0 && (
              <div className="mb-6">
                <p className="text-sm font-semibold text-brown mb-3">Chọn hồ sơ học viên</p>
                <div className="space-y-2">
                  {profiles.map((p) =>
                    editingEmailId === p.id ? (
                      <div key={p.id} className="flex items-center gap-2 p-2 rounded-xl border border-gold bg-ivory">
                        <input
                          autoFocus
                          value={editingEmailValue}
                          onChange={(e) => setEditingEmailValue(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && saveEditEmail(p.id)}
                          placeholder="Nhập email admin"
                          className="flex-1 min-w-0 text-sm px-2.5 py-1.5 rounded-lg border border-gold-light focus:outline-none focus:ring-2 focus:ring-gold"
                        />
                        <button
                          onClick={() => saveEditEmail(p.id)}
                          className="text-xs font-semibold text-brown px-2 py-1.5 rounded-lg gold-gradient shrink-0"
                        >
                          Lưu
                        </button>
                        <button onClick={() => setEditingEmailId(null)} className="text-xs text-caramel/70 px-2 py-1.5 shrink-0">
                          Hủy
                        </button>
                      </div>
                    ) : (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 p-2 rounded-xl border border-gold-light/60 hover:bg-ivory transition"
                      >
                        <button
                          onClick={() => handleEnter(p.id)}
                          className="flex items-center gap-3 flex-1 text-left cursor-pointer min-w-0"
                        >
                          <Image
                            src={`/avatars/${p.avatar}.png`}
                            alt={p.name}
                            width={36}
                            height={36}
                            className="rounded-full shrink-0"
                          />
                          <span className="font-medium text-brown truncate">{p.name}</span>
                          {p.role === "admin" && (
                            <span className="text-[10px] font-bold text-brown gold-gradient px-2 py-0.5 rounded-full shrink-0">
                              ADMIN
                            </span>
                          )}
                        </button>
                        <button
                          onClick={() => startEditEmail(p)}
                          className="text-xs text-caramel/60 hover:text-caramel px-1.5 shrink-0"
                          title="Gán email / nhận quyền admin"
                        >
                          🔑
                        </button>
                        <button
                          onClick={() => removeProfile(p.id)}
                          className="text-xs text-caramel/60 hover:text-red-500 px-1.5 shrink-0"
                          title="Xóa hồ sơ"
                        >
                          ✕
                        </button>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {!showForm ? (
              <Button className="w-full" onClick={() => setShowForm(true)}>
                + Tạo hồ sơ học viên mới
              </Button>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-brown block mb-1">Tên của bạn</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="VD: Chị Nhím Biển"
                    className="w-full px-4 py-2.5 rounded-xl border border-gold-light focus:outline-none focus:ring-2 focus:ring-gold"
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-brown block mb-1">
                    Email <span className="font-normal text-caramel/70">(không bắt buộc)</span>
                  </label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Nhập email admin để nhận quyền quản trị"
                    className="w-full px-4 py-2.5 rounded-xl border border-gold-light focus:outline-none focus:ring-2 focus:ring-gold"
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-brown block mb-2">Chọn avatar</label>
                  <div className="flex gap-3">
                    {(["ms-miu", "mr-leo"] as const).map((a) => (
                      <button
                        key={a}
                        onClick={() => setAvatar(a)}
                        className={`rounded-full p-1 transition ${avatar === a ? "ring-4 ring-gold" : "ring-2 ring-transparent opacity-60"}`}
                      >
                        <Image src={`/avatars/${a}.png`} alt={a} width={56} height={56} className="rounded-full" />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>
                    Hủy
                  </Button>
                  <Button className="flex-1" onClick={handleCreate} disabled={!name.trim()}>
                    Bắt đầu học
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      <p className="text-xs text-caramel/70 max-w-md text-center">
        Chế độ demo: tiến độ được lưu thật trên trình duyệt này (localStorage) theo từng hồ sơ, không giả lập.
      </p>
    </>
  );
}
