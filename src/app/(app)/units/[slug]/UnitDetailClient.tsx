"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getUnitBySlug } from "@/data/units";
import { useAppStore } from "@/store/useAppStore";
import { getUnitProgressSummary } from "@/lib/progress";
import { HoneycombVocabDeck } from "@/components/vocabulary/HoneycombVocabDeck";
import { VocabQuiz } from "@/components/vocabulary/VocabQuiz";
import { DialogueViewer } from "@/components/dialogue/DialogueViewer";
import { YoutubeEmbed } from "@/components/dialogue/YoutubeEmbed";
import { DialoguePractice } from "@/components/practice/DialoguePractice";
import { VocabChallengeGame } from "@/components/practice/VocabChallengeGame";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { LockedLessonNotice } from "@/components/ui/LockedLessonNotice";
import { updateUnitProgress, isUnitUnlocked } from "@/lib/storage";

type Tab = "vocab" | "dialogue" | "speaking" | "game" | "quiz" | "flashGame";

export function UnitDetailClient({ slug }: { slug: string }) {
  const unit = getUnitBySlug(slug);
  const { currentProfile } = useAppStore();
  const [tab, setTab] = useState<Tab>("vocab");

  if (!unit) return notFound();
  if (!currentProfile) return null;

  const isAdmin = currentProfile.role === "admin";
  const unlocked = isAdmin || isUnitUnlocked(unit.slug);
  const summary = getUnitProgressSummary(currentProfile.id, unit);

  function handleVideoPlay() {
    if (!currentProfile) return;
    updateUnitProgress(currentProfile.id, unit!.slug, { videoWatched: true });
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/units" className="text-sm text-caramel hover:underline">
          ← Quay lại danh sách bài học
        </Link>
        <div className="relative w-full aspect-[16/9] sm:aspect-[21/9] rounded-2xl overflow-hidden mt-3 mb-4">
          <Image
            src={unit.coverImage}
            alt={unit.titleEn}
            fill
            sizes="100vw"
            priority
            className="object-cover"
          />
        </div>
        <h1 className="text-2xl font-bold text-brown">
          Bài {unit.unitNumber}: {unit.titleEn}
        </h1>
        <p className="text-caramel">{unit.titleVi}</p>
        {isAdmin && !isUnitUnlocked(unit.slug) && (
          <p className="text-xs text-caramel/70 mt-1">
            🔒 Bài này đang khóa với học viên — bạn xem được vì là admin.
          </p>
        )}
        <div className="max-w-sm mt-3">
          <ProgressBar percent={summary.overallPct} label="Tiến độ bài học" size="sm" />
        </div>
      </div>

      {!unlocked ? (
        <LockedLessonNotice />
      ) : (
        <>
          <div className="flex gap-1 border-b border-gold-light/60 overflow-x-auto">
            <TabButton active={tab === "vocab"} onClick={() => setTab("vocab")}>
              🐝 Thẻ từ vựng ({unit.vocabulary.length})
            </TabButton>
            <TabButton active={tab === "dialogue"} onClick={() => setTab("dialogue")}>
              {unit.youtubeUrl ? "💬 Hội thoại & Video" : "💬 Luyện tập Q&A"}
            </TabButton>
            <TabButton active={tab === "speaking"} onClick={() => setTab("speaking")}>
              🎙️ Luyện nói với máy
            </TabButton>
            <TabButton active={tab === "game"} onClick={() => setTab("game")}>
              🎮 Game từ vựng
            </TabButton>
            <TabButton active={tab === "quiz"} onClick={() => setTab("quiz")}>
              📝 Quiz
            </TabButton>
            <TabButton active={tab === "flashGame"} onClick={() => setTab("flashGame")}>
              🕹️ Game tổng hợp
            </TabButton>
          </div>

          {tab === "vocab" && (
            <HoneycombVocabDeck
              vocabulary={unit.vocabulary}
              unitSlug={unit.slug}
              unitTitle={unit.titleEn}
              profileId={currentProfile.id}
              courseTag="STARTER"
              onStartPractice={() => setTab("game")}
            />
          )}

          {tab === "speaking" && (
            <DialoguePractice
              key={unit.slug}
              turns={unit.dialogueTurns}
              unitNumber={unit.unitNumber}
              unitTitle={unit.titleEn}
              unitTitleVi={unit.titleVi}
              unitSlug={unit.slug}
              profileId={currentProfile.id}
              courseTag="STARTER"
            />
          )}

          {tab === "game" && (
            <VocabChallengeGame
              key={unit.slug}
              vocabulary={unit.vocabulary}
              unitNumber={unit.unitNumber}
              unitTitle={unit.titleEn}
              unitSlug={unit.slug}
              profileId={currentProfile.id}
              courseTag="STARTER"
            />
          )}

          {tab === "dialogue" && (
            <div className="space-y-6">
              <YoutubeEmbed url={unit.youtubeUrl} onPlay={handleVideoPlay} />
              <DialogueViewer
                turns={unit.dialogueTurns}
                contextVi={unit.contextVi}
                unitSlug={unit.slug}
                profileId={currentProfile.id}
              />
            </div>
          )}

          {tab === "quiz" && (
            <VocabQuiz
              key={unit.slug}
              vocabulary={unit.vocabulary}
              unitSlug={unit.slug}
              profileId={currentProfile.id}
            />
          )}

          {tab === "flashGame" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2 px-1">
                <div>
                  <h3 className="font-bold text-brown text-base sm:text-lg">
                    Game tổng hợp: Flashcards &amp; Mini-games ({unit.titleEn})
                  </h3>
                  <p className="text-xs text-caramel">
                    Lật thẻ flashcards, trắc nghiệm 4 đáp án, luyện nghe phát âm và ghép cặp từ vựng.
                  </p>
                </div>
                <a
                  href={`/games/flashcards/${unit.slug}.html`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gold/15 hover:bg-gold/25 text-brown text-xs font-semibold border border-gold/30 transition-colors"
                >
                  <span>Mở toàn màn hình</span>
                  <span>↗</span>
                </a>
              </div>

              {unit.slug === "unit-09" && (
                <div className="flex items-center gap-2 flex-wrap p-2.5 bg-cream-light rounded-xl border border-gold-light/40 text-xs">
                  <span className="font-semibold text-brown">Trò chơi câu hỏi bổ sung:</span>
                  <a
                    href="/games/questions/wh_questions_game.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 bg-white rounded-lg border border-gold-light text-caramel hover:text-brown font-medium shadow-xs"
                  >
                    Wh- Questions Game ↗
                  </a>
                  <a
                    href="/games/questions/yes_no_questions_game.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 bg-white rounded-lg border border-gold-light text-caramel hover:text-brown font-medium shadow-xs"
                  >
                    Yes/No Questions Game ↗
                  </a>
                </div>
              )}

              <div className="w-full rounded-2xl overflow-hidden border border-gold-light/60 shadow-sm bg-white">
                <iframe
                  src={`/games/flashcards/${unit.slug}.html`}
                  title={`Game tổng hợp ${unit.titleEn}`}
                  className="w-full h-[760px] sm:h-[820px] border-0"
                  allow="autoplay; speech-recognition; microphone"
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${
        active ? "border-gold text-brown" : "border-transparent text-caramel/60 hover:text-caramel"
      }`}
    >
      {children}
    </button>
  );
}
