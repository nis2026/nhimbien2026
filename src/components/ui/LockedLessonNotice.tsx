import { Card } from "./Card";

export function LockedLessonNotice() {
  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <Card className="flex flex-col items-center gap-3 py-8 px-6">
        <span className="w-14 h-14 rounded-full bg-ivory grid place-items-center text-2xl">🔒</span>
        <h2 className="font-bold text-brown">Bài học chưa được mở khóa</h2>
        <p className="text-sm text-caramel">
          Admin sẽ mở khóa bài này sau mỗi buổi học. Vui lòng quay lại sau nhé.
        </p>
      </Card>
    </div>
  );
}
