import { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-white rounded-2xl border border-gold-light/60 shadow-sm shadow-caramel/5 ${className}`}
      {...props}
    />
  );
}
