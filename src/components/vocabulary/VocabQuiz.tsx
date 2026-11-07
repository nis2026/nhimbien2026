"use client";

import { useMemo, useState } from "react";
import type { VocabWord } from "@/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { shuffle, pickDistractors } from "@/lib/gameUtils";
import { recordVocabQuizAnswer, updateUnitProgress, getUnitProgress } from "@/lib/storage";
import { speak } from "@/lib/tts";

type Props = {
  vocabulary: VocabWord[];
  unitSlug: string;
  profileId: string;
  onFinish?: () => void;
};

type QuizItem = {
  word: VocabWord;
  options: string[];
  correctIndex: number;
};

function buildQuiz(vocabulary: VocabWord[]): QuizItem[] {
  const meanings = vocabulary.map((w) => w.meaningVi);
  return shuffle(vocabulary).map((word) => {
    const distractors = pickDistractors(meanings, word.meaningVi, 3);
    const options = shuffle([word.meaningVi, ...distractors]);
    return { word, options, correctIndex: options.indexOf(word.meaningVi) };
  });
}

export function VocabQuiz({ vocabulary, unitSlug, profileId, onFinish }: Props) {
  const quiz = useMemo(() => buildQuiz(vocabulary), [vocabulary]);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const current = quiz[step];

  function handleAnswer(index: number) {
    if (selected !== null) return;
    setSelected(index);
    const correct = index === current.correctIndex;
    if (correct) setScore((s) => s + 1);
    recordVocabQuizAnswer(profileId, unitSlug, current.word.no, correct);
  }

  function handleNext() {
    if (step + 1 >= quiz.length) {
      const finalScorePct = Math.round((score / quiz.length) * 100);
      const prev = getUnitProgress(profileId, unitSlug);
      updateUnitProgress(profileId, unitSlug, {
        quizBestScore: Math.max(prev.quizBestScore ?? 0, finalScorePct),
      });
      setDone(true);
      onFinish?.();
      return;
    }
    setStep((s) => s + 1);
    setSelected(null);
  }

  if (done) {
    const pct = Math.round((score / quiz.length) * 100);
    return (
      <Card className="p-8 text-center space-y-4">
        <p className="text-3xl">{pct >= 80 ? "🏆" : pct >= 50 ? "👍" : "💪"}</p>
        <p className="text-xl font-bold text-brown">
          Bạn đúng {score}/{quiz.length} câu ({pct}%)
        </p>
        <Button onClick={() => window.location.reload()}>Làm lại quiz</Button>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-5">
      <ProgressBar percent={(step / quiz.length) * 100} label={`Câu ${step + 1}/${quiz.length}`} size="sm" />

      <div className="text-center space-y-2">
        <p className="text-xs text-caramel">Từ này nghĩa là gì?</p>
        <div className="flex items-center justify-center gap-2">
          <p className="text-2xl font-bold text-brown">{current.word.word}</p>
          <button onClick={() => speak(current.word.word, { audioUrl: current.word.audioWord })} className="text-lg">
            🔊
          </button>
        </div>
        <p className="text-sm text-caramel">/{current.word.ipa}/ · {current.word.pos}</p>
      </div>

      <div className="grid gap-2">
        {current.options.map((opt, i) => {
          const isCorrect = i === current.correctIndex;
          const isSelected = i === selected;
          let style = "border-gold-light hover:bg-ivory";
          if (selected !== null) {
            if (isCorrect) style = "border-green-500 bg-green-50";
            else if (isSelected) style = "border-red-400 bg-red-50";
            else style = "border-gold-light/40 opacity-60";
          }
          return (
            <button
              key={i}
              onClick={() => handleAnswer(i)}
              disabled={selected !== null}
              className={`text-left px-4 py-3 rounded-xl border-2 transition ${style}`}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {selected !== null && (
        <div className="flex justify-end">
          <Button onClick={handleNext}>{step + 1 >= quiz.length ? "Xem kết quả" : "Câu tiếp →"}</Button>
        </div>
      )}
    </Card>
  );
}
