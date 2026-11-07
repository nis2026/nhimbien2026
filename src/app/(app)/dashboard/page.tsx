"use client";

import Link from "next/link";
import Image from "next/image";
import { useAppStore } from "@/store/useAppStore";
import {
  getAllUnitSummaries,
  getOverallCourseProgress,
  getMasteredWordCount,
  getStarredWordCount,
} from "@/lib/progress";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CourseSwitcher } from "@/components/layout/CourseSwitcher";
import { getCourse } from "@/data/courses";
import { getCourseVocabTotal } from "@/data/units";
import { isUnitUnlocked } from "@/lib/storage";

export default function DashboardPage() {
  const { currentProfile, selectedCourseId } = useAppStore();
  if (!currentProfile) return null;

  const isAdmin = currentProfile.role === "admin";
  const course = getCourse(selectedCourseId);
  const summaries = getAllUnitSummaries(currentProfile.id, selectedCourseId);
  const overallPct = getOverallCourseProgress(currentProfile.id, selectedCourseId);
  const masteredCount = getMasteredWordCount(currentProfile.id, selectedCourseId);
  const starredCount = getStarredWordCount(currentProfile.id, selectedCourseId);
  const totalVocab = getCourseVocabTotal(selectedCourseId);

  const reachable = isAdmin ? summaries : summaries.filter((s) => isUnitUnlocked(s.unit.slug));
  const nextUnit =
    reachable.find((s) => s.overallPct < 100) ?? reachable[reachable.length - 1] ?? summaries[0];

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Image
          src={`/avatars/${currentProfile.avatar}.png`}
          alt={currentProfile.name}
          width={56}
          height={56}
          className="rounded-full ring-2 ring-gold"
        />
        <div>
          <h1 className="text-2xl font-bold text-brown">Chào {currentProfile.name}!</h1>
          <p className="text-caramel text-sm">Tiếp tục hành trình học tiếng Anh cùng Mr. Leo nhé.</p>
        </div>
      </div>

      <CourseSwitcher />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={`Tiến độ ${course.title}`} value={`${overallPct}%`} />
        <StatCard label="Từ đã thành thạo" value={`${masteredCount}/${totalVocab}`} />
        <StatCard label="Từ đã đánh dấu ôn" value={`${starredCount}`} />
        <StatCard label="Bài học" value={`${summaries.length} bài`} />
      </div>

      {nextUnit && (
        <Card className="overflow-hidden flex flex-col md:flex-row">
          <div className="relative w-full md:w-64 aspect-video md:aspect-auto shrink-0">
            <Image
              src={nextUnit.unit.coverImage}
              alt={nextUnit.unit.titleEn}
              fill
              sizes="(min-width: 768px) 256px, 100vw"
              className="object-cover"
            />
          </div>
          <div className="p-6 flex flex-col md:flex-row md:items-center gap-4 justify-between flex-1">
            <div>
              <p className="text-xs text-caramel uppercase tracking-wide mb-1">Học tiếp</p>
              <p className="text-lg font-bold text-brown">
                Bài {nextUnit.unit.unitNumber}: {nextUnit.unit.titleEn} — {nextUnit.unit.titleVi}
              </p>
              <div className="mt-3 max-w-sm">
                <ProgressBar percent={nextUnit.overallPct} />
              </div>
            </div>
            <Link
              href={`/units/${nextUnit.unit.slug}`}
              className="gold-gradient text-brown font-semibold px-6 py-3 rounded-xl text-center shadow-sm shrink-0"
            >
              Vào học ngay →
            </Link>
          </div>
        </Card>
      )}

      <div>
        <h2 className="text-lg font-bold text-brown mb-4">
          Tiến độ {summaries.length} bài học — {course.title}
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {summaries.map((s) => {
            const unlocked = isAdmin || isUnitUnlocked(s.unit.slug);
            return (
              <Link key={s.unit.slug} href={`/units/${s.unit.slug}`}>
                <Card
                  className={`overflow-hidden h-full flex flex-col hover:shadow-md hover:-translate-y-0.5 transition ${unlocked ? "" : "opacity-60"}`}
                >
                  <div className="relative aspect-video">
                    <Image
                      src={s.unit.coverImage}
                      alt={s.unit.titleEn}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover"
                    />
                    {!unlocked && (
                      <span className="absolute top-2 right-2 text-xs font-semibold text-white bg-black/60 px-2 py-0.5 rounded-full">
                        🔒
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-xs text-caramel">Bài {s.unit.unitNumber}</p>
                    <p className="font-semibold text-brown leading-snug">{s.unit.titleEn}</p>
                    <p className="text-sm text-caramel mb-3 leading-snug">{s.unit.titleVi}</p>
                    <ProgressBar percent={s.overallPct} size="sm" />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-2xl font-extrabold text-brown">{value}</p>
      <p className="text-xs text-caramel mt-1">{label}</p>
    </Card>
  );
}
