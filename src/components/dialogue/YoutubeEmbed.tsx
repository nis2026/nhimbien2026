"use client";

import { extractYoutubeId } from "@/data/videoLinks";

type Props = {
  url: string | null;
  onPlay?: () => void;
};

export function YoutubeEmbed({ url, onPlay }: Props) {
  if (!url) {
    return null;
  }

  const videoId = extractYoutubeId(url);

  if (!videoId) {
    return (
      <div className="aspect-video w-full rounded-2xl bg-brown/90 text-ivory flex flex-col items-center justify-center gap-2 text-center px-6">
        <span className="text-3xl">🎬</span>
        <p className="font-semibold">Video bài học đang được cập nhật</p>
        <p className="text-xs text-ivory/70">
          Dán link YouTube vào src/data/videoLinks.ts để hiển thị video tại đây.
        </p>
      </div>
    );
  }

  return (
    <div className="aspect-video w-full rounded-2xl overflow-hidden shadow-md">
      <iframe
        className="w-full h-full"
        src={`https://www.youtube.com/embed/${videoId}`}
        title="YouTube video player"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        onLoad={onPlay}
      />
    </div>
  );
}
