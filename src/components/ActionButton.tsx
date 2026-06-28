"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  loading?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  fullWidth?: boolean;
};

const variants: Record<NonNullable<ActionButtonProps["variant"]>, string> = {
  primary:
    "bg-leste-blue text-white shadow-lg shadow-blue-950/15 hover:bg-blue-950 disabled:bg-blue-900/60",
  secondary:
    "bg-leste-gold text-slate-950 hover:bg-amber-300 disabled:bg-amber-200 disabled:text-slate-500",
  ghost:
    "border border-blue-200 bg-white text-leste-blue hover:border-leste-blue hover:bg-blue-50 disabled:text-slate-400",
  danger:
    "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:text-red-300",
};

export default function ActionButton({
  children,
  className = "",
  disabled,
  fullWidth = false,
  loading = false,
  variant = "primary",
  ...props
}: ActionButtonProps) {
  return (
    <button
      className={[
        "inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-leste-blue/50 disabled:cursor-not-allowed",
        variants[variant],
        fullWidth ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled || loading}
      {...props}
    >
      <span className="inline-flex items-center gap-2">
        {loading ? <span className="h-2 w-2 animate-pulse rounded-full bg-current" /> : null}
        {children}
      </span>
    </button>
  );
}
