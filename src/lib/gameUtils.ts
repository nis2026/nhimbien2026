export function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function pickDistractors<T>(pool: T[], exclude: T, count: number): T[] {
  const candidates = shuffle(pool.filter((item) => item !== exclude));
  return candidates.slice(0, count);
}
