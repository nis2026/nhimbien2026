/**
 * Local pronunciation scoring for the speaking practice — same weighting as
 * the Tuan Tran UNIT nn DIALOGUE.html pages: 55% words said, 30% word order
 * (longest common subsequence), 15% completeness, minus a little for many
 * extra words. Runs entirely in the browser on the speech-recognition transcript.
 */

export type SpeechScore = {
  score: number;
  matched: string[];
  missing: string[];
  extra: string[];
  wordAcc: number;
  sequenceAcc: number;
};

export function normalizeSpeech(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/n't\b/g, " not")
    .replace(/'m\b/g, " am")
    .replace(/'re\b/g, " are")
    .replace(/'s\b/g, " is")
    .replace(/'ll\b/g, " will")
    .replace(/'ve\b/g, " have")
    .replace(/'d\b/g, " would")
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return normalizeSpeech(text).split(" ").filter(Boolean);
}

function lcsLength(a: string[], b: string[]): number {
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

export function scoreSpeech(said: string, target: string): SpeechScore {
  const targetTokens = tokenize(target);
  const userTokens = tokenize(said);
  if (targetTokens.length === 0) {
    return { score: 0, matched: [], missing: [], extra: userTokens, wordAcc: 0, sequenceAcc: 0 };
  }
  const targetSet = new Set(targetTokens);
  const userSet = new Set(userTokens);
  const matched = targetTokens.filter((w) => userSet.has(w));
  const missing = targetTokens.filter((w) => !userSet.has(w));
  const extra = userTokens.filter((w) => !targetSet.has(w));

  const sequenceAcc = lcsLength(targetTokens, userTokens) / targetTokens.length;
  const wordAcc = matched.length / targetTokens.length;
  const completion = Math.min(1, userTokens.length / targetTokens.length);

  let score = Math.round((wordAcc * 0.55 + sequenceAcc * 0.3 + completion * 0.15) * 100);
  score = Math.max(0, Math.min(100, score));
  if (extra.length > targetTokens.length * 0.4) score = Math.max(0, score - 8);

  return {
    score,
    matched: [...new Set(matched)],
    missing: [...new Set(missing)],
    extra: [...new Set(extra)],
    wordAcc: Math.round(wordAcc * 100),
    sequenceAcc: Math.round(sequenceAcc * 100),
  };
}

export function scoreMeta(score: number): { label: string; color: string; soft: string } {
  if (score >= 90) return { label: "XUẤT SẮC", color: "#168a67", soft: "#e9f8f2" };
  if (score >= 75) return { label: "RẤT TỐT", color: "#0f766e", soft: "#e6f6f4" };
  if (score >= 60) return { label: "KHÁ TỐT", color: "#c98c26", soft: "#fff7e6" };
  if (score >= 40) return { label: "CẦN LUYỆN THÊM", color: "#b45309", soft: "#fff3e3" };
  return { label: "HÃY THỬ LẠI", color: "#cf4e5e", soft: "#fff0f2" };
}

export function speechTips(result: SpeechScore): string[] {
  const tips: string[] = [];
  if (result.missing.length > 0) tips.push(`Đừng bỏ từ: ${result.missing.slice(0, 3).join(", ")}.`);
  if (result.extra.length > 2) tips.push("Tránh thêm từ không có trong câu mẫu.");
  if (result.score < 70) tips.push("Đọc chậm hơn và rõ từng từ.");
  if (result.sequenceAcc < 70 && result.wordAcc > 60) tips.push("Giữ đúng thứ tự các từ trong câu.");
  if (tips.length === 0) tips.push("Phát âm rõ ràng và tự nhiên. Tiếp tục duy trì!");
  return tips;
}

export function encouragement(score: number): string {
  if (score >= 90) return "Tuyệt vời! Bạn đã nói gần như hoàn hảo câu này.";
  if (score >= 75) return "Rất tốt! Chỉ cần chỉnh nhẹ một vài từ là đạt xuất sắc.";
  if (score >= 60) return "Khá tốt rồi. Hãy thử nói chậm và rõ hơn một lần nữa.";
  if (score >= 40) return "Bạn đã nắm được phần lớn nội dung. Luyện thêm sẽ tiến bộ nhanh.";
  return "Đừng nản lòng. Nghe lại câu mẫu rồi thử lại nhé!";
}
