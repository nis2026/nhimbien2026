"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getUnitsByCourse } from "@/data/units";
import { courses } from "@/data/courses";
import { useAppStore } from "@/store/useAppStore";
import {
  getUnitLocks,
  setUnitLocked,
  setAllUnitsLocked,
  resetUnitLocksToDefault,
  setProfileRole,
} from "@/lib/storage";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { fetchAllCloudProfiles, pushCloudProfileRole } from "@/lib/supabase/sync";
import type { Profile, Role } from "@/types";

export default function AdminPage() {
  // Re-renders on every store change (incl. unitLocksVersion bumps), so reading
  // the lock cache during render always shows the latest server state.
  const { currentProfile, profiles, hydrate, refreshUnitLocks } = useAppStore();
  const locks = getUnitLocks();
  const [cloudProfiles, setCloudProfiles] = useState<Profile[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  // Hiển thị đúng trạng thái trên máy chủ (cái học viên thực sự thấy), không
  // phải bản cache trên máy admin — AppShell cũng tự làm mới khi có thay đổi.
  useEffect(() => {
    void refreshUnitLocks();
    void loadCloudProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Danh sách thật từ máy chủ (mọi học viên đã đăng nhập Google); nếu chưa đọc
  // được thì tạm hiện hồ sơ lưu trên trình duyệt này.
  const studentList = cloudProfiles ?? profiles;

  async function save(write: () => Promise<string | null>) {
    setSaving(true);
    setStatus(null);
    const error = await write();
    setSaving(false);
    setStatus(
      error
        ? { kind: "error", text: `Chưa lưu được lên máy chủ — học viên sẽ KHÔNG thấy thay đổi này. Lỗi: ${error}` }
        : { kind: "ok", text: "Đã lưu — học viên thấy thay đổi ngay." }
    );
  }

  function toggleUnit(slug: string, unlocked: boolean) {
    void save(() => setUnitLocked(slug, unlocked));
  }

  function unlockAll(slugs: string[]) {
    void save(() => setAllUnitsLocked(slugs, true));
  }

  function lockAllExceptFirst(slugs: string[]) {
    void save(() => resetUnitLocksToDefault(slugs));
  }

  async function loadCloudProfiles() {
    const rows = await fetchAllCloudProfiles();
    if (rows) setCloudProfiles(rows);
  }

  async function changeRole(id: string, role: Role) {
    setProfileRole(id, role); // cập nhật cache cục bộ (nếu hồ sơ có trên máy này) + đẩy lên máy chủ
    hydrate();
    // Đợi ghi xong rồi đọc lại danh sách để thấy đúng trạng thái trên máy chủ.
    await pushCloudProfileRole(id, role);
    await loadCloudProfiles();
  }

  if (!currentProfile || currentProfile.role !== "admin") {
    return (
      <div className="max-w-lg mx-auto text-center py-16 text-caramel">
        Bạn không có quyền truy cập trang này.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-brown flex items-center gap-2">🛡️ Quản trị</h1>
        <p className="text-caramel text-sm mt-1">
          Đăng nhập admin: {currentProfile.email ?? currentProfile.name}. Mở khóa bài học theo tiến độ lớp học —
          học viên chỉ thấy được bài đã mở khóa.
        </p>
      </div>

      {status && (
        <div
          role="status"
          className={`text-sm rounded-xl px-4 py-3 border ${
            status.kind === "error"
              ? "border-red-300 bg-red-50 text-red-700"
              : "border-gold-light bg-ivory text-brown"
          }`}
        >
          {status.text}
        </div>
      )}

      {courses.map((course) => {
        const courseUnits = getUnitsByCourse(course.id);
        const slugs = courseUnits.map((u) => u.slug);
        return (
          <Card key={course.id} className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-brown">
                {course.icon} Mở khóa bài học — {course.title}
              </h2>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => unlockAll(slugs)}
                  disabled={saving}
                  className="text-xs px-3 py-1.5"
                >
                  Mở khóa tất cả
                </Button>
                <Button
                  variant="outline"
                  onClick={() => lockAllExceptFirst(slugs)}
                  disabled={saving}
                  className="text-xs px-3 py-1.5"
                >
                  Reset (chỉ mở bài 1)
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {courseUnits.map((u) => {
                const unlocked = locks[u.slug] ?? u.slug === slugs[0];
                return (
                  <div
                    key={u.slug}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-gold-light/60"
                  >
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-caramel bg-ivory px-2 py-0.5 rounded-full mr-2">
                        Bài {u.unitNumber}
                      </span>
                      <span className="text-sm font-medium text-brown">{u.titleVi}</span>
                    </div>
                    <button
                      onClick={() => toggleUnit(u.slug, !unlocked)}
                      disabled={saving}
                      className={`shrink-0 disabled:opacity-50 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition ${
                        unlocked
                          ? "border-gold text-brown bg-ivory"
                          : "border-gold-light/60 text-caramel/70"
                      }`}
                    >
                      {unlocked ? "🔓 Đã mở khóa" : "🔒 Đang khóa"}
                    </button>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}

      <Card className="p-5">
        <h2 className="font-bold text-brown mb-1">
          Hồ sơ học viên {cloudProfiles ? `(${cloudProfiles.length} tài khoản)` : "(trên trình duyệt này)"}
        </h2>
        {!cloudProfiles && (
          <p className="text-xs text-caramel/70 mb-3">
            Chưa đọc được danh sách từ máy chủ — đang hiện hồ sơ lưu trên trình duyệt này.
          </p>
        )}
        {studentList.length === 0 ? (
          <p className="text-sm text-caramel">Chưa có hồ sơ nào.</p>
        ) : (
          <div className="space-y-2">
            {studentList.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 p-2.5 rounded-xl border border-gold-light/60"
              >
                <Image
                  src={`/avatars/${p.avatar}.png`}
                  alt={p.name}
                  width={32}
                  height={32}
                  className="rounded-full shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-brown truncate">{p.name}</p>
                  <p className="text-xs text-caramel/70 truncate">{p.email ?? "Chưa có email"}</p>
                </div>
                <select
                  value={p.role}
                  onChange={(e) => void changeRole(p.id, e.target.value as Role)}
                  className="text-xs border border-gold-light rounded-lg px-2 py-1.5 bg-white shrink-0"
                >
                  <option value="student">Học viên</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
