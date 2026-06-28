"use client";

type ErrorBoxProps = {
  message: string;
  className?: string;
};

export default function ErrorBox({ message, className = "" }: ErrorBoxProps) {
  return (
    <div
      className={[
        "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="alert"
    >
      {message}
    </div>
  );
}
