"use client";

import { use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getUnitBySlug } from "@/data/units";
import { useAppStore } from "@/store/useAppStore";
import { isUnitUnlocked } from "@/lib/storage";
import { LockedLessonNotice } from "@/components/ui/LockedLessonNotice";
import { VocabChallengeGame } from "@/components/practice/VocabChallengeGame";

export default function ChallengeGamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const unit = getUnitBySlug(slug);
  const { currentProfile } = useAppStore();

  if (!unit) return notFound();
  if (!currentProfile) return null;

  const unlocked = currentProfile.role === "admin" || isUnitUnlocked(unit.slug);
  if (!unlocked) return <LockedLessonNotice />;

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <Link href="/games" className="text-sm text-caramel hover:underline">
        ← Quay lại chọn game
      </Link>
      <VocabChallengeGame
        key={unit.slug}
        vocabulary={unit.vocabulary}
        unitNumber={unit.unitNumber}
        unitTitle={unit.titleEn}
        unitSlug={unit.slug}
        profileId={currentProfile.id}
        courseTag="STARTER"
      />
    </div>
  );
}
