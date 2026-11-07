"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import type { VocabWord } from "@/types";
import { speak, stopSpeaking } from "@/lib/tts";
import { sfx } from "@/lib/sfx";
import { ipaText } from "@/lib/ipa";
import styles from "./Practice.module.css";

/*
 * "Vocabulary Matching Challenge" — same rules and layout as the Tuan Tran
 * UNIT nn GAME.html pages: a Vietnamese meaning, six English cards, 20 s per
 * question, +5 for a correct pick, −3 for a wrong pick or a timeout, combo streak.
 */

const TIME_LIMIT = 20;
const TENSION_START = 5;
const CORRECT_PTS = 5;
const WRONG_PTS = 3;
const LETTERS = ["A", "B", "C", "D", "E", "F"];
const RING = 2 * Math.PI * 24;

type Mark = "correct" | "wrong" | "dimmed";
type Feedback = { kind: "success" | "error" | "timeout"; title: string; text: string };

type State = {
  queue: number[];
  target: number | null;
  options: number[];
  timeLeft: number;
  status: "question" | "correct" | "timeout" | "complete";
  paused: boolean;
  score: number;
  combo: number;
  bestCombo: number;
  correct: number;
  wrong: number;
  timeouts: number;
  completed: number;
  marks: Record<number, Mark>;
  feedback: Feedback | null;
  hint: boolean;
  round: number;
};

type Action =
  | { type: "next"; target: number; options: number[] }
  | { type: "complete" }
  | { type: "tick" }
  | { type: "answer"; no: number }
  | { type: "clearWrong"; no: number }
  | { type: "pause"; paused: boolean }
  | { type: "hint" }
  | { type: "reset"; state: State };

function shuffle<T>(items: T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRound(queue: number[], all: number[]) {
  const target = queue[Math.floor(Math.random() * queue.length)];
  let distractors = queue.filter((n) => n !== target);
  if (distractors.length < 5) {
    const extra = all.filter((n) => n !== target && !distractors.includes(n));
    distractors = distractors.concat(shuffle(extra).slice(0, 5 - distractors.length));
  }
  return { target, options: shuffle([target, ...shuffle(distractors).slice(0, 5)]) };
}

function initialState(all: number[]): State {
  const { target, options } = pickRound(all, all);
  return {
    queue: all,
    target,
    options,
    timeLeft: TIME_LIMIT,
    status: "question",
    paused: false,
    score: 0,
    combo: 0,
    bestCombo: 0,
    correct: 0,
    wrong: 0,
    timeouts: 0,
    completed: 0,
    marks: {},
    feedback: null,
    hint: false,
    round: 0,
  };
}

function makeReducer(words: Map<number, VocabWord>) {
  return function reducer(state: State, action: Action): State {
    switch (action.type) {
      case "next":
        return {
          ...state,
          target: action.target,
          options: action.options,
          timeLeft: TIME_LIMIT,
          status: "question",
          marks: {},
          feedback: null,
          hint: false,
          round: state.round + 1,
        };
      case "complete":
        return { ...state, status: "complete", feedback: null };
      case "tick": {
        if (state.status !== "question" || state.paused) return state;
        if (state.timeLeft > 1) return { ...state, timeLeft: state.timeLeft - 1 };
        const target = state.target!;
        const marks: Record<number, Mark> = {};
        for (const n of state.options) marks[n] = n === target ? "correct" : "dimmed";
        const w = words.get(target)!;
        return {
          ...state,
          timeLeft: 0,
          status: "timeout",
          score: Math.max(0, state.score - WRONG_PTS),
          combo: 0,
          timeouts: state.timeouts + 1,
          completed: state.completed + 1,
          queue: state.queue.filter((n) => n !== target),
          marks,
          feedback: { kind: "timeout", title: "HẾT GIỜ", text: `Đáp án đúng: ${w.word} ${ipaText(w.ipa)}  −${WRONG_PTS} điểm` },
        };
      }
      case "answer": {
        if (state.status !== "question" || state.paused || state.marks[action.no]) return state;
        const target = state.target!;
        if (action.no === target) {
          const marks: Record<number, Mark> = {};
          for (const n of state.options) marks[n] = n === target ? "correct" : "dimmed";
          const combo = state.combo + 1;
          return {
            ...state,
            status: "correct",
            score: state.score + CORRECT_PTS,
            combo,
            bestCombo: Math.max(state.bestCombo, combo),
            correct: state.correct + 1,
            completed: state.completed + 1,
            queue: state.queue.filter((n) => n !== target),
            marks,
            feedback: {
              kind: "success",
              title: "CHÍNH XÁC!",
              text: `Bạn đã chọn đúng “${words.get(target)!.word}”. +${CORRECT_PTS} điểm`,
            },
          };
        }
        return {
          ...state,
          score: Math.max(0, state.score - WRONG_PTS),
          combo: 0,
          wrong: state.wrong + 1,
          marks: { ...state.marks, [action.no]: "wrong" },
          feedback: { kind: "error", title: "CHƯA ĐÚNG", text: `Hãy xem lại và chọn một đáp án khác. −${WRONG_PTS} điểm` },
        };
      }
      case "clearWrong": {
        if (state.marks[action.no] !== "wrong") return state;
        const marks = { ...state.marks };
        delete marks[action.no];
        return { ...state, marks };
      }
      case "pause":
        return { ...state, paused: action.paused };
      case "hint":
        return { ...state, hint: true };
      case "reset":
        return action.state;
    }
  };
}

function bestKey(profileId: string, unitSlug: string) {
  return `vip_nhim_bien_challenge_best_${profileId}_${unitSlug}`;
}

function readBest(profileId: string, unitSlug: string): number {
  try {
    return Number(window.localStorage.getItem(bestKey(profileId, unitSlug))) || 0;
  } catch {
    return 0;
  }
}

type Props = {
  vocabulary: VocabWord[];
  unitNumber: number;
  unitTitle: string;
  unitSlug: string;
  profileId: string;
  /** Course label for the header chip, e.g. "STARTER" → "STARTER ENGLISH". */
  courseTag: string;
};

export function VocabChallengeGame({ vocabulary, unitNumber, unitTitle, unitSlug, profileId, courseTag }: Props) {
  const [words] = useState(() => new Map(vocabulary.map((w) => [w.no, w])));
  const [all] = useState(() => vocabulary.map((w) => w.no));
  const [reducer] = useState(() => makeReducer(words));
  const [state, dispatch] = useReducer(reducer, all, initialState);
  const [soundOn, setSoundOn] = useState(true);
  const [showList, setShowList] = useState(false);
  const [best, setBest] = useState(() => (typeof window === "undefined" ? 0 : readBest(profileId, unitSlug)));

  const total = all.length;
  const target = state.target !== null ? words.get(state.target)! : null;
  const danger = state.status === "question" && state.timeLeft <= TENSION_START;

  const say = useCallback((text: string) => {
    if (soundOn) speak(text, 0.9);
  }, [soundOn]);

  // 1-second countdown while a question is open and not paused.
  useEffect(() => {
    if (state.status !== "question" || state.paused) return;
    const id = window.setInterval(() => dispatch({ type: "tick" }), 1000);
    return () => window.clearInterval(id);
  }, [state.status, state.paused, state.round]);

  // Tension beeps for the last seconds.
  useEffect(() => {
    if (soundOn && state.status === "question" && !state.paused && state.timeLeft <= TENSION_START && state.timeLeft > 0) sfx.tick();
  }, [state.timeLeft, state.status, state.paused, soundOn]);

  // After a correct pick / timeout: short pause, then next question or the results screen.
  useEffect(() => {
    if (state.status !== "correct" && state.status !== "timeout") return;
    if (soundOn) {
      if (state.status === "correct") sfx.correct();
      else sfx.wrong();
    }
    if (state.status === "correct" && state.target !== null && soundOn) speak(words.get(state.target)!.word, 0.9);
    const delay = state.status === "correct" ? 1600 : 2200;
    const id = window.setTimeout(() => {
      if (state.queue.length === 0) dispatch({ type: "complete" });
      else dispatch({ type: "next", ...pickRound(state.queue, all) });
    }, delay);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status, state.round]);

  // Final screen: fanfare + personal best (kept per student, per lesson, on this device).
  useEffect(() => {
    if (state.status !== "complete") return;
    if (soundOn) sfx.win();
    try {
      if (state.score > readBest(profileId, unitSlug)) {
        window.localStorage.setItem(bestKey(profileId, unitSlug), String(state.score));
      }
    } catch {
      // storage unavailable — the result still shows, it just isn't remembered
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  useEffect(() => () => stopSpeaking(), []);

  const answer = useCallback((no: number) => {
    if (state.status !== "question" || state.paused || state.marks[no]) return;
    if (no !== state.target) {
      if (soundOn) sfx.wrong();
      window.setTimeout(() => dispatch({ type: "clearWrong", no }), 800);
    }
    dispatch({ type: "answer", no });
  }, [state.status, state.paused, state.marks, state.target, soundOn]);

  // A–F / 1–6 keyboard shortcuts, P to pause.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = e.key.toUpperCase();
      if (key === "P") {
        dispatch({ type: "pause", paused: !state.paused });
        return;
      }
      const idx = LETTERS.indexOf(key) >= 0 ? LETTERS.indexOf(key) : "123456".indexOf(key);
      if (idx >= 0 && state.options[idx] !== undefined) answer(state.options[idx]);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answer, state.options, state.paused]);

  function restart() {
    stopSpeaking();
    setShowList(false);
    setBest(readBest(profileId, unitSlug));
    dispatch({ type: "reset", state: initialState(all) });
  }

  const attempts = state.correct + state.wrong + state.timeouts;
  const accuracy = attempts ? Math.round((state.correct / attempts) * 100) : 0;
  const locked = state.status !== "question" || state.paused;

  return (
    <div className={styles.root}>
      <div className={styles.topbar}>
        <div className={styles.brand}>
          <div className={styles.brandBadge}>LE</div>
          <div>
            <div className={styles.brandName}>LEO ENGLISH</div>
            <div className={styles.brandSub}>Vocabulary game</div>
          </div>
        </div>
        <div className={styles.controls}>
          <button
            type="button"
            className={`${styles.iconBtn} ${soundOn ? styles.iconBtnActive : ""}`}
            onClick={() => setSoundOn((s) => !s)}
            aria-label={soundOn ? "Tắt âm thanh" : "Bật âm thanh"}
            title="Âm thanh"
          >
            {soundOn ? "🔊" : "🔇"}
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => dispatch({ type: "pause", paused: !state.paused })}
            disabled={state.status === "complete"}
            aria-label={state.paused ? "Tiếp tục" : "Tạm dừng"}
            title="Tạm dừng (P)"
          >
            {state.paused ? "▶" : "⏸"}
          </button>
          <button type="button" className={styles.iconBtn} onClick={restart} aria-label="Chơi lại" title="Chơi lại">
            ↻
          </button>
        </div>
      </div>

      <div className={styles.hero}>
        <div className={styles.chips}>
          <span className={styles.chip}>{courseTag} ENGLISH</span>
          <span className={styles.chip}>{total} WORDS</span>
          <span className={styles.chip}>MATCHING GAME</span>
        </div>
        <h2 className={styles.heroTitle}>BÀI {unitNumber}</h2>
        <p className={styles.heroSub}>{unitTitle}</p>
        <p className={styles.heroNote}>Chọn từ tiếng Anh phù hợp với nghĩa tiếng Việt trước khi hết giờ.</p>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statIcon}>🏆</span>
          <span className={styles.statLabel}>Điểm</span>
          <span className={styles.statValue}>{state.score}</span>
        </div>
        <div className={`${styles.stat} ${danger ? styles.timerDanger : ""}`}>
          <div className={styles.timerRing}>
            <svg viewBox="0 0 56 56" aria-hidden="true">
              <circle className={styles.timerTrack} cx="28" cy="28" r="24" />
              <circle
                className={styles.timerFg}
                cx="28"
                cy="28"
                r="24"
                strokeDasharray={RING}
                strokeDashoffset={RING * (1 - state.timeLeft / TIME_LIMIT)}
              />
            </svg>
            <span className={styles.timerNum}>{state.status === "complete" ? "–" : state.timeLeft}</span>
          </div>
          <span className={styles.statLabel}>Thời gian</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statIcon}>📊</span>
          <span className={styles.statLabel}>Tiến độ</span>
          <span className={styles.statValue}>{state.completed} / {total}</span>
          <div className={styles.statBar}><span style={{ width: `${(state.completed / total) * 100}%` }} /></div>
        </div>
        <div className={styles.stat}>
          <span className={styles.statIcon}>⚡</span>
          <span className={styles.statLabel}>Combo</span>
          <span className={styles.statValue}>{state.combo}</span>
        </div>
      </div>

      {target && state.status !== "complete" && (
        <>
          <div key={state.round} className={styles.question}>
            <div className={styles.questionLabel}>TÌM TỪ TIẾNG ANH PHÙ HỢP</div>
            <div className={styles.questionMeaning}>{target.meaningVi}</div>
            <div className={styles.questionMeta}>
              Chọn một trong sáu đáp án
              <b>Câu {Math.min(state.completed + 1, total)} / {total}</b>
            </div>
            {state.hint && <div className={styles.hintText}>Gợi ý IPA: {ipaText(target.ipa)}</div>}
          </div>

          <div className={styles.answers}>
            {state.options.map((no, i) => {
              const w = words.get(no)!;
              const mark = state.marks[no];
              const cls = [
                styles.answer,
                mark === "correct" && styles.answerCorrect,
                mark === "wrong" && styles.answerWrong,
                mark === "dimmed" && styles.answerDimmed,
                locked && styles.answerDisabled,
              ].filter(Boolean).join(" ");
              return (
                <div
                  key={`${state.round}-${no}`}
                  role="button"
                  tabIndex={0}
                  className={cls}
                  aria-label={`Đáp án ${LETTERS[i]}: ${w.word}`}
                  aria-disabled={locked}
                  onClick={() => answer(no)}
                  onKeyDown={(e) => {
                    if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      answer(no);
                    }
                  }}
                >
                  <span className={styles.letter} aria-hidden="true">{LETTERS[i]}</span>
                  <span className={styles.answerStatus} aria-hidden="true">
                    {mark === "correct" ? "✓" : mark === "wrong" ? "✕" : ""}
                  </span>
                  <span className={styles.answerIcon} aria-hidden="true">{w.icon}</span>
                  <span className={styles.answerWord}>{w.word}</span>
                  <span className={styles.answerIpa}>{ipaText(w.ipa)}</span>
                  <button
                    type="button"
                    className={styles.answerSpeaker}
                    aria-label={`Nghe phát âm ${w.word}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      say(w.word);
                    }}
                  >
                    🔊
                  </button>
                </div>
              );
            })}
          </div>

          {state.feedback && (
            <div
              role="status"
              className={`${styles.feedback} ${
                state.feedback.kind === "success" ? styles.feedbackSuccess
                  : state.feedback.kind === "error" ? styles.feedbackError
                    : styles.feedbackTimeout
              }`}
            >
              <span className={styles.feedbackIcon} aria-hidden="true">
                {state.feedback.kind === "success" ? "✓" : state.feedback.kind === "error" ? "✕" : "⏱"}
              </span>
              <div>
                <b>{state.feedback.title}</b>
                {state.feedback.text}
              </div>
            </div>
          )}

          <div className={styles.centerRow}>
            <button
              type="button"
              className={styles.softBtn}
              onClick={() => dispatch({ type: "hint" })}
              disabled={state.hint || locked}
            >
              💡 Xem gợi ý IPA
            </button>
          </div>
        </>
      )}

      {state.paused && state.status !== "complete" && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <div className={styles.modalTitle}>⏸ Đang tạm dừng</div>
            <p className={styles.modalText}>Thời gian đã dừng lại. Bấm tiếp tục khi bạn sẵn sàng.</p>
            <div className={styles.centerRow}>
              <button type="button" className={styles.primaryBtn} onClick={() => dispatch({ type: "pause", paused: false })}>
                ▶ Tiếp tục
              </button>
            </div>
          </div>
        </div>
      )}

      {state.status === "complete" && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <div className={styles.modalTitle}>🎉 Hoàn thành thử thách!</div>
            <p className={styles.modalText}>
              {state.score > best ? "Kỷ lục mới của bạn cho bài này!" : `Kỷ lục của bạn: ${best} điểm`}
            </p>
            <div className={styles.finalGrid}>
              <div><small>Điểm</small><strong>{state.score}</strong></div>
              <div><small>Số từ</small><strong>{state.correct} / {total}</strong></div>
              <div><small>Độ chính xác</small><strong>{accuracy}%</strong></div>
              <div><small>Combo cao nhất</small><strong>{state.bestCombo}</strong></div>
            </div>
            {showList && (
              <div className={styles.wordList}>
                {vocabulary.map((w) => (
                  <div key={w.no}>
                    <b>{w.icon} {w.word}</b>
                    <span>{ipaText(w.ipa)} — {w.meaningVi}</span>
                  </div>
                ))}
              </div>
            )}
            <div className={styles.centerRow}>
              <button type="button" className={styles.primaryBtn} onClick={restart}>↻ Chơi lại</button>
              <button type="button" className={styles.softBtn} onClick={() => setShowList((s) => !s)}>
                📖 {showList ? "Ẩn từ vựng" : "Xem lại từ vựng"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
