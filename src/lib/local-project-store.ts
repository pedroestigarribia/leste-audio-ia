import type { LocalProjectRecord } from "@/types/local-project";

const DATABASE_NAME = "leste-audio-ia-projects";
const DATABASE_VERSION = 1;
const STORE_NAME = "projects";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Este navegador não oferece armazenamento local para projetos."));
      return;
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Não foi possível abrir a biblioteca local."));
    request.onblocked = () => reject(new Error("Feche outras abas do Leste Audio IA e tente novamente."));
  });
}

async function withStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = action(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Falha ao acessar a biblioteca local."));
      transaction.onabort = () => reject(transaction.error ?? new Error("A operação local foi cancelada."));
    });
  } finally {
    database.close();
  }
}

export function listLocalProjects() {
  return withStore<LocalProjectRecord[]>("readonly", (store) => store.getAll()).then((projects) =>
    projects.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
  );
}

export function getLocalProject(id: string) {
  return withStore<LocalProjectRecord | undefined>("readonly", (store) => store.get(id));
}

export function saveLocalProject(project: LocalProjectRecord) {
  return withStore<IDBValidKey>("readwrite", (store) => store.put(project));
}

export function deleteLocalProject(id: string) {
  return withStore<undefined>("readwrite", (store) => store.delete(id));
}
