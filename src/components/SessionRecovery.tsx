"use client";

import { useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";

import ActionButton from "@/components/ActionButton";
import { deleteLocalProject, getLocalProject, RECOVERY_PROJECT_ID, saveLocalProject } from "@/lib/local-project-store";
import type { LocalProjectRecord, LocalProjectSnapshot } from "@/types/local-project";

export default function SessionRecovery({ captureSnapshot, restoreSnapshot, hasCurrentSession }: {
  captureSnapshot: () => Promise<LocalProjectSnapshot>;
  restoreSnapshot: (snapshot: LocalProjectSnapshot) => Promise<void>;
  hasCurrentSession: boolean;
}) {
  const [ready, setReady] = useState(false);
  const [recovery, setRecovery] = useState<LocalProjectRecord | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const writes = useRef<Promise<void>>(Promise.resolve());
  const saved = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const needsDecision = Boolean(recovery || (!ready && !message));

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (needsDecision && !dialog.open) dialog.showModal();
    if (!needsDecision && dialog.open) dialog.close();
  }, [needsDecision]);

  useEffect(() => {
    let mounted = true;
    void getLocalProject(RECOVERY_PROJECT_ID).then((record) => {
      if (!mounted) return;
      saved.current = Boolean(record);
      setRecovery(record ?? null);
      setReady(true);
    }).catch(() => {
      if (mounted) setMessage("O salvamento automático está indisponível neste navegador. Baixe um backup ou DOCX.");
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!ready || recovery) return;
    const timer = window.setTimeout(() => {
      writes.current = writes.current.then(async () => {
        const snapshot = await captureSnapshot();
        const hasContent = snapshot.savedAudioItems.length > 0 || snapshot.sources.length > 0 ||
          Boolean(snapshot.freeTextValue.trim() || snapshot.contextText.trim() || snapshot.sessionNarrative.trim() ||
            snapshot.promptResult.trim() || Object.values(snapshot.generalResults).some(Boolean) ||
            snapshot.pdf?.text || snapshot.imageText?.text || snapshot.editorial?.title || snapshot.editorial?.subject ||
            snapshot.editorial?.editorialNotes || snapshot.editorial?.collectionGuide || snapshot.editorial?.continuityNotes ||
            snapshot.editorial?.chapterTitle || snapshot.editorial?.followUpQuestions || snapshot.editorial?.qualityReport ||
            snapshot.editorial?.pronunciationNotes || snapshot.editorial?.meetingActions?.length ||
            Object.values(snapshot.editorial?.memory ?? {}).some(Boolean) ||
            Object.values(snapshot.editorial?.sourceGuides ?? {}).some((guide) => guide.question || guide.chapterNumber) ||
            snapshot.editorial?.sources.length || snapshot.editorial?.outline || snapshot.editorial?.meetingReport ||
            Object.keys(snapshot.editorial?.chapters ?? {}).length);
        if (!hasContent) {
          if (saved.current) await deleteLocalProject(RECOVERY_PROJECT_ID);
          saved.current = false;
          return;
        }
        const previous = await getLocalProject(RECOVERY_PROJECT_ID);
        const now = new Date().toISOString();
        await saveLocalProject({
          id: RECOVERY_PROJECT_ID,
          name: "Recuperação automática da sessão",
          createdAt: previous?.createdAt ?? now,
          updatedAt: now,
          snapshot,
        });
        saved.current = true;
        setMessage("Progresso salvo neste navegador. Os arquivos originais não são armazenados.");
      }).catch(() => setMessage("Falha ao salvar o progresso local. Baixe um backup ou DOCX antes de fechar."));
    }, 750);
    return () => window.clearTimeout(timer);
  }, [captureSnapshot, ready, recovery]);

  async function resume() {
    if (!recovery || busy) return;
    if (hasCurrentSession && !window.confirm("Abrir a recuperação substituirá a sessão exibida. Continuar?")) return;
    setBusy(true);
    try {
      await restoreSnapshot(recovery.snapshot);
      setRecovery(null);
      setMessage("Sessão recuperada. Selecione novamente os arquivos pendentes para retomar a fila.");
    } catch {
      setMessage("Não foi possível recuperar a sessão. O salvamento anterior foi mantido.");
    } finally {
      setBusy(false);
    }
  }

  async function discard() {
    if (busy) return;
    if (!window.confirm("Descartar a recuperação automática? Os projetos salvos manualmente não serão apagados.")) return;
    setBusy(true);
    try {
      await deleteLocalProject(RECOVERY_PROJECT_ID);
      saved.current = false;
      setRecovery(null);
      setMessage("Recuperação automática descartada.");
    } catch {
      setMessage("Não foi possível descartar a recuperação automática.");
    } finally {
      setBusy(false);
    }
  }

  async function startNew() {
    if (!recovery || busy) return;
    setBusy(true);
    try {
      await saveLocalProject({
        ...recovery,
        id: nanoid(),
        name: `Recuperação anterior - ${new Date(recovery.updatedAt).toLocaleString("pt-BR")}`,
      });
      setRecovery(null);
      setMessage("A sessão anterior foi guardada em Projetos neste computador. A nova sessão será salva automaticamente.");
    } catch {
      setMessage("Não foi possível guardar a sessão anterior. A recuperação continua disponível.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 text-sm text-slate-700" aria-live="polite">
        <p>{message || (ready ? "O progresso é salvo automaticamente neste navegador; os áudios originais não são armazenados." : "Verificando recuperação local...")}</p>
      </div>
      <dialog ref={dialogRef} onCancel={(event) => event.preventDefault()} aria-labelledby="recovery-title" className="w-[calc(100%-2rem)] max-w-lg rounded-xl bg-white p-5 shadow-xl backdrop:bg-slate-950/60">
        {needsDecision ? <div className="space-y-4">
          <h2 id="recovery-title" className="text-lg font-bold text-slate-950">{recovery ? "Recuperar sessão" : "Verificando sessão local"}</h2>
          {recovery ? <>
            <p className="text-sm leading-6 text-slate-700">Existe uma sessão salva em {new Date(recovery.updatedAt).toLocaleString("pt-BR")} com {recovery.snapshot.savedAudioItems.length} arquivo(s). Escolha o que fazer antes de continuar, para não perder o salvamento automático.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <ActionButton autoFocus disabled={busy} fullWidth onClick={() => void resume()} type="button" variant="secondary">Retomar sessão</ActionButton>
              <ActionButton disabled={busy} fullWidth onClick={() => void startNew()} type="button" variant="primary">Nova sessão, guardar anterior</ActionButton>
              <ActionButton disabled={busy} fullWidth onClick={() => void discard()} type="button" variant="ghost">Descartar recuperação</ActionButton>
            </div>
          </> : <p className="text-sm text-slate-700">Aguarde a verificação do salvamento neste navegador.</p>}
          {recovery && message ? <p role="status" className="text-sm text-slate-700">{message}</p> : null}
        </div> : null}
      </dialog>
    </>
  );
}
