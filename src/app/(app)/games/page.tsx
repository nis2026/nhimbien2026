"use client";

import { useState } from "react";
import Link from "next/link";
import { getUnitsByCourse } from "@/data/units";
import { useAppStore } from "@/store/useAppStore";
import { isUnitUnlocked } from "@/lib/storage";
import { Card } from "@/components/ui/Card";
import { CourseSwitcher } from "@/components/layout/CourseSwitcher";

export default function GamesHubPage() {
  const { currentProfile, selectedCourseId } = useAppStore();
  const isAdmin = currentProfile?.role === "admin";
  const courseUnits = getUnitsByCourse(selectedCourseId);
  const availableUnits = isAdmin ? courseUnits : courseUnits.filter((u) => isUnitUnlocked(u.slug));
  const [selectedSlug, setSelectedSlug] = useState(availableUnits[0]?.slug ?? "");

  // Reset the selected unit whenever the course switches — done during render
  // (React's documented pattern for this) instead of an effect, so there's no
  // extra render tick where the dropdown briefly still shows the old course's unit.
  const [renderedCourseId, setRenderedCourseId] = useState(selectedCourseId);
  if (selectedCourseId !== renderedCourseId) {
    setRenderedCourseId(selectedCourseId);
    setSelectedSlug(availableUnits[0]?.slug ?? "");
  }

  const selectedUnit = availableUnits.find((u) => u.slug === selectedSlug) ?? availableUnits[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brown">Game ôn từ vựng</h1>
        <p className="text-caramel text-sm mt-1">Chọn khóa học, chọn bài học, sau đó chọn game để luyện từ vựng.</p>
      </div>

      <CourseSwitcher />

      {availableUnits.length === 0 ? (
        <Card className="p-8 text-center text-caramel">
          Chưa có bài học nào được mở khóa. Vui lòng chờ admin mở khóa bài học.
        </Card>
      ) : (
        <>
          <div>
            <label className="text-sm font-semibold text-brown block mb-2">Chọn bài học</label>
            <select
              value={selectedSlug || selectedUnit?.slug}
              onChange={(e) => setSelectedSlug(e.target.value)}
              className="w-full max-w-md px-4 py-2.5 rounded-xl border border-gold-light focus:outline-none focus:ring-2 focus:ring-gold bg-white"
            >
              {availableUnits.map((u) => (
                <option key={u.slug} value={u.slug}>
                  Bài {u.unitNumber}: {u.titleVi}
                </option>
              ))}
            </select>
          </div>

          {selectedUnit && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Link href={`/games/challenge/${selectedUnit.slug}`}>
                <Card className="p-6 hover:shadow-md hover:-translate-y-0.5 transition h-full">
                  <p className="text-3xl mb-2">🏆</p>
                  <p className="font-bold text-brown">Thử thách từ vựng</p>
                  <p className="text-sm text-caramel mt-1">
                    Chọn đúng từ tiếng Anh cho nghĩa tiếng Việt trong 20 giây — tính điểm, combo và kỷ lục.
                  </p>
                </Card>
              </Link>
              <Link href={`/games/match/${selectedUnit.slug}`}>
                <Card className="p-6 hover:shadow-md hover:-translate-y-0.5 transition h-full">
                  <p className="text-3xl mb-2">🧩</p>
                  <p className="font-bold text-brown">Ghép nghĩa</p>
                  <p className="text-sm text-caramel mt-1">
                    Ghép từ tiếng Anh với nghĩa tiếng Việt tương ứng, càng ít sai càng cao điểm.
                  </p>
                </Card>
              </Link>
              <Link href={`/games/listen/${selectedUnit.slug}`}>
                <Card className="p-6 hover:shadow-md hover:-translate-y-0.5 transition h-full">
                  <p className="text-3xl mb-2">🎧</p>
                  <p className="font-bold text-brown">Nghe &amp; chọn từ</p>
                  <p className="text-sm text-caramel mt-1">
                    Nghe phát âm và chọn đúng từ tiếng Anh trong 4 lựa chọn.
                  </p>
                </Card>
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
