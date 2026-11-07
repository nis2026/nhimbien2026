import type { Profile } from "@/types";
import { getProfiles } from "./storage";
import { getMasteredWordCount, getOverallCourseProgress } from "./progress";

export type HonorEntry = {
  profile: Profile;
  masteredWords: number;
  overallPct: number;
};

/**
 * Chế độ demo lưu trên 1 trình duyệt (localStorage), nên bảng vinh danh xếp hạng
 * giữa các hồ sơ học viên đã tạo trên cùng máy này — không phải dữ liệu nhiều thiết bị.
 */
export function getHonorBoard(): HonorEntry[] {
  const profiles = getProfiles();
  return profiles
    .map((profile) => ({
      profile,
      masteredWords: getMasteredWordCount(profile.id),
      overallPct: getOverallCourseProgress(profile.id),
    }))
    .filter((e) => e.overallPct >= 50)
    .sort((a, b) => b.overallPct - a.overallPct || b.masteredWords - a.masteredWords);
}
