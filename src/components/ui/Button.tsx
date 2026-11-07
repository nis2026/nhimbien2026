import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "outline";

const variantClasses: Record<Variant, string> = {
  primary:
    "gold-gradient text-brown font-semibold shadow-md shadow-champagne/30 hover:brightness-105 active:brightness-95",
  secondary: "bg-brown text-ivory font-semibold hover:bg-caramel",
  outline:
    "border-2 border-champagne text-caramel font-semibold bg-white hover:bg-ivory",
  ghost: "text-caramel font-medium hover:bg-ivory",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export function Button({ variant = "primary", className = "", ...props }: Props) {
  return (
    <button
      className={`px-5 py-2.5 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
