import type { Profile, Role, UnitProgress, VocabProgress } from "@/types";
import { isSupabaseConfigured, getSupabaseBrowserClient } from "./client";

/**
 * All cloud reads/writes are best-effort: if the migration in
 * supabase/migrations/0001_nhim_bien_schema.sql hasn't been run yet, or the
 * network hiccups, we log and continue — the app must keep working from the
 * local `localStorage` cache in `@/lib/storage` either way.
 */
function logSyncError(context: string, error: unknown) {
  console.error(`[cloud-sync] ${context} failed:`, error);
}

export async function fetchCloudProfile(userId: string): Promise<Profile | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.from("nhim_bien_profiles").select("*").eq("id", userId).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      id: data.id,
      name: data.name,
      avatar: data.avatar,
      email: data.email ?? undefined,
      role: data.role,
      createdAt: data.created_at,
    };
  } catch (e) {
    logSyncError("fetchCloudProfile", e);
    return null;
  }
}

/**
 * Admin-only in practice: RLS (migration 0002) lets only the admin read other
 * users' rows; for anyone else this returns just their own profile.
 * Returns null on failure so the caller can fall back to the local cache.
 */
export async function fetchAllCloudProfiles(): Promise<Profile[] | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("nhim_bien_profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    const profiles: Profile[] = [];
    for (const row of data ?? []) {
      profiles.push({
        id: row.id,
        name: row.name,
        avatar: row.avatar,
        email: row.email ?? undefined,
        role: row.role,
        createdAt: row.created_at,
      });
    }
    return profiles;
  } catch (e) {
    logSyncError("fetchAllCloudProfiles", e);
    return null;
  }
}

export async function pushCloudProfile(profile: Profile): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from("nhim_bien_profiles").upsert({
      id: profile.id,
      name: profile.name,
      avatar: profile.avatar,
      email: profile.email ?? null,
      role: profile.role,
    });
    if (error) throw error;
  } catch (e) {
    logSyncError("pushCloudProfile", e);
  }
}

export async function pushCloudProfileRole(profileId: string, role: Role): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from("nhim_bien_profiles").update({ role }).eq("id", profileId);
    if (error) throw error;
  } catch (e) {
    logSyncError("pushCloudProfileRole", e);
  }
}

export async function fetchCloudUnitProgress(
  userId: string
): Promise<Record<string, UnitProgress>> {
  if (!isSupabaseConfigured()) return {};
  try {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.from("nhim_bien_unit_progress").select("*").eq("user_id", userId);
    if (error) throw error;
    const result: Record<string, UnitProgress> = {};
    for (const row of data ?? []) {
      result[row.unit_slug] = {
        vocabViewedCount: row.vocab_viewed_count,
        vocabMasteredCount: row.vocab_mastered_count,
        dialogueOpened: row.dialogue_opened,
        dialogueTurnsRead: row.dialogue_turns_read,
        videoWatched: row.video_watched,
        matchGameBestScore: row.match_game_best_score,
        listenGameBestScore: row.listen_game_best_score,
        quizBestScore: row.quiz_best_score,
      };
    }
    return result;
  } catch (e) {
    logSyncError("fetchCloudUnitProgress", e);
    return {};
  }
}

export async function pushCloudUnitProgress(
  userId: string,
  unitSlug: string,
  progress: UnitProgress
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from("nhim_bien_unit_progress").upsert({
      user_id: userId,
      unit_slug: unitSlug,
      vocab_viewed_count: progress.vocabViewedCount,
      vocab_mastered_count: progress.vocabMasteredCount,
      dialogue_opened: progress.dialogueOpened,
      dialogue_turns_read: progress.dialogueTurnsRead,
      video_watched: progress.videoWatched,
      match_game_best_score: progress.matchGameBestScore,
      listen_game_best_score: progress.listenGameBestScore,
      quiz_best_score: progress.quizBestScore,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  } catch (e) {
    logSyncError("pushCloudUnitProgress", e);
  }
}

export async function fetchCloudVocabProgress(
  userId: string
): Promise<Record<string, VocabProgress>> {
  if (!isSupabaseConfigured()) return {};
  try {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.from("nhim_bien_vocab_progress").select("*").eq("user_id", userId);
    if (error) throw error;
    const result: Record<string, VocabProgress> = {};
    for (const row of data ?? []) {
      result[`${row.unit_slug}:${row.word_no}`] = {
        seen: row.seen,
        starred: row.starred,
        quizCorrectCount: row.quiz_correct_count,
        quizAttemptCount: row.quiz_attempt_count,
        lastReviewedAt: row.last_reviewed_at,
      };
    }
    return result;
  } catch (e) {
    logSyncError("fetchCloudVocabProgress", e);
    return {};
  }
}

export async function pushCloudVocabProgress(
  userId: string,
  unitSlug: string,
  wordNo: number,
  progress: VocabProgress
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from("nhim_bien_vocab_progress").upsert({
      user_id: userId,
      unit_slug: unitSlug,
      word_no: wordNo,
      seen: progress.seen,
      starred: progress.starred,
      quiz_correct_count: progress.quizCorrectCount,
      quiz_attempt_count: progress.quizAttemptCount,
      last_reviewed_at: progress.lastReviewedAt,
    });
    if (error) throw error;
  } catch (e) {
    logSyncError("pushCloudVocabProgress", e);
  }
}

/**
 * Returns null (not {}) when the read fails, so callers can tell "the class has
 * no unlocks yet" apart from "we couldn't reach the table" and keep their cache
 * in the second case instead of wiping it.
 */
export async function fetchCloudUnitLocks(): Promise<Record<string, boolean> | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.from("nhim_bien_unit_locks").select("*");
    if (error) throw error;
    const result: Record<string, boolean> = {};
    for (const row of data ?? []) result[row.unit_slug] = row.unlocked;
    return result;
  } catch (e) {
    logSyncError("fetchCloudUnitLocks", e);
    return null;
  }
}

function describeError(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}

/**
 * Admin writes are awaited (not fire-and-forget) and return the error message,
 * or null on success — an unlock that only reached the admin's own localStorage
 * is exactly the "admin sees it unlocked, students don't" bug, so the admin page
 * must know when the server rejected it.
 */
export async function pushCloudUnitLocks(slugs: string[], unlocked: boolean): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  if (slugs.length === 0) return null;
  try {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      throw new Error("Phiên đăng nhập Google đã hết hạn — hãy Đăng xuất rồi đăng nhập lại.");
    }
    const now = new Date().toISOString();
    const rows = slugs.map((slug) => ({ unit_slug: slug, unlocked, updated_at: now }));
    // .select() makes PostgREST return the written rows: if RLS silently filtered
    // the write out we get back fewer rows than we sent instead of a false success.
    const { data, error } = await supabase.from("nhim_bien_unit_locks").upsert(rows).select("unit_slug");
    if (error) throw error;
    if ((data ?? []).length !== rows.length) {
      throw new Error("Máy chủ không ghi nhận thay đổi (tài khoản chưa có quyền admin trên Supabase).");
    }
    return null;
  } catch (e) {
    logSyncError("pushCloudUnitLocks", e);
    return describeError(e);
  }
}

/**
 * Fires `onChange` whenever any row of the class-wide lock table changes, so a
 * student's open tab picks up an admin's unlock within about a second. Needs
 * `nhim_bien_unit_locks` in the supabase_realtime publication (migration 0004);
 * callers also poll as a fallback for networks that block websockets.
 */
export function subscribeCloudUnitLocks(onChange: () => void): () => void {
  if (!isSupabaseConfigured()) return () => {};
  const supabase = getSupabaseBrowserClient();
  const channel = supabase
    .channel(`nhim-bien-unit-locks-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "nhim_bien_unit_locks" }, () => onChange())
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
