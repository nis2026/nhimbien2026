"use client";

import { use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getUnitBySlug } from "@/data/units";
import { useAppStore } from "@/store/useAppStore";
import { isUnitUnlocked } from "@/lib/storage";
import { LockedLessonNotice } from "@/components/ui/LockedLessonNotice";
import { MatchMeaningGame } from "@/components/games/MatchMeaningGame";

export default function MatchGamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const unit = getUnitBySlug(slug);
  const { currentProfile } = useAppStore();

  if (!unit) return notFound();
  if (!currentProfile) return null;

  const unlocked = currentProfile.role === "admin" || isUnitUnlocked(unit.slug);
  if (!unlocked) return <LockedLessonNotice />;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <Link href="/games" className="text-sm text-caramel hover:underline">
          ← Quay lại chọn game
        </Link>
        <h1 className="text-2xl font-bold text-brown mt-2">
          🧩 Ghép nghĩa — Bài {unit.unitNumber}: {unit.titleVi}
        </h1>
      </div>
      <MatchMeaningGame vocabulary={unit.vocabulary} unitSlug={unit.slug} profileId={currentProfile.id} />
    </div>
  );
}
