"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Volume2, X } from "lucide-react";
import type { VocabWord } from "@/types";
import { speakLine, stopSpeaking } from "@/lib/tts";
import { ipaText } from "@/lib/ipa";
import styles from "./VocabPopup.module.css";

type Props = {
  word: VocabWord;
  category: string;
  position: number;
  total: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
};

type Playing = "word" | "example" | null;

/**
 * Large rectangular study card opened from a honeycomb card: big word, IPA,
 * meaning and the example sentence. Reads the word, then the example, as soon
 * as it opens (and again for every card reached with ← / →).
 */
export function VocabPopup({ word, category, position, total, onClose, onPrev, onNext }: Props) {
  const [playing, setPlaying] = useState<Playing>(null);

  function play(what: "word" | "example", then?: () => void) {
    const text = what === "word" ? word.word : word.exampleEn;
    const audioUrl = what === "word" ? word.audioWord : word.audioExample;
    if (!text) return;
    setPlaying(what);
    const started = speakLine(text, {
      audioUrl,
      onEnd: () => {
        setPlaying((p) => (p === what ? null : p));
        then?.();
      },
    });
    if (!started) setPlaying(null);
  }

  // Auto-read: word, short pause, example. Cancelled when the card changes or closes.
  useEffect(() => {
    let cancelled = false;
    let gap: number | undefined;
    const t = window.setTimeout(() => {
      if (cancelled) return;
      setPlaying("word");
      speakLine(word.word, {
        audioUrl: word.audioWord,
        onEnd: () => {
          if (cancelled) return;
          setPlaying(null);
          if (!word.exampleEn) return;
          gap = window.setTimeout(() => {
            if (cancelled) return;
            setPlaying("example");
            speakLine(word.exampleEn, {
              audioUrl: word.audioExample,
              onEnd: () => !cancelled && setPlaying(null),
            });
          }, 450);
        },
      });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      if (gap) window.clearTimeout(gap);
      stopSpeaking();
    };
  }, [word]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") onPrev();
      else if (e.key === "ArrowRight") onNext();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, onPrev, onNext]);

  return createPortal(
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-label={`${word.word} — ${word.meaningVi}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className={styles.close} onClick={onClose} aria-label="Đóng">
          <X size={22} />
        </button>

        <div className={styles.head}>
          <div className={styles.icon} aria-hidden="true">{word.icon}</div>
          <div className={styles.headText}>
            <span className={styles.category}>{category}</span>
            <span className={styles.counter}>{position} / {total}</span>
          </div>
        </div>

        <h2 className={styles.word}>{word.word}</h2>
        <div className={styles.ipaRow}>
          <span className={styles.ipa}>{ipaText(word.ipa)}</span>
          {word.pos && <span className={styles.pos}>{word.pos}</span>}
          <button
            type="button"
            className={`${styles.speak} ${playing === "word" ? styles.speakActive : ""}`}
            onClick={() => play("word")}
            aria-label={`Nghe phát âm ${word.word}`}
          >
            <Volume2 size={22} />
          </button>
        </div>
        <p className={styles.meaning}>{word.meaningVi}</p>

        {word.exampleEn && (
          <div className={`${styles.example} ${playing === "example" ? styles.exampleActive : ""}`}>
            <div className={styles.exampleLabel}>Ví dụ</div>
            <p className={styles.exampleEn}>“{word.exampleEn}”</p>
            <p className={styles.exampleVi}>{word.exampleVi}</p>
            <button type="button" className={styles.exampleBtn} onClick={() => play("example")}>
              <Volume2 size={18} /> {playing === "example" ? "Đang đọc…" : "Nghe câu ví dụ"}
            </button>
          </div>
        )}

        <div className={styles.nav}>
          <button type="button" className={styles.navBtn} onClick={onPrev} aria-label="Từ trước">
            <ChevronLeft size={20} /> Từ trước
          </button>
          <button type="button" className={styles.navBtn} onClick={onNext} aria-label="Từ tiếp theo">
            Từ tiếp theo <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
