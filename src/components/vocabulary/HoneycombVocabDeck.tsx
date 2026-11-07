"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, Gauge, MessageCircle, Sparkles, Tag, Zap } from "lucide-react";
import type { VocabWord } from "@/types";
import { speakLine, stopSpeaking } from "@/lib/tts";
import { getVocabProgress, markVocabSeen } from "@/lib/storage";
import { HoneycombVocabCard } from "./HoneycombVocabCard";
import { VocabPopup } from "./VocabPopup";
import styles from "./HoneycombDeck.module.css";

// Honeycomb vocabulary deck, same look as the IELTS Journey app's lesson decks.

type Props = {
  vocabulary: VocabWord[];
  unitSlug: string;
  unitTitle: string;
  profileId: string;
  /** Course label for the eyebrow, e.g. "STARTER" → "STARTER VOCABULARY". */
  courseTag: string;
  onStartPractice?: () => void;
};

const ALL = "Tất cả";

/**
 * Groups the source part-of-speech labels into a few filter chips. Handles both
 * spelled-out ("noun", "verb phrase") and abbreviated ("n.", "phr. v.") labels;
 * only idioms, slang and bare "phrase" labels land in the phrases chip.
 */
export function vocabCategory(pos: string): string {
  const p = pos.toLowerCase().trim();
  if (/idiom|slang/.test(p)) return "Cụm từ & thành ngữ";
  // Headed phrases go with their head word class: "n. phr." → noun, "phr. v." / "verb phrase" → verb.
  if (/phr\.?\s*v|phrasal/.test(p)) return "Động từ";
  if (p.startsWith("adj")) return "Tính từ";
  if (p.startsWith("adv")) return "Trạng từ";
  if (p.startsWith("v")) return "Động từ";
  if (p.startsWith("n")) return "Danh từ";
  if (/phr/.test(p)) return "Cụm từ & thành ngữ";
  return "Từ khác";
}

function CategoryIcon({ category }: { category: string }) {
  const Icon =
    category === "Cụm từ & thành ngữ" ? MessageCircle
      : category === "Động từ" ? Zap
        : category === "Danh từ" ? Tag
          : category === "Tính từ" ? Sparkles
            : category === "Trạng từ" ? Gauge
              : BookOpen;
  return <Icon size={16} aria-hidden="true" />;
}

function cx(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function HoneycombVocabDeck({ vocabulary, unitSlug, unitTitle, profileId, courseTag, onStartPractice }: Props) {
  const [activeCategory, setActiveCategory] = useState(ALL);
  const [selectedNo, setSelectedNo] = useState<number | null>(null);
  const [speakingNo, setSpeakingNo] = useState<number | null>(null);
  const [popupNo, setPopupNo] = useState<number | null>(null);
  const [learned, setLearned] = useState<Set<number>>(
    () => new Set(vocabulary.filter((w) => getVocabProgress(profileId, unitSlug, w.no).seen).map((w) => w.no))
  );

  const categories = useMemo(() => {
    const order = ["Danh từ", "Động từ", "Tính từ", "Trạng từ", "Cụm từ & thành ngữ", "Từ khác"];
    const present = new Set(vocabulary.map((w) => vocabCategory(w.pos)));
    return order.filter((c) => present.has(c));
  }, [vocabulary]);
  const filtered = activeCategory === ALL ? vocabulary : vocabulary.filter((w) => vocabCategory(w.pos) === activeCategory);
  const learnedCount = learned.size;
  const percent = vocabulary.length ? Math.round((learnedCount / vocabulary.length) * 100) : 0;
  const popupIndex = filtered.findIndex((w) => w.no === popupNo);
  const popupWord = popupIndex >= 0 ? filtered[popupIndex] : null;

  useEffect(() => () => stopSpeaking(), []);

  function markLearned(word: VocabWord) {
    if (learned.has(word.no)) return;
    markVocabSeen(profileId, unitSlug, word.no);
    setLearned((prev) => new Set(prev).add(word.no));
  }

  /** Card click: open the large study card (which reads the word + example aloud). */
  function selectWord(word: VocabWord) {
    stopSpeaking();
    setSpeakingNo(null);
    setSelectedNo(word.no);
    setPopupNo(word.no);
    markLearned(word);
  }

  function stepPopup(delta: number) {
    if (popupIndex < 0 || filtered.length === 0) return;
    const next = filtered[(popupIndex + delta + filtered.length) % filtered.length];
    setSelectedNo(next.no);
    setPopupNo(next.no);
    markLearned(next);
  }

  function pronounce(word: VocabWord) {
    setSelectedNo(word.no);
    markLearned(word);
    setSpeakingNo(word.no);
    const started = speakLine(word.word, {
      audioUrl: word.audioWord,
      onEnd: () => setSpeakingNo((current) => (current === word.no ? null : current)),
    });
    if (!started) setSpeakingNo(null);
  }

  return (
    <section className={styles.surface} aria-labelledby="vocabulary-title">
      <div className={styles.glowOne} aria-hidden="true" />
      <div className={styles.glowTwo} aria-hidden="true" />
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}><BookOpen size={16} />{courseTag} VOCABULARY</div>
          <h2 id="vocabulary-title" className={styles.title}>{unitTitle}</h2>
          <p className={styles.subtitle}>Bấm vào thẻ để mở thẻ lớn có câu ví dụ và giọng đọc, hoặc bấm loa để nghe nhanh.</p>
        </div>
        <div className={styles.progressPanel} aria-label={`Đã học ${learnedCount} trên ${vocabulary.length} từ`}>
          <div className={styles.progressCopy}>
            <span><strong>{learnedCount}</strong> / {vocabulary.length} từ</span>
            <span>{percent}% hoàn thành</span>
          </div>
          <div className={styles.progressTrack}><span style={{ width: `${percent}%` }} /></div>
        </div>
      </header>

      <div className={styles.filters} role="group" aria-label="Lọc từ vựng theo loại từ">
        {[ALL, ...categories].map((category) => (
          <button
            type="button"
            key={category}
            className={cx(styles.filter, activeCategory === category && styles.filterActive)}
            aria-pressed={activeCategory === category}
            onClick={() => setActiveCategory(category)}
          >
            <CategoryIcon category={category} />{category}
          </button>
        ))}
      </div>

      <div className={styles.honeycombGrid}>
        {filtered.map((word) => (
          <HoneycombVocabCard
            key={word.no}
            word={word}
            category={vocabCategory(word.pos)}
            learned={learned.has(word.no)}
            selected={selectedNo === word.no}
            speaking={speakingNo === word.no}
            onSelect={() => selectWord(word)}
            onPronounce={() => pronounce(word)}
          />
        ))}
      </div>

      {popupWord && (
        <VocabPopup
          word={popupWord}
          category={vocabCategory(popupWord.pos)}
          position={popupIndex + 1}
          total={filtered.length}
          onClose={() => setPopupNo(null)}
          onPrev={() => stepPopup(-1)}
          onNext={() => stepPopup(1)}
        />
      )}

      <div className={styles.footer}>
        <p><span>{filtered.length}</span> từ trong nhóm đang xem</p>
        {onStartPractice && (
          <button type="button" className={styles.practiceButton} onClick={onStartPractice}>
            Chơi game ôn từ <ArrowRight size={18} />
          </button>
        )}
      </div>
    </section>
  );
}
