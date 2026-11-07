type Props = {
  percent: number;
  label?: string;
  size?: "sm" | "md";
};

export function ProgressBar({ percent, label, size = "md" }: Props) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const height = size === "sm" ? "h-2" : "h-3";

  return (
    <div className="w-full">
      {label && (
        <div className="flex items-center justify-between text-xs text-caramel mb-1">
          <span>{label}</span>
          <span className="font-semibold">{clamped}%</span>
        </div>
      )}
      <div className={`w-full ${height} rounded-full bg-ivory overflow-hidden`}>
        <div
          className={`${height} gold-gradient rounded-full transition-all duration-500`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
