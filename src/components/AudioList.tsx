"use client";

import AudioCard from "@/components/AudioCard";
import EmptyState from "@/components/EmptyState";
import type { AudioContentKind, AudioItem } from "@/types/audio";

type AudioListProps = {
  activeSpeechKey: string | null;
  copiedKey: string | null;
  items: AudioItem[];
  loadingMap: Record<string, boolean>;
  audioPreviewUrls: Record<string, string>;
  onCopyAll: (itemId: string) => void;
  onCopyOrganized: (itemId: string) => void;
  onCopySummary: (itemId: string) => void;
  onCopyTranscription: (itemId: string) => void;
  onCopy: (key: string, text: string) => void;
  onDownloadDocx: (itemId: string) => void;
  onDownloadSpeech: (key: string, label: string) => void;
  onExecutePrompt: (itemId: string, prompt: string) => Promise<string>;
  onAnalyzeAudio: (itemId: string) => void;
  onGenerateAudioContent: (itemId: string, kind: AudioContentKind) => void;
  onOrganize: (itemId: string) => void;
  onRemove: (itemId: string) => void;
  onRetry: (itemId: string) => void;
  onSummarize: (itemId: string) => void;
  onRenameSpeaker: (itemId: string, speakerId: string, label: string) => void;
  onSpeakAdvanced: (key: string, title: string, text: string) => void;
  onStopSpeech: () => void;
  speechAudioUrls: Record<string, string | undefined>;
  speechErrors: Record<string, string | undefined>;
  taskErrors: Record<string, string | undefined>;
};

const activeStatuses = new Set(["uploading", "converting", "transcribing"]);
const audioContentKinds: AudioContentKind[] = [
  "article",
  "businessPlan",
  "copy",
  "marketingStrategy",
  "post",
  "script",
  "storytelling",
  "whatsapp",
  "audiobookOutline",
];

function isValidationError(message?: string) {
  return Boolean(
    message &&
      (message.startsWith("Formato não suportado") || message.startsWith("Arquivo acima do limite")),
  );
}

export default function AudioList({
  activeSpeechKey,
  copiedKey,
  items,
  loadingMap,
  audioPreviewUrls,
  onCopyAll,
  onCopyOrganized,
  onCopySummary,
  onCopyTranscription,
  onCopy,
  onDownloadDocx,
  onDownloadSpeech,
  onExecutePrompt,
  onAnalyzeAudio,
  onGenerateAudioContent,
  onOrganize,
  onRemove,
  onRetry,
  onSummarize,
  onRenameSpeaker,
  onSpeakAdvanced,
  onStopSpeech,
  speechAudioUrls,
  speechErrors,
  taskErrors,
}: AudioListProps) {
  if (!items.length) {
    return <EmptyState />;
  }

  return (
    <div className="grid gap-5">
      {items.map((item) => (
        <AudioCard
          activeSpeechKey={activeSpeechKey}
          audioIntelligenceError={taskErrors[`intelligence:${item.id}`]}
          audioPreviewUrl={audioPreviewUrls[item.id]}
          contentError={audioContentKinds
            .map((kind) => taskErrors[`audio-content:${item.id}:${kind}`])
            .find(Boolean)}
          copiedKey={copiedKey}
          disableRemove={activeStatuses.has(item.status)}
          disableRetry={
            loadingMap[`summary:${item.id}`] ||
            loadingMap[`organize:${item.id}`] ||
            loadingMap[`intelligence:${item.id}`] ||
            loadingMap[`intent:${item.id}`]
          }
          isAutoProcessing={Boolean(
            loadingMap[`summary:${item.id}`] ||
              loadingMap[`organize:${item.id}`] ||
              loadingMap[`intelligence:${item.id}`] ||
              loadingMap[`intent:${item.id}`],
          )}
          isOrganizeLoading={Boolean(loadingMap[`organize:${item.id}`])}
          isOrganizedSpeechLoading={Boolean(loadingMap[`speech:advanced:${item.id}:organized`])}
          isSummaryLoading={Boolean(loadingMap[`summary:${item.id}`])}
          isSummarySpeechLoading={Boolean(loadingMap[`speech:advanced:${item.id}:summary`])}
          isAudioIntelligenceLoading={Boolean(loadingMap[`intelligence:${item.id}`])}
          item={item}
          key={item.id}
          loadingAudioContentKind={audioContentKinds.find(
            (kind) => loadingMap[`audio-content:${item.id}:${kind}`],
          )}
          onAnalyzeAudio={() => onAnalyzeAudio(item.id)}
          onCopyAll={() => onCopyAll(item.id)}
          onCopy={onCopy}
          onCopyOrganized={() => onCopyOrganized(item.id)}
          onCopySummary={() => onCopySummary(item.id)}
          onCopyTranscription={() => onCopyTranscription(item.id)}
          onDownloadDocx={() => onDownloadDocx(item.id)}
          onDownloadSpeech={onDownloadSpeech}
          onExecutePrompt={(prompt) => onExecutePrompt(item.id, prompt)}
          onOrganize={() => onOrganize(item.id)}
          onGenerateAudioContent={(kind) => onGenerateAudioContent(item.id, kind)}
          onRemove={() => onRemove(item.id)}
          onRetry={() => onRetry(item.id)}
          onSummarize={() => onSummarize(item.id)}
          onRenameSpeaker={(speakerId, label) => onRenameSpeaker(item.id, speakerId, label)}
          onSpeakAdvanced={onSpeakAdvanced}
          onStopSpeech={onStopSpeech}
          organizeError={taskErrors[`organize:${item.id}`]}
          intentError={taskErrors[`intent:${item.id}`]}
          showRetry={item.status === "error" && !isValidationError(item.error)}
          summaryError={taskErrors[`summary:${item.id}`]}
          speechAudioUrls={speechAudioUrls}
          speechErrors={speechErrors}
        />
      ))}
    </div>
  );
}
