"use client";

import { CSSProperties, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => isStandalone());
  const [ios] = useState(() => isIos());
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [showUnsupported, setShowUnsupported] = useState(false);

  useEffect(() => {
    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function handleClick() {
    if (installed) return;
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setDeferredPrompt(null);
      return;
    }
    if (ios) {
      setShowIosGuide(true);
      return;
    }
    setShowUnsupported(true);
  }

  const guideModal = (showIosGuide || showUnsupported) && (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4"
      onClick={() => {
        setShowIosGuide(false);
        setShowUnsupported(false);
      }}
    >
      <Card className="max-w-xs w-full relative p-5" onClick={(e) => e.stopPropagation()}>
        <button
          aria-label="Đóng"
          onClick={() => {
            setShowIosGuide(false);
            setShowUnsupported(false);
          }}
          className="absolute top-3 right-3 text-caramel/60 hover:text-caramel"
        >
          ✕
        </button>
        {showIosGuide ? (
          <>
            <p className="text-sm font-bold text-brown mb-3">Ghim ra màn hình chính</p>
            <ol className="text-sm text-brown space-y-2.5">
              <li className="flex items-start gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full bg-ivory grid place-items-center text-[11px] font-semibold text-caramel">
                  1
                </span>
                Nhấn nút 📤 <b>Chia sẻ</b> trên thanh Safari.
              </li>
              <li className="flex items-start gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full bg-ivory grid place-items-center text-[11px] font-semibold text-caramel">
                  2
                </span>
                Chọn ➕ <b>&quot;Thêm vào MH chính&quot;</b> (Add to Home Screen).
              </li>
              <li className="flex items-start gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full bg-ivory grid place-items-center text-[11px] font-semibold text-caramel">
                  3
                </span>
                Nhấn <b>&quot;Thêm&quot;</b> ở góc trên bên phải.
              </li>
            </ol>
          </>
        ) : (
          <>
            <p className="text-sm font-bold text-brown mb-2">Chưa thể cài trực tiếp</p>
            <p className="text-sm text-brown/80">
              Trình duyệt này chưa hỗ trợ cài app trực tiếp. Hãy mở trang bằng Chrome/Edge trên máy tính hoặc
              Android, hoặc dùng menu trình duyệt để &quot;Thêm vào màn hình chính&quot;.
            </p>
          </>
        )}
        <Button
          className="w-full mt-4"
          onClick={() => {
            setShowIosGuide(false);
            setShowUnsupported(false);
          }}
        >
          Đã hiểu
        </Button>
      </Card>
    </div>
  );

  return { installed, handleClick, guideModal };
}

export function InstallAppButton({ className }: { className?: string }) {
  const { installed, handleClick, guideModal } = useInstallPrompt();
  if (installed) return null;

  return (
    <>
      <Button variant="outline" onClick={handleClick} className={className}>
        ⬇️ Tải app
      </Button>
      {guideModal}
    </>
  );
}

/** Invisible, absolutely-positioned trigger — used to overlay a real click target
 * on top of a "Tải app" button that's baked into a static design image. */
export function InstallAppOverlayButton({ style }: { style: CSSProperties }) {
  const { installed, handleClick, guideModal } = useInstallPrompt();
  if (installed) return null;

  return (
    <>
      <button
        aria-label="Tải app"
        onClick={handleClick}
        className="absolute rounded-full cursor-pointer hover:bg-white/10 active:bg-white/20 transition"
        style={style}
      />
      {guideModal}
    </>
  );
}
