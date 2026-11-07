"use client";

import { Check, Volume2 } from "lucide-react";
import type { KeyboardEvent, MouseEvent } from "react";
import type { VocabWord } from "@/types";
import { ipaText } from "@/lib/ipa";
import styles from "./HoneycombDeck.module.css";

// Ported from the IELTS Journey app (ielts-eco-learning-hub) honeycomb vocabulary card.

type Props = {
  word: VocabWord;
  category: string;
  learned: boolean;
  selected: boolean;
  speaking: boolean;
  onSelect: () => void;
  onPronounce: () => void;
};

function cx(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function HoneycombVocabCard({ word, category, learned, selected, speaking, onSelect, onPronounce }: Props) {
  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  }

  function playSound(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onPronounce();
  }

  return (
    <article
      className={cx(styles.card, selected && styles.cardSelected, learned && styles.cardLearned)}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${word.word}, ${word.meaningVi}. Nhấn để xem thẻ lớn có câu ví dụ.`}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
    >
      <div className={styles.cardInner}>
        <div className={cx(styles.check, (selected || learned) && styles.checkVisible)} aria-hidden="true">
          <Check size={15} strokeWidth={3} />
        </div>
        <div className={`${styles.cornerHoneycomb} ${styles.cornerLeft}`} aria-hidden="true"><span /><span /><span /><span /></div>
        <div className={`${styles.cornerHoneycomb} ${styles.cornerRight}`} aria-hidden="true"><span /><span /><span /><span /></div>
        <div className={styles.cardContent}>
          <span className={styles.category}>{category}</span>
          <h3 className={cx(styles.word, word.word.length > 9 && styles.wordLong)}>{word.word}</h3>
          {word.pos && <span className={styles.pos}>{word.pos}</span>}
          <p className={styles.ipa}>{ipaText(word.ipa)}</p>
          <p className={styles.meaning}>{word.meaningVi}</p>
          <button
            type="button"
            className={cx(styles.speaker, speaking && styles.speakerActive)}
            aria-label={`Nghe phát âm ${word.word}`}
            aria-pressed={speaking}
            onClick={playSound}
          >
            <Volume2 size={20} />
            <span className={styles.speakerRing} aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
}
