"use client";

import { courses } from "@/data/courses";
import { useAppStore } from "@/store/useAppStore";

export function CourseSwitcher() {
  const { selectedCourseId, setSelectedCourseId } = useAppStore();

  if (courses.length <= 1) return null;

  return (
    <div className="flex gap-2 flex-wrap">
      {courses.map((c) => {
        const active = c.id === selectedCourseId;
        return (
          <button
            key={c.id}
            onClick={() => setSelectedCourseId(c.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition ${
              active
                ? "gold-gradient text-brown border-transparent shadow-sm"
                : "text-caramel border-gold-light/60 hover:bg-ivory"
            }`}
          >
            <span>{c.icon}</span>
            <span>{c.title}</span>
          </button>
        );
      })}
    </div>
  );
}
