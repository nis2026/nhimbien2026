"use client";

import Link from "next/link";
import Image from "next/image";
import { useAppStore } from "@/store/useAppStore";
import { getAllUnitSummaries } from "@/lib/progress";
import { isUnitUnlocked } from "@/lib/storage";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CourseSwitcher } from "@/components/layout/CourseSwitcher";
import { getCourse } from "@/data/courses";

export default function UnitsPage() {
  const { currentProfile, selectedCourseId } = useAppStore();
  if (!currentProfile) return null;

  const isAdmin = currentProfile.role === "admin";
  const course = getCourse(selectedCourseId);
  const summaries = getAllUnitSummaries(currentProfile.id, selectedCourseId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brown">{summaries.length} Bài học — {course.title}</h1>
        <p className="text-caramel text-sm mt-1">
          Mỗi bài gồm 13–20 từ vựng, 1 hội thoại mẫu và video bài giảng của Mr. Leo.
        </p>
      </div>

      <CourseSwitcher />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {summaries.map((s) => {
          const unlocked = isAdmin || isUnitUnlocked(s.unit.slug);
          return (
            <Link key={s.unit.slug} href={`/units/${s.unit.slug}`}>
              <Card
                className={`overflow-hidden h-full flex flex-col hover:shadow-md hover:-translate-y-0.5 transition ${
                  unlocked ? "" : "opacity-60"
                }`}
              >
                <div className="relative aspect-video">
                  <Image
                    src={s.unit.coverImage}
                    alt={s.unit.titleEn}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                  />
                  <span className="absolute top-2 left-2 text-xs font-bold text-caramel bg-white/90 px-2.5 py-1 rounded-full">
                    Bài {s.unit.unitNumber}
                  </span>
                  {!unlocked && (
                    <span className="absolute top-2 right-2 text-xs font-semibold text-white bg-black/60 px-2.5 py-1 rounded-full">
                      🔒 Đang khóa
                    </span>
                  )}
                </div>
                <div className="p-5 flex flex-col gap-3 flex-1">
                  {unlocked && (
                    <span className="text-xs -mt-1">
                      {s.unit.youtubeUrl ? (
                        <span className="text-green-700">▶ Có video</span>
                      ) : (
                        <span className="text-caramel/50">Video đang cập nhật</span>
                      )}
                    </span>
                  )}
                  <div>
                    <p className="font-bold text-brown leading-snug">{s.unit.titleEn}</p>
                    <p className="text-sm text-caramel">{s.unit.titleVi}</p>
                  </div>
                  <ProgressBar percent={s.overallPct} size="sm" />
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
