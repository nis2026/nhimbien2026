"use client";

import { useState } from "react";
import Image from "next/image";
import { getHonorBoard } from "@/lib/honorBoard";
import { Card } from "@/components/ui/Card";
import { useAppStore } from "@/store/useAppStore";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function HonorBoardPage() {
  const { currentProfile } = useAppStore();
  const [entries] = useState(() => getHonorBoard());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brown">🏆 Bảng vinh danh</h1>
        <p className="text-caramel text-sm mt-1">
          Vinh danh các hồ sơ đạt từ 50% tiến độ khóa học trở lên (tính trên trình duyệt này).
        </p>
      </div>

      {entries.length === 0 ? (
        <Card className="p-8 text-center text-caramel">
          Chưa có hồ sơ nào đạt 50% tiến độ. Tiếp tục học để xuất hiện tại đây nhé!
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, i) => (
            <Card
              key={entry.profile.id}
              className={`p-4 flex items-center gap-4 ${
                entry.profile.id === currentProfile?.id ? "ring-2 ring-gold" : ""
              }`}
            >
              <span className="text-2xl w-8 text-center">{MEDALS[i] ?? `#${i + 1}`}</span>
              <Image
                src={`/avatars/${entry.profile.avatar}.png`}
                alt={entry.profile.name}
                width={44}
                height={44}
                className="rounded-full"
              />
              <div className="flex-1">
                <p className="font-semibold text-brown">{entry.profile.name}</p>
                <p className="text-xs text-caramel">{entry.masteredWords} từ đã thành thạo</p>
              </div>
              <p className="text-xl font-extrabold text-brown">{entry.overallPct}%</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
