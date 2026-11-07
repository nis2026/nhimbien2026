import type { CourseId, Unit } from "@/types";
import { units } from "@/data/units";
import { getAllVocabProgress, getUnitProgress } from "./storage";

export type UnitProgressSummary = {
  unit: Unit;
  vocabSeenPct: number;
  vocabMasteredPct: number;
  dialoguePct: number;
  overallPct: number;
};

/**
 * Trọng số tiến độ 1 unit: 50% từ vựng đã học đủ 2 lần đúng quiz (mastered),
 * 30% đã xem hết dialogue, 20% đã xem video bài học.
 * Không có "nút hoàn thành giả" — tất cả tính từ hoạt động thật lưu trong localStorage.
 */
export function getUnitProgressSummary(profileId: string, unit: Unit): UnitProgressSummary {
  const up = getUnitProgress(profileId, unit.slug);
  const totalVocab = unit.vocabulary.length || 1;
  const totalTurns = unit.dialogueTurns.length || 1;

  const vocabSeenPct = Math.round((up.vocabViewedCount / totalVocab) * 100);
  const vocabMasteredPct = Math.round((up.vocabMasteredCount / totalVocab) * 100);
  const dialoguePct = Math.round((up.dialogueTurnsRead / totalTurns) * 100);
  const videoPct = up.videoWatched ? 100 : 0;

  const overallPct = Math.round(
    vocabMasteredPct * 0.5 + dialoguePct * 0.3 + videoPct * 0.2
  );

  return { unit, vocabSeenPct, vocabMasteredPct, dialoguePct, overallPct };
}

export function getAllUnitSummaries(profileId: string, courseId?: CourseId): UnitProgressSummary[] {
  const scoped = courseId ? units.filter((u) => u.courseId === courseId) : units;
  return scoped.map((u) => getUnitProgressSummary(profileId, u));
}

export function getOverallCourseProgress(profileId: string, courseId?: CourseId): number {
  const summaries = getAllUnitSummaries(profileId, courseId);
  if (summaries.length === 0) return 0;
  const total = summaries.reduce((sum, s) => sum + s.overallPct, 0);
  return Math.round(total / summaries.length);
}

function vocabKeyMatchesCourse(key: string, courseId?: CourseId): boolean {
  if (!courseId) return true;
  const slug = key.split(":")[0];
  return units.some((u) => u.courseId === courseId && u.slug === slug);
}

export function getMasteredWordCount(profileId: string, courseId?: CourseId): number {
  const vocab = getAllVocabProgress(profileId);
  return Object.entries(vocab).filter(
    ([key, v]) => v.quizCorrectCount >= 2 && vocabKeyMatchesCourse(key, courseId)
  ).length;
}

export function getStarredWordCount(profileId: string, courseId?: CourseId): number {
  const vocab = getAllVocabProgress(profileId);
  return Object.entries(vocab).filter(
    ([key, v]) => v.starred && vocabKeyMatchesCourse(key, courseId)
  ).length;
}
