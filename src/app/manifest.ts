import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VIP Coach Ms. Nhím Biển",
    short_name: "VIP Coach Nhím Biển",
    description: "Giao tiếp tiếng Anh kèm 1-1 cùng Mr. Leo — Khóa Starter, 25 bài, từ vựng, hội thoại, game ôn tập.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#FFF8E8",
    theme_color: "#F6C445",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
