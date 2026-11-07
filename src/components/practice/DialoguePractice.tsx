"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DialogueTurn } from "@/types";
import { speak, speakLine, stopSpeaking } from "@/lib/tts";
import { updateUnitProgress } from "@/lib/storage";
import { encouragement, scoreMeta, scoreSpeech, speechTips, type SpeechScore } from "@/lib/speechScoring";
import styles from "./Practice.module.css";

/*
 * "AI Dialogue Practice" — same flow and layout as the Tuan Tran
 * UNIT nn DIALOGUE.html pages: pick a role, the machine reads the other
 * character's lines aloud, the student reads theirs into the microphone and
 * gets a score with word-by-word feedback. Uses the browser's own
 * SpeechRecognition (Chrome / Edge); nothing is uploaded anywhere by this app.
 */

const MAX_RECORD_SECONDS = 25;

// Minimal Web Speech API typings (not in TypeScript's DOM lib).
type RecognitionResultList = ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: { resultIndex: number; results: RecognitionResultList }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Trình duyệt chưa được cấp quyền sử dụng micro. Bấm biểu tượng 🔒 trên thanh địa chỉ để cho phép.",
  "service-not-allowed": "Dịch vụ nhận diện giọng nói bị chặn.",
  "no-speech": "Chưa nhận được giọng nói. Hãy thử lại.",
  "audio-capture": "Thiết bị không tìm thấy micro.",
  network: "Lỗi mạng. Kiểm tra kết nối và thử lại.",
  aborted: "Ghi âm đã bị hủy.",
};

type Phase = "idle" | "machine" | "user" | "recording" | "result" | "done";
type Result = SpeechScore & { transcript: string; tips: string[]; note: string };
type HistoryItem = { index: number; speaker: string; score: number; attempt: number };

type Props = {
  turns: DialogueTurn[];
  unitNumber: number;
  unitTitle: string;
  unitTitleVi: string;
  unitSlug: string;
  profileId: string;
  /** Course label for the header chip, e.g. "STARTER" → "STARTER ENGLISH". */
  courseTag: string;
};

export function DialoguePractice({ turns, unitNumber, unitTitle, unitTitleVi, unitSlug, profileId, courseTag }: Props) {
  const speakers = useMemo(() => [...new Set(turns.map((t) => t.speaker))].slice(0, 2), [turns]);
  // Default: the student plays whoever answers the opening line, so the machine starts the conversation.
  const [role, setRole] = useState(speakers[1] ?? speakers[0]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [paused, setPaused] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [showVi, setShowVi] = useState(true);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [scores, setScores] = useState<Record<number, number>>({});
  const [attempts, setAttempts] = useState<Record<number, number>>({});
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [supported] = useState(() => recognitionCtor() !== null);

  const recognitionRef = useRef<Recognition | null>(null);
  const finalRef = useRef("");
  const interimRef = useRef("");
  const timerRef = useRef<number | null>(null);

  const line = turns[index];
  const isUserTurn = line?.speaker === role;
  const partner = speakers.find((s) => s !== role) ?? speakers[0];
  const userLines = turns.filter((t) => t.speaker === role).length;
  const scored = Object.values(scores);
  const avg = scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null;

  const showToast = useCallback((text: string) => {
    setToast(text);
    window.setTimeout(() => setToast((t) => (t === text ? null : t)), 3200);
  }, []);

  const goTo = useCallback((next: number) => {
    if (next >= turns.length) {
      setPhase("done");
      return;
    }
    setIndex(next);
    setTranscript("");
    setInterim("");
    setResult(null);
    setPhase(turns[next].speaker === role ? "user" : "machine");
  }, [turns, role]);

  // Machine's turn: read the line aloud, then hand over. Re-runs after a pause is lifted.
  useEffect(() => {
    if (phase !== "machine" || paused || !line) return;
    // `cancelled` also swallows the onEnd that speechSynthesis.cancel() fires for this line.
    let cancelled = false;
    let handOver: number | undefined;
    const advance = () => {
      if (!cancelled) handOver = window.setTimeout(() => !cancelled && goTo(index + 1), 450);
    };
    const started = soundOn && speakLine(line.lineEn, { audioUrl: line.audio, rate: 0.88, onEnd: advance });
    let fallback: number | undefined;
    if (!started) fallback = window.setTimeout(advance, 1800 + line.lineEn.split(" ").length * 120);
    return () => {
      cancelled = true;
      if (fallback) window.clearTimeout(fallback);
      if (handOver) window.clearTimeout(handOver);
      stopSpeaking();
    };
  }, [phase, paused, index, line, soundOn, goTo]);

  // The whole dialogue done → count it toward the lesson's dialogue progress.
  useEffect(() => {
    if (phase === "done") updateUnitProgress(profileId, unitSlug, { dialogueOpened: true, dialogueTurnsRead: turns.length });
  }, [phase, profileId, unitSlug, turns.length]);

  useEffect(
    () => () => {
      stopSpeaking();
      recognitionRef.current?.abort();
      if (timerRef.current) window.clearInterval(timerRef.current);
    },
    []
  );

  function start(nextRole = role) {
    stopSpeaking();
    recognitionRef.current?.abort();
    setRole(nextRole);
    setScores({});
    setAttempts({});
    setHistory([]);
    setPaused(false);
    setTranscript("");
    setInterim("");
    setResult(null);
    setIndex(0);
    setPhase(turns[0].speaker === nextRole ? "user" : "machine");
  }

  function finishRecording(errored: boolean) {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    recognitionRef.current = null;
    if (errored) {
      setPhase("user");
      return;
    }
    const said = (finalRef.current || interimRef.current).trim();
    if (!said) {
      showToast("Chưa nhận được giọng nói. Hãy kiểm tra micro và thử lại.");
      setPhase("user");
      return;
    }
    const scoredResult = scoreSpeech(said, line.lineEn);
    setTranscript(said);
    setInterim("");
    setResult({ ...scoredResult, transcript: said, tips: speechTips(scoredResult), note: encouragement(scoredResult.score) });
    setPhase("result");
  }

  function startRecording() {
    const Ctor = recognitionCtor();
    if (!Ctor || phase !== "user" || paused) return;
    stopSpeaking();
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    finalRef.current = "";
    interimRef.current = "";
    let errored = false;
    rec.onresult = (e) => {
      let fin = "";
      let tmp = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) fin += r[0].transcript;
        else tmp += r[0].transcript;
      }
      if (fin) {
        finalRef.current = `${finalRef.current} ${fin}`.trim();
        setTranscript(finalRef.current);
        setInterim("");
      } else {
        interimRef.current = tmp;
        setInterim(tmp);
      }
    };
    rec.onerror = (e) => {
      errored = true;
      if (e.error !== "aborted") showToast(ERROR_MESSAGES[e.error] ?? "Có lỗi khi nhận diện giọng nói. Thử lại.");
    };
    rec.onend = () => finishRecording(errored);
    recognitionRef.current = rec;
    setTranscript("");
    setInterim("");
    setSeconds(0);
    setPhase("recording");
    try {
      rec.start();
    } catch {
      showToast("Không thể bắt đầu ghi âm. Thử lại.");
      recognitionRef.current = null;
      setPhase("user");
      return;
    }
    timerRef.current = window.setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_RECORD_SECONDS) recognitionRef.current?.stop();
        return s + 1;
      });
    }, 1000);
  }

  function stopRecording() {
    recognitionRef.current?.stop();
  }

  function micClick() {
    if (phase === "recording") stopRecording();
    else startRecording();
  }

  function keepAndContinue() {
    if (!result) return;
    const attempt = (attempts[index] ?? 0) + 1;
    setAttempts((a) => ({ ...a, [index]: attempt }));
    setScores((s) => ({ ...s, [index]: Math.max(s[index] ?? 0, result.score) }));
    setHistory((h) => [{ index, speaker: line.speaker, score: result.score, attempt }, ...h]);
    goTo(index + 1);
  }

  function retry() {
    if (result) {
      const attempt = (attempts[index] ?? 0) + 1;
      setAttempts((a) => ({ ...a, [index]: attempt }));
      setScores((s) => ({ ...s, [index]: Math.max(s[index] ?? 0, result.score) }));
      setHistory((h) => [{ index, speaker: line.speaker, score: result.score, attempt }, ...h]);
    }
    setResult(null);
    setTranscript("");
    setPhase("user");
  }

  function togglePause() {
    if (phase === "idle" || phase === "done") return;
    if (!paused) {
      stopSpeaking();
      if (phase === "recording") recognitionRef.current?.abort();
    }
    setPaused((p) => !p);
  }

  // Keyboard shortcuts (same as the Tuan Tran page): Space mic, R replay, P pause, M sound, T translation.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      const k = e.key.toLowerCase();
      if (e.key === " " && (phase === "user" || phase === "recording")) {
        e.preventDefault();
        micClick();
      } else if (k === "r" && line && phase !== "machine") speak(line.lineEn, { audioUrl: line.audio, rate: 0.88 });
      else if (k === "p") togglePause();
      else if (k === "m") setSoundOn((s) => !s);
      else if (k === "t") setShowVi((v) => !v);
      else if (e.key === "Enter" && phase === "result") keepAndContinue();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const statusText =
    phase === "idle" ? "Sẵn sàng"
      : paused ? "Đang tạm dừng"
        : phase === "machine" ? "Máy đang nói…"
          : phase === "recording" ? "Đang nghe giọng nói…"
            : phase === "result" ? "Đã chấm điểm"
              : phase === "done" ? "Hoàn thành"
                : "Lượt của bạn – Hãy đọc to";

  const summary = (() => {
    const vals = Object.values(scores);
    return {
      avg: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0,
      practiced: vals.length,
      good: vals.filter((s) => s >= 80).length,
      weak: vals.filter((s) => s < 70).length,
      tries: Object.values(attempts).reduce((a, b) => a + b, 0),
    };
  })();

  return (
    <div className={styles.root}>
      <div className={styles.topbar}>
        <div className={styles.brand}>
          <div className={styles.brandBadge}>LE</div>
          <div>
            <div className={styles.brandName}>LEO ENGLISH</div>
            <div className={styles.brandSub}>AI Speaking Lab</div>
          </div>
        </div>
        <div className={styles.topCenter}>
          <small>BÀI {unitNumber}</small>
          <span>{unitTitle}</span>
        </div>
        <div className={styles.controls}>
          <button
            type="button"
            className={`${styles.iconBtn} ${soundOn ? styles.iconBtnActive : ""}`}
            onClick={() => setSoundOn((s) => !s)}
            aria-label={soundOn ? "Tắt giọng máy" : "Bật giọng máy"}
            title="Âm thanh (M)"
          >
            {soundOn ? "🔊" : "🔇"}
          </button>
          <button type="button" className={styles.iconBtn} onClick={togglePause} aria-label={paused ? "Tiếp tục" : "Tạm dừng"} title="Tạm dừng (P)">
            {paused ? "▶" : "⏸"}
          </button>
          <button type="button" className={styles.iconBtn} onClick={() => start()} aria-label="Luyện lại từ đầu" title="Luyện lại từ đầu">
            ↻
          </button>
        </div>
      </div>

      <div className={styles.hero}>
        <div className={styles.eyebrow}>AI Dialogue Practice</div>
        <h2 className={styles.heroTitle}>{unitTitle}</h2>
        <p className={styles.heroSub}>{unitTitleVi}</p>
        <p className={styles.heroNote}>Chọn vai, nghe câu của đối phương và luyện nói từng lượt với hệ thống nhận diện giọng nói.</p>
        <div className={styles.chips} style={{ marginTop: 12 }}>
          <span className={styles.chip}>{courseTag} ENGLISH</span>
          <span className={styles.chip}>{turns.length} LINES</span>
          <span className={styles.chip}>ROLE PLAY</span>
          <span className={styles.chip}>AI SPEAKING</span>
        </div>
      </div>

      <div className={styles.speakLayout}>
        <div>
          <div className={styles.roles}>
            {speakers.map((s) => {
              const active = s === role;
              const other = speakers.find((x) => x !== s) ?? s;
              return (
                <button key={s} type="button" className={`${styles.role} ${active ? styles.roleActive : ""}`} onClick={() => start(s)}>
                  {active && <span className={styles.roleCheck}>✓</span>}
                  <div className={styles.roleIcon}>{active ? "🎭" : "🎤"}</div>
                  <div className={styles.roleTitle}>Đóng vai {s}</div>
                  <div className={styles.roleDesc}>Máy sẽ đóng vai {other}.</div>
                  {active && <div className={styles.roleTag}>ĐANG CHỌN</div>}
                </button>
              );
            })}
          </div>

          <div className={styles.miniStats}>
            <div className={styles.miniStat}><small>Câu</small><strong>{Math.min(index + 1, turns.length)} / {turns.length}</strong></div>
            <div className={styles.miniStat}>
              <small>Lượt hiện tại</small>
              <strong className={styles.miniStatGold}>
                {phase === "idle" ? "Chưa bắt đầu" : phase === "done" ? "Hoàn thành" : isUserTurn ? "Lượt của bạn" : `${partner} (máy)`}
              </strong>
            </div>
            <div className={styles.miniStat}><small>Điểm TB</small><strong>{avg === null ? "—" : `${avg}%`}</strong></div>
            <div className={styles.miniStat}><small>Đã luyện</small><strong>{scored.length} / {userLines}</strong></div>
          </div>
          <div className={styles.track}><span style={{ width: `${phase === "done" ? 100 : (index / turns.length) * 100}%` }} /></div>

          {phase === "idle" ? (
            <div className={styles.lineCard}>
              <p className={styles.lineEn}>Sẵn sàng luyện nói?</p>
              <p className={styles.lineVi}>
                Bạn đóng vai <b>{role}</b>, máy đóng vai <b>{partner}</b>. Máy sẽ đọc các câu của {partner}; đến lượt bạn thì bấm micro và đọc to câu tiếng Anh.
              </p>
              <div className={styles.lineActions}>
                <button type="button" className={styles.primaryBtn} onClick={() => start()}>▶ Bắt đầu luyện</button>
              </div>
            </div>
          ) : line && phase !== "done" ? (
            <div className={styles.lineCard}>
              <div className={styles.lineHead}>
                <span className={`${styles.badge} ${isUserTurn ? styles.badgeUser : styles.badgeMachine}`}>
                  {line.speaker.toUpperCase()} · {isUserTurn ? "YOUR TURN" : "AI PARTNER"}
                </span>
                <span
                  className={`${styles.status} ${phase === "machine" && !paused ? styles.statusSpeaking : ""} ${phase === "recording" ? styles.statusListening : ""}`}
                >
                  {statusText}
                </span>
              </div>
              <p className={`${styles.lineEn} ${isUserTurn ? styles.lineEnUser : ""}`}>{line.lineEn}</p>
              {showVi && <p className={styles.lineVi}>{line.lineVi}</p>}
              <div className={styles.lineActions}>
                <button type="button" className={styles.pillBtn} onClick={() => setShowVi((v) => !v)}>
                  {showVi ? "Ẩn nghĩa" : "Hiện nghĩa"}
                </button>
                {isUserTurn && (
                  <>
                    <button type="button" className={styles.pillBtn} onClick={() => speak(line.lineEn, { audioUrl: line.audio, rate: 0.88 })} disabled={phase === "recording"}>
                      🔊 Nghe mẫu
                    </button>
                    <button type="button" className={styles.pillBtn} onClick={() => goTo(index + 1)} disabled={phase === "recording"}>
                      Bỏ qua câu này →
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : null}

          {phase !== "idle" && phase !== "done" && (
            <div className={styles.micPanel}>
              <button
                type="button"
                className={`${styles.micBtn} ${phase === "recording" ? styles.micRecording : ""}`}
                onClick={micClick}
                disabled={!supported || paused || (phase !== "user" && phase !== "recording")}
                aria-label={phase === "recording" ? "Dừng ghi âm" : "Bấm để bắt đầu nói"}
              >
                {phase === "recording" ? "⏹" : "🎙️"}
              </button>
              <div className={styles.micLabel}>
                {phase === "recording" ? "ĐANG NGHE – Hãy đọc to, bấm lại để dừng"
                  : phase === "user" ? "Bấm để bắt đầu nói"
                    : phase === "machine" ? "Máy đang nói…"
                      : "Đã ghi nhận giọng nói"}
              </div>
              {phase === "recording" && <div className={styles.micTimer}>00:{String(seconds).padStart(2, "0")}</div>}
              {(transcript || interim) && (
                <div className={styles.transcript}>
                  {transcript}
                  {interim && <span className={styles.transcriptInterim}> {interim}</span>}
                </div>
              )}
              {!supported && (
                <div className={styles.warn}>
                  Trình duyệt này chưa hỗ trợ nhận diện giọng nói. Hãy mở app bằng <b>Chrome</b> hoặc <b>Edge</b> để luyện nói (bạn vẫn có thể nghe mẫu và bỏ qua từng câu).
                </div>
              )}
              {toast && <div className={styles.warn}>{toast}</div>}
            </div>
          )}
        </div>

        <aside className={styles.side}>
          <div className={styles.sideCard}>
            <div className={styles.sideTitle}>Hướng dẫn nhanh</div>
            <div className={styles.sideList}>
              <div><b>1.</b>Chọn vai muốn đóng</div>
              <div><b>2.</b>Nghe máy đọc câu</div>
              <div><b>3.</b>Bấm micro và đọc to</div>
              <div><b>4.</b>Xem điểm &amp; mẹo cải thiện</div>
              <div><b>5.</b>Nói lại hoặc tiếp tục</div>
            </div>
          </div>
          <div className={styles.sideCard}>
            <div className={styles.sideTitle}>Phím tắt</div>
            <div className={styles.sideList}>
              <div><b>Space</b>Ghi âm / Dừng</div>
              <div><b>R</b>Nghe lại câu</div>
              <div><b>P</b>Tạm dừng</div>
              <div><b>M</b>Âm thanh</div>
              <div><b>T</b>Hiện/Ẩn nghĩa</div>
            </div>
          </div>
          <div className={styles.sideCard}>
            <div className={styles.sideTitle}>Lịch sử phiên này</div>
            {history.length === 0 ? (
              <div className={styles.sideList}>Chưa có kết quả.</div>
            ) : (
              <div className={styles.history}>
                {history.map((h, i) => (
                  <div key={i} className={styles.historyItem}>
                    <span>Câu {h.index + 1}{h.attempt > 1 ? ` (lần ${h.attempt})` : ""}</span>
                    <b style={{ color: scoreMeta(h.score).color }}>{h.score}%</b>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {phase === "result" && result && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <div className={styles.modalTitle}>Kết quả câu {index + 1}</div>
            <div
              className={styles.scoreRing}
              style={{ background: `conic-gradient(${scoreMeta(result.score).color} ${result.score}%, #ebe4d4 ${result.score}%)` }}
            >
              <div className={styles.scoreInner}>{result.score}%</div>
            </div>
            <span className={styles.scoreLabel} style={{ color: scoreMeta(result.score).color, background: scoreMeta(result.score).soft }}>
              {scoreMeta(result.score).label}
            </span>
            <p className={styles.modalText}>{result.note}</p>
            <div className={styles.compare}>
              <div><small>Câu mẫu</small>{line.lineEn}</div>
              <div><small>Máy nghe được</small>{result.transcript}</div>
            </div>
            <div className={styles.chipsRow}>
              {line.lineEn.split(/\s+/).map((raw, i) => {
                const clean = raw.replace(/[^a-zA-Z0-9'’]/g, "").toLowerCase();
                const missed = clean && result.missing.includes(clean.replace(/’/g, "'"));
                return (
                  <span key={i} className={`${styles.wordChip} ${missed ? styles.wordMiss : styles.wordMatch}`}>{raw}</span>
                );
              })}
              {result.extra.map((w) => (
                <span key={`x-${w}`} className={`${styles.wordChip} ${styles.wordExtra}`}>+{w}</span>
              ))}
            </div>
            <ul className={styles.tips}>
              {result.tips.map((t) => <li key={t}>{t}</li>)}
            </ul>
            <div className={styles.centerRow}>
              <button type="button" className={styles.softBtn} onClick={retry}>🔁 Nói lại</button>
              <button type="button" className={styles.primaryBtn} onClick={keepAndContinue}>Tiếp tục →</button>
            </div>
          </div>
        </div>
      )}

      {phase === "done" && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <div className={styles.modalTitle}>🎉 Hoàn thành hội thoại!</div>
            <div
              className={styles.scoreRing}
              style={{ background: `conic-gradient(#168a67 ${summary.avg}%, #ebe4d4 ${summary.avg}%)` }}
            >
              <div className={styles.scoreInner}>{summary.avg}%</div>
            </div>
            <span className={styles.scoreLabel} style={{ color: "#168a67", background: "#e9f8f2" }}>ĐIỂM TRUNG BÌNH</span>
            <p className={styles.modalText}>
              {summary.practiced === 0 ? "Bạn chưa chấm điểm câu nào — hãy thử nói lần sau nhé!"
                : summary.avg >= 85 ? "Xuất sắc! Bạn giao tiếp rất tự tin và rõ ràng."
                  : summary.avg >= 70 ? "Tốt lắm. Hãy luyện lại những câu dưới 70% để tăng độ trôi chảy."
                    : "Bạn đã hoàn thành. Hãy luyện lại các câu yếu để tiến bộ hơn."}
            </p>
            <div className={styles.finalGrid}>
              <div><small>Câu đã luyện</small><strong>{summary.practiced} / {userLines}</strong></div>
              <div><small>Tổng lượt nói</small><strong>{summary.tries}</strong></div>
              <div><small>Câu ≥ 80%</small><strong>{summary.good}</strong></div>
              <div><small>Câu &lt; 70%</small><strong>{summary.weak}</strong></div>
            </div>
            <div className={styles.centerRow}>
              <button type="button" className={styles.primaryBtn} onClick={() => start()}>↻ Luyện lại</button>
              <button type="button" className={styles.softBtn} onClick={() => start(partner)}>🎭 Đổi vai ({partner})</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
