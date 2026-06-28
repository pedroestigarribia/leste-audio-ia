"use client";

import AudioCard from "@/components/AudioCard";
import EmptyState from "@/components/EmptyState";
import type { AudioItem } from "@/types/audio";

type AudioListProps = {
  copiedKey: string | null;
  items: AudioItem[];
  loadingMap: Record<string, boolean>;
  onCopyAll: (itemId: string) => void;
  onCopyOrganized: (itemId: string) => void;
  onCopySummary: (itemId: string) => void;
  onCopyTranscription: (itemId: string) => void;
  onOrganize: (itemId: string) => void;
  onRemove: (itemId: string) => void;
  onRetry: (itemId: string) => void;
  onSummarize: (itemId: string) => void;
  taskErrors: Record<string, string | undefined>;
};

const activeStatuses = new Set(["uploading", "converting", "transcribing"]);

function isValidationError(message?: string) {
  return Boolean(
    message &&
      (message.startsWith("Formato não suportado") || message.startsWith("Arquivo acima do limite")),
  );
}

export default function AudioList({
  copiedKey,
  items,
  loadingMap,
  onCopyAll,
  onCopyOrganized,
  onCopySummary,
  onCopyTranscription,
  onOrganize,
  onRemove,
  onRetry,
  onSummarize,
  taskErrors,
}: AudioListProps) {
  if (!items.length) {
    return <EmptyState />;
  }

  return (
    <div className="grid gap-5">
      {items.map((item) => (
        <AudioCard
          copiedKey={copiedKey}
          disableRemove={activeStatuses.has(item.status)}
          disableRetry={loadingMap[`summary:${item.id}`] || loadingMap[`organize:${item.id}`]}
          isOrganizeLoading={Boolean(loadingMap[`organize:${item.id}`])}
          isSummaryLoading={Boolean(loadingMap[`summary:${item.id}`])}
          item={item}
          key={item.id}
          onCopyAll={() => onCopyAll(item.id)}
          onCopyOrganized={() => onCopyOrganized(item.id)}
          onCopySummary={() => onCopySummary(item.id)}
          onCopyTranscription={() => onCopyTranscription(item.id)}
          onOrganize={() => onOrganize(item.id)}
          onRemove={() => onRemove(item.id)}
          onRetry={() => onRetry(item.id)}
          onSummarize={() => onSummarize(item.id)}
          organizeError={taskErrors[`organize:${item.id}`]}
          showRetry={item.status === "error" && !isValidationError(item.error)}
          summaryError={taskErrors[`summary:${item.id}`]}
        />
      ))}
    </div>
  );
}
