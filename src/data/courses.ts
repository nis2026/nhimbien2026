import type { CourseId } from "@/types";

export type Course = {
  id: CourseId;
  title: string;
  subtitleVi: string;
  icon: string;
};

export const courses: Course[] = [
  {
    id: "starter",
    title: "Khóa Starter",
    subtitleVi: "Tiếng Anh giao tiếp hằng ngày — kèm 1-1 cùng Mr. Leo",
    icon: "🦁",
  },
];

export function getCourse(id: CourseId): Course {
  return courses.find((c) => c.id === id) ?? courses[0];
}
