export type VocabWord = {
  no: number;
  word: string;
  ipa: string;
  pos: string;
  meaningVi: string;
  /** Emoji shown on game answer cards (scripts/word_icons.json). */
  icon: string;
  exampleEn: string;
  exampleVi: string;
  audioWord?: string;
  audioExample?: string;
};

export type DialogueTurn = {
  no: number;
  /** Character name from the source dialogue (e.g. "Lan", "Waiter"). */
  speaker: string;
  lineEn: string;
  lineVi: string;
  boldWords: string[];
  audio?: string;
};

export type CourseId = "starter";

export type Unit = {
  unitNumber: number;
  slug: string;
  courseId: CourseId;
  titleEn: string;
  titleVi: string;
  contextVi: string;
  youtubeUrl: string | null;
  coverImage: string;
  vocabulary: VocabWord[];
  dialogueTurns: DialogueTurn[];
};

export type VocabProgress = {
  /** vocab keyed by `${unitSlug}:${wordNo}` */
  seen: boolean;
  starred: boolean;
  quizCorrectCount: number;
  quizAttemptCount: number;
  lastReviewedAt: string | null;
};

export type UnitProgress = {
  vocabViewedCount: number;
  vocabMasteredCount: number;
  dialogueOpened: boolean;
  dialogueTurnsRead: number;
  videoWatched: boolean;
  matchGameBestScore: number | null;
  listenGameBestScore: number | null;
  quizBestScore: number | null;
};

export type Role = "admin" | "student";

export type Profile = {
  id: string;
  name: string;
  avatar: "mr-leo" | "ms-miu" | "ms-nhim-bien";
  email?: string;
  role: Role;
  createdAt: string;
};
