import { create } from "zustand";
import type { CourseId, Profile, Role } from "@/types";
import {
  getProfiles,
  createProfile as createProfileStorage,
  deleteProfile as deleteProfileStorage,
  setProfileEmail as setProfileEmailStorage,
  setProfileRole as setProfileRoleStorage,
  getCurrentProfileId,
  setCurrentProfileId,
  clearCurrentProfile,
  getSelectedCourseId,
  setSelectedCourseId as setSelectedCourseIdStorage,
  setCloudUserId,
  pullUnitLocksFromCloud,
  pullCloudProfileAndProgress,
} from "@/lib/storage";
import { isSupabaseConfigured, getSupabaseBrowserClient } from "@/lib/supabase/client";

type AppState = {
  profiles: Profile[];
  currentProfile: Profile | null;
  hydrated: boolean;
  selectedCourseId: CourseId;
  hydrate: () => void;
  /**
   * Background refresh for an already-hydrated screen: re-checks the Supabase
   * session (so writes on this tab sync to the cloud), pulls the shared
   * unit-lock table, and — if this profile is cloud-linked — its latest
   * progress from another device, then re-reads localStorage into state.
   */
  syncFromCloud: () => Promise<void>;
  /**
   * Bumped whenever the class-wide unit-lock cache changes, so every screen that
   * calls `isUnitUnlocked()` during render re-renders with the admin's latest state.
   */
  unitLocksVersion: number;
  /** Re-reads the shared unit-lock table; cheap enough to call on every realtime event / poll tick. */
  refreshUnitLocks: () => Promise<void>;
  selectProfile: (id: string) => void;
  addProfile: (name: string, avatar: Profile["avatar"], email?: string, id?: string) => Profile;
  removeProfile: (id: string) => void;
  setProfileEmail: (id: string, email: string) => void;
  setProfileRole: (id: string, role: Role) => void;
  setSelectedCourseId: (id: CourseId) => void;
  logout: () => void;
};

export const useAppStore = create<AppState>((set, get) => ({
  profiles: [],
  currentProfile: null,
  hydrated: false,
  selectedCourseId: "starter",
  unitLocksVersion: 0,

  hydrate: () => {
    const profiles = getProfiles();
    const currentId = getCurrentProfileId();
    const currentProfile = profiles.find((p) => p.id === currentId) ?? null;
    set({ profiles, currentProfile, hydrated: true, selectedCourseId: getSelectedCourseId() });
  },

  syncFromCloud: async () => {
    if (!isSupabaseConfigured()) return;
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Unit locks are class-wide and world-readable — worth refreshing even
      // for a signed-out/demo browser, so a student sees the admin's latest unlocks.
      if (await pullUnitLocksFromCloud()) set({ unitLocksVersion: get().unitLocksVersion + 1 });

      const currentProfile = get().currentProfile;
      if (user && currentProfile?.id === user.id) {
        setCloudUserId(user.id);
        await pullCloudProfileAndProgress(user.id);
      }

      get().hydrate();
    } catch (e) {
      console.error("[cloud-sync] syncFromCloud failed:", e);
    }
  },

  refreshUnitLocks: async () => {
    if (await pullUnitLocksFromCloud()) set({ unitLocksVersion: get().unitLocksVersion + 1 });
  },

  setSelectedCourseId: (id: CourseId) => {
    setSelectedCourseIdStorage(id);
    set({ selectedCourseId: id });
  },

  selectProfile: (id: string) => {
    setCurrentProfileId(id);
    const profile = get().profiles.find((p) => p.id === id) ?? null;
    set({ currentProfile: profile });
  },

  addProfile: (name: string, avatar: Profile["avatar"], email?: string, id?: string) => {
    const profile = createProfileStorage(name, avatar, email, id);
    set({ profiles: getProfiles(), currentProfile: profile });
    return profile;
  },

  removeProfile: (id: string) => {
    deleteProfileStorage(id);
    const profiles = getProfiles();
    const currentProfile = get().currentProfile?.id === id ? null : get().currentProfile;
    set({ profiles, currentProfile });
  },

  setProfileEmail: (id: string, email: string) => {
    setProfileEmailStorage(id, email);
    const profiles = getProfiles();
    const currentProfile = get().currentProfile?.id === id
      ? profiles.find((p) => p.id === id) ?? null
      : get().currentProfile;
    set({ profiles, currentProfile });
  },

  setProfileRole: (id: string, role: Role) => {
    setProfileRoleStorage(id, role);
    const profiles = getProfiles();
    const currentProfile = get().currentProfile?.id === id
      ? profiles.find((p) => p.id === id) ?? null
      : get().currentProfile;
    set({ profiles, currentProfile });
  },

  logout: () => {
    clearCurrentProfile();
    set({ currentProfile: null });
  },
}));
