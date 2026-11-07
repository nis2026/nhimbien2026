"use client";

import { useEffect, useState } from "react";
import type { DialogueTurn } from "@/types";
import { speak } from "@/lib/tts";
import { updateUnitProgress, getUnitProgress } from "@/lib/storage";
import { Button } from "@/components/ui/Button";

type Props = {
  turns: DialogueTurn[];
  contextVi: string;
  unitSlug: string;
  profileId: string;
};

function highlightBold(text: string, boldWords: string[]) {
  if (boldWords.length === 0) return text;
  const pattern = boldWords
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  if (!pattern) return text;
  const regex = new RegExp(`(${pattern})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    boldWords.some((w) => w.toLowerCase() === part.toLowerCase()) ? (
      <strong key={i} className="text-brown bg-gold-light/70 px-1 rounded">
        {part}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export function DialogueViewer({ turns, contextVi, unitSlug, profileId }: Props) {
  const [completed, setCompleted] = useState(
    () => getUnitProgress(profileId, unitSlug).dialogueTurnsRead >= turns.length
  );

  useEffect(() => {
    const existing = getUnitProgress(profileId, unitSlug);
    if (!existing.dialogueOpened) {
      updateUnitProgress(profileId, unitSlug, { dialogueOpened: true });
    }
  }, [profileId, unitSlug]);

  function handleMarkDone() {
    updateUnitProgress(profileId, unitSlug, { dialogueTurnsRead: turns.length });
    setCompleted(true);
  }

  return (
    <div className="space-y-4">
      {contextVi && (
        <div className="bg-ivory rounded-xl p-4 text-sm text-caramel italic">
          🎬 Bối cảnh: {contextVi}
        </div>
      )}

      <div className="space-y-3">
        {turns.map((turn) => {
          // Source dialogues use their own characters (Lan & Nam, Waiter & Lisa…):
          // whoever speaks first sits on the left, the other on the right.
          const isLeft = turn.speaker === turns[0]?.speaker;
          return (
            <div key={turn.no} className={`flex items-start gap-3 ${isLeft ? "" : "flex-row-reverse text-right"}`}>
              <div
                aria-hidden
                className={`rounded-full shrink-0 ring-2 ring-gold-light w-9 h-9 flex items-center justify-center text-sm font-bold ${
                  isLeft ? "bg-ivory text-caramel" : "gold-gradient text-brown"
                }`}
              >
                {turn.speaker.charAt(0).toUpperCase()}
              </div>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 space-y-1 ${
                  isLeft ? "bg-ivory rounded-tl-sm" : "gold-gradient rounded-tr-sm"
                }`}
              >
                <p className="text-xs font-semibold text-caramel/80">{turn.speaker}</p>
                <p className="text-brown font-medium">
                  {highlightBold(turn.lineEn, turn.boldWords)}
                  <button onClick={() => speak(turn.lineEn, { audioUrl: turn.audio })} className="ml-2 text-sm align-middle">
                    🔊
                  </button>
                </p>
                <p className="text-sm text-brown/70">{turn.lineVi}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-center pt-2">
        {completed ? (
          <p className="text-sm text-green-700 font-medium">✅ Bạn đã học xong hội thoại này</p>
        ) : (
          <Button onClick={handleMarkDone}>Đánh dấu đã học xong hội thoại</Button>
        )}
      </div>
    </div>
  );
}
