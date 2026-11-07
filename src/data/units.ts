import rawUnits from "./units.json";
import type { CourseId, Unit } from "@/types";
import { videoLinksByUnit } from "./videoLinks";

type RawUnit = {
  unitNumber: number;
  titleEn: string;
  titleVi: string;
  slug: string;
  contextVi: string;
  vocabulary: Unit["vocabulary"];
  dialogueTurns: Unit["dialogueTurns"];
};

const COURSE_ID: CourseId = "starter";

export const units: Unit[] = (rawUnits as RawUnit[])
  .slice()
  .sort((a, b) => a.unitNumber - b.unitNumber)
  .map((u) => ({
    unitNumber: u.unitNumber,
    slug: u.slug,
    courseId: COURSE_ID,
    titleEn: u.titleEn,
    titleVi: u.titleVi,
    contextVi: u.contextVi,
    youtubeUrl: videoLinksByUnit[u.unitNumber] || null,
    coverImage: `/units/${u.slug}.jpg`,
    vocabulary: u.vocabulary,
    dialogueTurns: u.dialogueTurns,
  }));

export function getUnitBySlug(slug: string): Unit | undefined {
  return units.find((u) => u.slug === slug);
}

export function getUnitsByCourse(courseId: CourseId): Unit[] {
  return units.filter((u) => u.courseId === courseId);
}

export function getCourseVocabTotal(courseId: CourseId): number {
  return getUnitsByCourse(courseId).reduce((sum, u) => sum + u.vocabulary.length, 0);
}

export function getCourseDialogueTurnTotal(courseId: CourseId): number {
  return getUnitsByCourse(courseId).reduce((sum, u) => sum + u.dialogueTurns.length, 0);
}

export const TOTAL_VOCAB_COUNT = units.reduce((sum, u) => sum + u.vocabulary.length, 0);
export const TOTAL_DIALOGUE_TURNS = units.reduce((sum, u) => sum + u.dialogueTurns.length, 0);
