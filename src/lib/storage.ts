import type { CourseId, Profile, Role, UnitProgress, VocabProgress } from "@/types";
import { isAdminEmail } from "./adminConfig";
import {
  fetchCloudProfile,
  pushCloudProfile,
  pushCloudProfileRole,
  fetchCloudUnitProgress,
  pushCloudUnitProgress,
  fetchCloudVocabProgress,
  pushCloudVocabProgress,
  fetchCloudUnitLocks,
  pushCloudUnitLocks,
} from "./supabase/sync";

const PROFILES_KEY = "vip_nhim_bien_profiles";
const CURRENT_PROFILE_KEY = "vip_nhim_bien_current_profile";
const UNIT_LOCKS_KEY = "vip_nhim_bien_unit_locks";
const SELECTED_COURSE_KEY = "vip_nhim_bien_selected_course";
const progressKey = (profileId: string) => `vip_nhim_bien_progress_${profileId}`;

/** Bài học đầu tiên mở khóa ngay; các bài còn lại chờ admin mở khóa dần theo buổi học. */
const DEFAULT_UNLOCKED_SLUGS = ["unit-01"];

type ProgressState = {
  units: Record<string, UnitProgress>;
  vocab: Record<string, VocabProgress>;
};

function isBrowser() {
  return typeof window !== "undefined";
}

function readJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage full or unavailable — fail silently, progress just won't persist
  }
}

/**
 * Set once a Google-authenticated Supabase session resolves (profile.id === auth
 * user id in that case). While set, every write below also fires an async,
 * best-effort push to the cloud so other devices can pick it up. Demo-mode
 * profiles (no Supabase configured) never set this, so they stay local-only.
 */
let cloudUserId: string | null = null;

export function setCloudUserId(id: string | null) {
  cloudUserId = id;
}

export function getCloudUserId(): string | null {
  return cloudUserId;
}

/** Hồ sơ tạo trước khi có tính năng role sẽ không có field role -> mặc định "student". */
function normalizeProfile(profile: Profile): Profile {
  return { ...profile, role: profile.role ?? "student" };
}

export function getProfiles(): Profile[] {
  return readJson<Profile[]>(PROFILES_KEY, []).map(normalizeProfile);
}

export function getProfileByEmail(email: string): Profile | null {
  const target = email.trim().toLowerCase();
  return getProfiles().find((p) => p.email?.toLowerCase() === target) ?? null;
}

export function upsertLocalProfile(profile: Profile) {
  const profiles = getProfiles().filter((p) => p.id !== profile.id);
  profiles.push(profile);
  writeJson(PROFILES_KEY, profiles);
}

/**
 * Re-keys a local-only profile (created before cloud sync existed, or while
 * offline) onto the Supabase auth user id, carrying its progress along, then
 * pushes both up to the cloud. After this, `newId` is the profile's permanent
 * id on every device.
 */
export async function migrateProfileToCloudId(oldProfile: Profile, newId: string): Promise<Profile> {
  const migrated: Profile = { ...oldProfile, id: newId };
  const progress = getProgressState(oldProfile.id);

  const profiles = getProfiles().filter((p) => p.id !== oldProfile.id);
  profiles.push(migrated);
  writeJson(PROFILES_KEY, profiles);
  saveProgressState(newId, progress);
  if (isBrowser()) window.localStorage.removeItem(progressKey(oldProfile.id));
  if (getCurrentProfileId() === oldProfile.id) setCurrentProfileId(newId);

  await pushCloudProfile(migrated);
  await Promise.all(
    Object.entries(progress.units).map(([slug, up]) => pushCloudUnitProgress(newId, slug, up))
  );
  await Promise.all(
    Object.entries(progress.vocab).map(([key, vp]) => {
      const [slug, wordNoStr] = key.split(":");
      return pushCloudVocabProgress(newId, slug, Number(wordNoStr), vp);
    })
  );

  return migrated;
}

/**
 * `id` is passed explicitly for Google-authenticated profiles — it must equal
 * the Supabase auth user id so cloud rows (keyed by that id) line up across
 * every device that signs in with the same Google account. Demo-mode profiles
 * omit it and get a random local-only id as before.
 */
export function createProfile(
  name: string,
  avatar: Profile["avatar"],
  email?: string,
  id?: string
): Profile {
  const trimmedEmail = email?.trim() || undefined;
  const profile: Profile = {
    id: id ?? `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim() || "Học viên",
    avatar,
    email: trimmedEmail,
    role: isAdminEmail(trimmedEmail) ? "admin" : "student",
    createdAt: new Date().toISOString(),
  };
  const profiles = getProfiles();
  profiles.push(profile);
  writeJson(PROFILES_KEY, profiles);
  setCurrentProfileId(profile.id);
  if (id) void pushCloudProfile(profile);
  return profile;
}

export function deleteProfile(id: string) {
  const profiles = getProfiles().filter((p) => p.id !== id);
  writeJson(PROFILES_KEY, profiles);
  if (isBrowser()) {
    window.localStorage.removeItem(progressKey(id));
    if (getCurrentProfileId() === id) {
      window.localStorage.removeItem(CURRENT_PROFILE_KEY);
    }
  }
}

/** Gán/cập nhật email cho hồ sơ đã tạo trước đó — tự nâng lên admin nếu email khớp ADMIN_EMAIL. */
export function setProfileEmail(id: string, email: string): Profile | null {
  const profiles = getProfiles();
  const target = profiles.find((p) => p.id === id);
  if (!target) return null;
  target.email = email.trim() || undefined;
  target.role = isAdminEmail(target.email) ? "admin" : "student";
  writeJson(PROFILES_KEY, profiles);
  if (id === cloudUserId) void pushCloudProfile(target);
  return target;
}

export function setProfileRole(id: string, role: Role): Profile | null {
  const profiles = getProfiles();
  const target = profiles.find((p) => p.id === id);
  if (!target) return null;
  target.role = role;
  writeJson(PROFILES_KEY, profiles);
  // Admins can change ANY profile's role (their own session pushes it, RLS allows
  // an admin to update other rows) — not gated on id === cloudUserId like other writes.
  void pushCloudProfileRole(id, role);
  return target;
}

export function getCurrentProfileId(): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(CURRENT_PROFILE_KEY);
}

export function setCurrentProfileId(id: string) {
  if (!isBrowser()) return;
  window.localStorage.setItem(CURRENT_PROFILE_KEY, id);
}

export function clearCurrentProfile() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(CURRENT_PROFILE_KEY);
  setCloudUserId(null);
}

function defaultUnitProgress(): UnitProgress {
  return {
    vocabViewedCount: 0,
    vocabMasteredCount: 0,
    dialogueOpened: false,
    dialogueTurnsRead: 0,
    videoWatched: false,
    matchGameBestScore: null,
    listenGameBestScore: null,
    quizBestScore: null,
  };
}

function defaultVocabProgress(): VocabProgress {
  return {
    seen: false,
    starred: false,
    quizCorrectCount: 0,
    quizAttemptCount: 0,
    lastReviewedAt: null,
  };
}

function getProgressState(profileId: string): ProgressState {
  return readJson<ProgressState>(progressKey(profileId), { units: {}, vocab: {} });
}

function saveProgressState(profileId: string, state: ProgressState) {
  writeJson(progressKey(profileId), state);
}

export function getUnitProgress(profileId: string, unitSlug: string): UnitProgress {
  const state = getProgressState(profileId);
  return state.units[unitSlug] ?? defaultUnitProgress();
}

export function updateUnitProgress(
  profileId: string,
  unitSlug: string,
  patch: Partial<UnitProgress>
): UnitProgress {
  const state = getProgressState(profileId);
  const current = state.units[unitSlug] ?? defaultUnitProgress();
  const next = { ...current, ...patch };
  state.units[unitSlug] = next;
  saveProgressState(profileId, state);
  if (profileId === cloudUserId) void pushCloudUnitProgress(profileId, unitSlug, next);
  return next;
}

export function getVocabProgress(profileId: string, unitSlug: string, wordNo: number): VocabProgress {
  const state = getProgressState(profileId);
  return state.vocab[`${unitSlug}:${wordNo}`] ?? defaultVocabProgress();
}

export function getAllVocabProgress(profileId: string): Record<string, VocabProgress> {
  return getProgressState(profileId).vocab;
}

export function markVocabSeen(profileId: string, unitSlug: string, wordNo: number) {
  const state = getProgressState(profileId);
  const key = `${unitSlug}:${wordNo}`;
  const current = state.vocab[key] ?? defaultVocabProgress();
  if (!current.seen) {
    current.seen = true;
    current.lastReviewedAt = new Date().toISOString();
    state.vocab[key] = current;
    saveProgressState(profileId, state);

    const unitState = state.units[unitSlug] ?? defaultUnitProgress();
    const seenCount = Object.keys(state.vocab).filter(
      (k) => k.startsWith(`${unitSlug}:`) && state.vocab[k].seen
    ).length;
    unitState.vocabViewedCount = seenCount;
    state.units[unitSlug] = unitState;
    saveProgressState(profileId, state);

    if (profileId === cloudUserId) {
      void pushCloudVocabProgress(profileId, unitSlug, wordNo, current);
      void pushCloudUnitProgress(profileId, unitSlug, unitState);
    }
  }
}

export function toggleVocabStar(profileId: string, unitSlug: string, wordNo: number): boolean {
  const state = getProgressState(profileId);
  const key = `${unitSlug}:${wordNo}`;
  const current = state.vocab[key] ?? defaultVocabProgress();
  current.starred = !current.starred;
  state.vocab[key] = current;
  saveProgressState(profileId, state);
  if (profileId === cloudUserId) void pushCloudVocabProgress(profileId, unitSlug, wordNo, current);
  return current.starred;
}

export function recordVocabQuizAnswer(
  profileId: string,
  unitSlug: string,
  wordNo: number,
  correct: boolean
) {
  const state = getProgressState(profileId);
  const key = `${unitSlug}:${wordNo}`;
  const current = state.vocab[key] ?? defaultVocabProgress();
  current.quizAttemptCount += 1;
  if (correct) current.quizCorrectCount += 1;
  current.lastReviewedAt = new Date().toISOString();
  state.vocab[key] = current;

  const mastered = Object.keys(state.vocab).filter(
    (k) => k.startsWith(`${unitSlug}:`) && state.vocab[k].quizCorrectCount >= 2
  ).length;
  const unitState = state.units[unitSlug] ?? defaultUnitProgress();
  unitState.vocabMasteredCount = mastered;
  state.units[unitSlug] = unitState;

  saveProgressState(profileId, state);

  if (profileId === cloudUserId) {
    void pushCloudVocabProgress(profileId, unitSlug, wordNo, current);
    void pushCloudUnitProgress(profileId, unitSlug, unitState);
  }
}

export function getStarredWords(profileId: string): string[] {
  const state = getProgressState(profileId);
  return Object.entries(state.vocab)
    .filter(([, v]) => v.starred)
    .map(([key]) => key);
}

/**
 * Khóa/mở bài học là cài đặt chung của cả lớp — được lưu trên bảng
 * `nhim_bien_unit_locks` (đọc công khai, chỉ admin ghi được) nên đồng bộ thật giữa
 * mọi thiết bị/trình duyệt, không còn là "giả lập theo trình duyệt" như trước.
 * localStorage vẫn giữ vai trò cache để hiển thị ngay lập tức trước khi kịp
 * pull từ cloud (xem `pullUnitLocksFromCloud`).
 */
export function getUnitLocks(): Record<string, boolean> {
  return readJson<Record<string, boolean>>(UNIT_LOCKS_KEY, {});
}

export function isUnitUnlocked(slug: string): boolean {
  const locks = getUnitLocks();
  if (Object.prototype.hasOwnProperty.call(locks, slug)) return locks[slug];
  return DEFAULT_UNLOCKED_SLUGS.includes(slug);
}

/**
 * Admin writes go to the server FIRST and only land in the local cache once the
 * server accepted them — so the admin page never shows "unlocked" for a lesson
 * students can't actually open. Returns the server error message, or null.
 */
async function writeUnitLocks(changes: Record<string, boolean>): Promise<string | null> {
  const toUnlock = Object.keys(changes).filter((s) => changes[s]);
  const toLock = Object.keys(changes).filter((s) => !changes[s]);
  const errors = await Promise.all([pushCloudUnitLocks(toUnlock, true), pushCloudUnitLocks(toLock, false)]);
  const error = errors.find((e) => e) ?? null;
  if (error) return error;
  writeJson(UNIT_LOCKS_KEY, { ...getUnitLocks(), ...changes });
  return null;
}

export function setUnitLocked(slug: string, unlocked: boolean): Promise<string | null> {
  return writeUnitLocks({ [slug]: unlocked });
}

export function setAllUnitsLocked(slugs: string[], unlocked: boolean): Promise<string | null> {
  return writeUnitLocks(Object.fromEntries(slugs.map((s) => [s, unlocked])));
}

export function resetUnitLocksToDefault(slugs: string[]): Promise<string | null> {
  return writeUnitLocks(Object.fromEntries(slugs.map((s) => [s, DEFAULT_UNLOCKED_SLUGS.includes(s)])));
}

/** Khóa học đang được chọn để xem trên dashboard/danh sách bài/game (chung cho trình duyệt này). */
export function getSelectedCourseId(): CourseId {
  return readJson<CourseId>(SELECTED_COURSE_KEY, "starter");
}

export function setSelectedCourseId(id: CourseId) {
  writeJson(SELECTED_COURSE_KEY, id);
}

/**
 * Pulls this Google user's cloud profile + progress into localStorage (writing
 * under `profile.id` = the Supabase auth user id) so the rest of the app's
 * synchronous reads see it immediately. Returns null if this user has no cloud
 * profile yet (first-ever sign-in on any device) — caller falls back to the
 * avatar-picker flow to create one.
 */
export async function pullCloudProfileAndProgress(userId: string): Promise<Profile | null> {
  const profile = await fetchCloudProfile(userId);
  if (!profile) return null;

  upsertLocalProfile(profile);

  const [units, vocab] = await Promise.all([
    fetchCloudUnitProgress(userId),
    fetchCloudVocabProgress(userId),
  ]);
  saveProgressState(userId, { units, vocab });

  return profile;
}

/**
 * Replaces the local cache with the shared class-wide unit-lock table (the server
 * is the single source of truth — slugs with no row fall back to
 * DEFAULT_UNLOCKED_SLUGS). Keeps the cache untouched if the server can't be read.
 * Returns true when the lock state actually changed. Safe to call for anyone.
 */
export async function pullUnitLocksFromCloud(): Promise<boolean> {
  const cloudLocks = await fetchCloudUnitLocks();
  if (!cloudLocks) return false;
  const before = JSON.stringify(getUnitLocks());
  writeJson(UNIT_LOCKS_KEY, cloudLocks);
  return JSON.stringify(cloudLocks) !== before;
}
