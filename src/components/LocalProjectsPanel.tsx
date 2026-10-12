"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, Download, FolderOpen, HardDrive, LoaderCircle, Save, Search, Trash2, Upload } from "lucide-react";
import { nanoid } from "nanoid";

import ActionButton from "@/components/ActionButton";
import ErrorBox from "@/components/ErrorBox";
import { deleteLocalProject, listLocalProjects, saveLocalProject } from "@/lib/local-project-store";
import type { LocalProjectRecord, LocalProjectSnapshot } from "@/types/local-project";

const BACKUP_FORMAT = "leste-audio-ia-local-project";
const MAX_IMPORT_BYTES = 100 * 1024 * 1024;

function downloadProject(project: LocalProjectRecord) {
  const backup = { format: BACKUP_FORMAT, version: 1, ...project };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${project.name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "projeto-leste-audio-ia"}.leste.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function LocalProjectsPanel({
  captureSnapshot,
  restoreSnapshot,
  onActiveProjectChange,
}: {
  captureSnapshot: () => Promise<LocalProjectSnapshot>;
  restoreSnapshot: (snapshot: LocalProjectSnapshot) => Promise<void>;
  onActiveProjectChange: (project: Pick<LocalProjectRecord, "id" | "name"> | null) => void;
}) {
  const [projects, setProjects] = useState<LocalProjectRecord[]>([]);
  const [activeProject, setActiveProject] = useState<Pick<LocalProjectRecord, "id" | "name"> | null>(null);
  const [projectName, setProjectName] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const backupInputRef = useRef<HTMLInputElement>(null);

  async function refreshProjects() {
    try {
      setProjects(await listLocalProjects());
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível ler os projetos locais.");
    }
  }

  useEffect(() => {
    void refreshProjects();
  }, []);

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    if (!query) return projects;
    return projects.filter((project) => {
      const snapshotText = `${project.name} ${JSON.stringify(project.snapshot.editorial?.sources.map((source) => source.name) ?? [])}`;
      return snapshotText.toLocaleLowerCase("pt-BR").includes(query);
    });
  }, [projects, search]);

  async function handleSave(asNew = false) {
    const name = projectName.trim();
    if (!name) {
      setError("Dê um nome ao projeto para encontrá-lo depois.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const existing = !asNew && activeProject ? projects.find((project) => project.id === activeProject.id) : undefined;
      const now = new Date().toISOString();
      const record: LocalProjectRecord = {
        id: existing?.id ?? nanoid(),
        name,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        snapshot: await captureSnapshot(),
      };
      await saveLocalProject(record);
      setActiveProject({ id: record.id, name: record.name });
      onActiveProjectChange({ id: record.id, name: record.name });
      await refreshProjects();
      setNotice("Projeto salvo neste navegador. Os áudios originais não foram armazenados.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar o projeto local.");
    } finally {
      setBusy(false);
    }
  }

  async function handleOpen(project: LocalProjectRecord) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await restoreSnapshot(project.snapshot);
      setActiveProject({ id: project.id, name: project.name });
      onActiveProjectChange({ id: project.id, name: project.name });
      setProjectName(project.name);
      setNotice(`Projeto “${project.name}” aberto. Os áudios originais precisam ser enviados novamente para reprodução ou nova transcrição.`);
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "Não foi possível abrir o projeto local.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(project: LocalProjectRecord) {
    if (!window.confirm(`Apagar o projeto local “${project.name}”? Esta ação não pode ser desfeita.`)) return;
    try {
      await deleteLocalProject(project.id);
      if (activeProject?.id === project.id) {
        setActiveProject(null);
        onActiveProjectChange(null);
      }
      await refreshProjects();
      setNotice(`Projeto “${project.name}” apagado deste navegador.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Não foi possível apagar o projeto.");
    }
  }

  async function handleImport(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error("O backup excede o limite de 100 MB.");
      const parsed = JSON.parse(await file.text()) as Partial<LocalProjectRecord> & { format?: string; version?: number };
      if (parsed.format !== BACKUP_FORMAT || parsed.version !== 1 || typeof parsed.id !== "string" || typeof parsed.name !== "string" || !parsed.snapshot || parsed.snapshot.version !== 1) {
        throw new Error("Este arquivo não é um backup de projeto local compatível.");
      }
      const imported = parsed as LocalProjectRecord & { format: string; version: number };
      const record: LocalProjectRecord = {
        id: nanoid(),
        name: imported.name.slice(0, 200),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        snapshot: imported.snapshot,
      };
      await saveLocalProject(record);
      await restoreSnapshot(record.snapshot);
      setActiveProject({ id: record.id, name: record.name });
      onActiveProjectChange({ id: record.id, name: record.name });
      setProjectName(record.name);
      await refreshProjects();
      setNotice(`Backup de “${record.name}” importado e aberto.`);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Não foi possível importar o backup.");
    } finally {
      setBusy(false);
      if (backupInputRef.current) backupInputRef.current.value = "";
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-blue-100 bg-white p-4 shadow-editorial sm:p-5" id="workflow-local-projects">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-leste-blue"><HardDrive aria-hidden="true" className="h-5 w-5" /></span>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-leste-blue">Projetos neste computador</p>
          <h2 className="mt-1 text-lg font-black text-slate-950">Salve e retome pelo nome</h2>
          <p className="mt-1 text-sm leading-5 text-slate-600">Transcrições, documentos extraídos, análises, capítulos e revisões ficam neste navegador. Áudios e arquivos originais não são guardados.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <label className="text-xs font-bold text-slate-600">Nome do projeto
          <input className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm font-normal text-slate-950 focus:border-leste-blue focus:outline-none focus:ring-2 focus:ring-blue-100" onChange={(event) => setProjectName(event.currentTarget.value)} placeholder="Ex.: Biografia de Maria Silva" value={projectName} />
        </label>
        <div className="flex items-end"><ActionButton disabled={busy} fullWidth={false} loading={busy} onClick={() => void handleSave()} type="button" variant="primary"><Save className="h-4 w-4" /> {activeProject ? "Atualizar projeto" : "Salvar projeto local"}</ActionButton></div>
        {activeProject ? <div className="flex items-end"><ActionButton disabled={busy} fullWidth={false} onClick={() => void handleSave(true)} type="button" variant="ghost"><Archive className="h-4 w-4" /> Salvar como novo</ActionButton></div> : null}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="min-h-11 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm text-slate-950 focus:border-leste-blue focus:outline-none focus:ring-2 focus:ring-blue-100" onChange={(event) => setSearch(event.currentTarget.value)} placeholder="Buscar por projeto ou nome de fonte" type="search" value={search} />
        </label>
        <input accept=".json,.leste.json,application/json" className="hidden" onChange={(event) => void handleImport(event.currentTarget.files?.[0])} ref={backupInputRef} type="file" />
        <ActionButton disabled={busy} fullWidth={false} onClick={() => backupInputRef.current?.click()} type="button" variant="ghost"><Upload className="h-4 w-4" /> Importar backup</ActionButton>
      </div>

      {error ? <ErrorBox message={error} /> : null}
      {notice ? <p aria-live="polite" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{notice}</p> : null}

      {filteredProjects.length ? (
        <ul className="grid gap-2 md:grid-cols-2">
          {filteredProjects.map((project) => (
            <li className={`rounded-xl border p-3 ${activeProject?.id === project.id ? "border-leste-blue bg-blue-50/50" : "border-slate-200 bg-slate-50/60"}`} key={project.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="break-words text-sm font-black text-slate-900">{project.name}</p>
                  <p className="mt-1 text-xs text-slate-500">Atualizado em {new Date(project.updatedAt).toLocaleString("pt-BR")} · {project.snapshot.savedAudioItems.length} áudio(s)</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1">
                  <ActionButton disabled={busy} fullWidth={false} onClick={() => void handleOpen(project)} type="button" variant="secondary"><FolderOpen className="h-4 w-4" /> Abrir</ActionButton>
                  <ActionButton fullWidth={false} onClick={() => downloadProject(project)} type="button" variant="ghost" title="Baixar backup"><Download className="h-4 w-4" /><span className="sr-only">Baixar backup</span></ActionButton>
                  <ActionButton fullWidth={false} onClick={() => void handleDelete(project)} type="button" variant="danger" title="Apagar projeto"><Trash2 className="h-4 w-4" /><span className="sr-only">Apagar projeto</span></ActionButton>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">{projects.length ? "Nenhum projeto corresponde à busca." : "Nenhum projeto salvo neste navegador ainda."}</p>
      )}
      {busy ? <p aria-live="polite" className="flex items-center gap-2 text-xs text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" /> Salvando ou abrindo projeto…</p> : null}
    </section>
  );
}
