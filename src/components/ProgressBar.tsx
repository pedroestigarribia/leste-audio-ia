"use client";

type ProgressBarProps = {
  value: number;
  label?: string;
};

export default function ProgressBar({ value, label }: ProgressBarProps) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div className="space-y-2">
      {label ? <p className="text-sm font-medium text-slate-700">{label}</p> : null}
      <div className="h-3 overflow-hidden rounded-full bg-blue-100">
        <div
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={safeValue}
          className="h-full rounded-full bg-gradient-to-r from-leste-blue via-blue-700 to-leste-gold transition-all duration-300"
          role="progressbar"
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}
