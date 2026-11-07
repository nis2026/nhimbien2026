/**
 * Link YouTube video bài học theo đúng thứ tự Unit.
 * Để trống ("") nếu chưa có video -- giao diện sẽ tự xử lý (không hiển thị khung video).
 *
 * Nguồn: playlist "STARTER LION" (kênh Leo English)
 * https://www.youtube.com/playlist?list=PLMOVA7nGvE3A — khớp theo tên bài
 * (số UNIT trên video là số thứ tự trong khóa Starter đầy đủ, khớp tương ứng với khóa học).
 */
export const videoLinksByUnit: Record<number, string> = {
  1: "https://youtu.be/No_ZL_y2iIw", // UNIT 02: INTRODUCING YOURSELF
  2: "https://youtu.be/b6FBatT8u8o", // UNIT 07: DAILY ACTIVITIES
  3: "https://youtu.be/YflQguSXckU", // UNIT 08: FREE TIME AND HOBBIES
  4: "https://youtu.be/fesOB-8pW_o", // UNIT 11: SHOPPING AND ASKING FOR PRICES
  5: "https://youtu.be/HiWq5tICFT4", // UNIT 12: AT THE COFFEE SHOP
  6: "https://youtu.be/O9Ukl1SuwDU", // UNIT 13: MAKING A RESERVATION AT A RESTAURANT
  7: "https://youtu.be/OxjUWCqhvsE", // UNIT 17: AT THE SUPERMARKET
  8: "https://youtu.be/YvDbjJvNrNk", // UNIT 18: AT THE RESTAURANT
  9: "https://youtu.be/CPaupmRkb98", // UNIT 09: YES/NO & WH- QUESTIONS
  10: "https://youtu.be/O7DpC3JDUlg", // UNIT 05: EXPRESSING EMOTIONS
  11: "https://youtu.be/aBI2pAn6-vE", // UNIT 15: AT THE AIRPORT
  12: "https://youtu.be/aAPl3-YPqD8", // UNIT 17: FRIENDSHIP & SOCIAL CONNECTION
  13: "https://youtu.be/Ocry094aoew", // UNIT 05: OCCUPATIONS
  14: "https://youtu.be/wjF0qCzJYJA", // UNIT 06: ASKING FOR AND GIVING DIRECTIONS
  15: "https://youtu.be/6p32GcV921I", // UNIT 09: VEGETABLES AND FRUITS
  16: "https://youtu.be/obWTUC-iYbY", // UNIT 10: EATING HABITS
  17: "https://youtu.be/KBqRv7J3SOs", // UNIT 14: COMMUNICATION VIA PHONE
  18: "https://youtu.be/MumIOK2k0Dw", // UNIT 15: BASIC TRANSPORTATION
  19: "https://youtu.be/7hwT97dJYqc", // UNIT 16: TRAVELING
  20: "https://youtu.be/fvQoeFmBqsk", // UNIT 19: SPORTS AND OUTDOOR ACTIVITIES
  21: "https://youtu.be/l-ORGD35hTw", // UNIT 20: WEEKEND PLANS
  22: "https://youtu.be/9iSfQoHYyj4", // UNIT 21: SAYING THANK YOU AND APOLOGIZING
  23: "https://youtu.be/qa27a0gs1DY", // UNIT 22: SHOPPING FOR CLOTHES
  24: "https://youtu.be/RTJDRWny5HU", // UNIT 23: HANGING OUT WITH FRIENDS
  25: "https://youtu.be/nAu49TAmygw", // UNIT 24: AT THE PARTY
};

export function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{6,})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}
