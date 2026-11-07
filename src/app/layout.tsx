import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

// Used by the practice screens (game, speaking) that mirror the Tuan Tran lesson pages.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
});

const APP_URL = "https://nhimbien2026.vercel.app";
const APP_TITLE = "VIP Coach Ms. Nhím Biển";
const APP_DESCRIPTION =
  "Học từ vựng và hội thoại tiếng Anh giao tiếp — Khóa Starter 25 bài kèm 1-1 cùng Mr. Leo, game ôn từ, theo dõi tiến độ.";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: `${APP_TITLE} — Giao tiếp tiếng Anh`,
  description: APP_DESCRIPTION,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_TITLE,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: APP_TITLE,
    description: APP_DESCRIPTION,
    url: APP_URL,
    siteName: APP_TITLE,
    locale: "vi_VN",
    type: "website",
    images: [{ url: "/login-bg.jpg", width: 1448, height: 1086, alt: APP_TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: APP_TITLE,
    description: APP_DESCRIPTION,
    images: ["/login-bg.jpg"],
  },
};

export const viewport = {
  themeColor: "#F6C445",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${poppins.variable} ${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">{children}</body>
    </html>
  );
}
