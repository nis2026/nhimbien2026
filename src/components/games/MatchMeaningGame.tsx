"use client";

import { useMemo, useState } from "react";
import type { VocabWord } from "@/types";
import { shuffle } from "@/lib/gameUtils";
import { updateUnitProgress, getUnitProgress } from "@/lib/storage";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type Props = {
  vocabulary: VocabWord[];
  unitSlug: string;
  profileId: string;
};

const ROUND_SIZE = 8;

export function MatchMeaningGame({ vocabulary, unitSlug, profileId }: Props) {
  const roundWords = useMemo(
    () => shuffle(vocabulary).slice(0, Math.min(ROUND_SIZE, vocabulary.length)),
    [vocabulary]
  );
  const leftItems = useMemo(() => shuffle(roundWords), [roundWords]);
  const rightItems = useMemo(() => shuffle(roundWords), [roundWords]);

  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [selectedRight, setSelectedRight] = useState<number | null>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [mistakes, setMistakes] = useState(0);
  const [wrongFlash, setWrongFlash] = useState<{ left: number | null; right: number | null }>({
    left: null,
    right: null,
  });
  const [finished, setFinished] = useState(false);

  function trySelect(side: "left" | "right", wordNo: number) {
    if (matched.has(wordNo)) return;

    if (side === "left") {
      setSelectedLeft(wordNo);
      if (selectedRight !== null) evaluate(wordNo, selectedRight);
    } else {
      setSelectedRight(wordNo);
      if (selectedLeft !== null) evaluate(selectedLeft, wordNo);
    }
  }

  function evaluate(leftNo: number, rightNo: number) {
    if (leftNo === rightNo) {
      const next = new Set(matched);
      next.add(leftNo);
      setMatched(next);
      setSelectedLeft(null);
      setSelectedRight(null);
      if (next.size === roundWords.length) {
        finishGame(next.size, mistakes);
      }
    } else {
      setMistakes((m) => m + 1);
      setWrongFlash({ left: leftNo, right: rightNo });
      setTimeout(() => {
        setWrongFlash({ left: null, right: null });
        setSelectedLeft(null);
        setSelectedRight(null);
      }, 500);
    }
  }

  function finishGame(correctCount: number, mistakeCount: number) {
    const accuracy = Math.round((correctCount / (correctCount + mistakeCount)) * 100);
    const prev = getUnitProgress(profileId, unitSlug);
    updateUnitProgress(profileId, unitSlug, {
      matchGameBestScore: Math.max(prev.matchGameBestScore ?? 0, accuracy),
    });
    setFinished(true);
  }

  if (finished) {
    const accuracy = Math.round((roundWords.length / (roundWords.length + mistakes)) * 100);
    return (
      <Card className="p-8 text-center space-y-4">
        <p className="text-3xl">🎉</p>
        <p className="text-xl font-bold text-brown">Hoàn thành! Độ chính xác {accuracy}%</p>
        <p className="text-caramel text-sm">Số lần đoán sai: {mistakes}</p>
        <Button onClick={() => window.location.reload()}>Chơi lại</Button>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex justify-between text-sm text-caramel">
        <span>Ghép từ tiếng Anh với nghĩa tiếng Việt</span>
        <span>Sai: {mistakes}</span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          {leftItems.map((w) => (
            <button
              key={w.no}
              disabled={matched.has(w.no)}
              onClick={() => trySelect("left", w.no)}
              className={`w-full text-left px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition ${
                matched.has(w.no)
                  ? "border-green-400 bg-green-50 opacity-50"
                  : wrongFlash.left === w.no
                  ? "border-red-400 bg-red-50"
                  : selectedLeft === w.no
                  ? "border-gold bg-ivory"
                  : "border-gold-light hover:bg-ivory"
              }`}
            >
              {w.word}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {rightItems.map((w) => (
            <button
              key={w.no}
              disabled={matched.has(w.no)}
              onClick={() => trySelect("right", w.no)}
              className={`w-full text-left px-3 py-2.5 rounded-xl border-2 text-sm transition ${
                matched.has(w.no)
                  ? "border-green-400 bg-green-50 opacity-50"
                  : wrongFlash.right === w.no
                  ? "border-red-400 bg-red-50"
                  : selectedRight === w.no
                  ? "border-gold bg-ivory"
                  : "border-gold-light hover:bg-ivory"
              }`}
            >
              {w.meaningVi}
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}
