"use client";

import { useEffect, useMemo, useState } from "react";
import type { VocabWord } from "@/types";
import { shuffle, pickDistractors } from "@/lib/gameUtils";
import { speak } from "@/lib/tts";
import { updateUnitProgress, getUnitProgress } from "@/lib/storage";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";

type Props = {
  vocabulary: VocabWord[];
  unitSlug: string;
  profileId: string;
};

const ROUND_SIZE = 10;

type Round = {
  word: VocabWord;
  options: string[];
  correctIndex: number;
};

function buildRounds(vocabulary: VocabWord[]): Round[] {
  const words = vocabulary.map((w) => w.word);
  return shuffle(vocabulary)
    .slice(0, Math.min(ROUND_SIZE, vocabulary.length))
    .map((word) => {
      const distractors = pickDistractors(words, word.word, 3);
      const options = shuffle([word.word, ...distractors]);
      return { word, options, correctIndex: options.indexOf(word.word) };
    });
}

export function ListenChooseGame({ vocabulary, unitSlug, profileId }: Props) {
  const rounds = useMemo(() => buildRounds(vocabulary), [vocabulary]);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const current = rounds[step];

  useEffect(() => {
    if (current) speak(current.word.word, { audioUrl: current.word.audioWord });
  }, [current]);

  function handleAnswer(i: number) {
    if (selected !== null) return;
    setSelected(i);
    if (i === current.correctIndex) setScore((s) => s + 1);
  }

  function handleNext() {
    if (step + 1 >= rounds.length) {
      const pct = Math.round((score / rounds.length) * 100);
      const prev = getUnitProgress(profileId, unitSlug);
      updateUnitProgress(profileId, unitSlug, {
        listenGameBestScore: Math.max(prev.listenGameBestScore ?? 0, pct),
      });
      setFinished(true);
      return;
    }
    setStep((s) => s + 1);
    setSelected(null);
  }

  if (finished) {
    const pct = Math.round((score / rounds.length) * 100);
    return (
      <Card className="p-8 text-center space-y-4">
        <p className="text-3xl">🎧</p>
        <p className="text-xl font-bold text-brown">
          Bạn nghe đúng {score}/{rounds.length} từ ({pct}%)
        </p>
        <Button onClick={() => window.location.reload()}>Chơi lại</Button>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-5">
      <ProgressBar percent={(step / rounds.length) * 100} label={`Câu ${step + 1}/${rounds.length}`} size="sm" />

      <div className="text-center space-y-3">
        <p className="text-xs text-caramel">Nghe và chọn từ đúng</p>
        <button
          onClick={() => speak(current.word.word, { audioUrl: current.word.audioWord })}
          className="mx-auto flex items-center justify-center w-16 h-16 rounded-full gold-gradient text-2xl shadow-md hover:scale-105 transition"
        >
          🔊
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
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
              className={`px-4 py-3 rounded-xl border-2 font-medium transition ${style}`}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {selected !== null && (
        <div className="flex justify-end">
          <Button onClick={handleNext}>{step + 1 >= rounds.length ? "Xem kết quả" : "Câu tiếp →"}</Button>
        </div>
      )}
    </Card>
  );
}
