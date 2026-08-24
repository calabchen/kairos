import { create } from "zustand";
import { nextDueAt, taskFileSchema, type TaskInstance } from "../../shared/task";

const STORAGE_KEY = "kairos.tasks.v1";

type TaskStore = {
  tasks: TaskInstance[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  addTask: (task: TaskInstance) => Promise<void>;
  updateTask: (id: string, changes: Partial<TaskInstance>) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  completeTask: (id: string) => Promise<void>;
  clearCompleted: () => Promise<void>;
};

function hasElectronApi(): boolean {
  return typeof window !== "undefined" && typeof window.kairos?.loadTasks === "function";
}

function readBrowserTasks(): TaskInstance[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? taskFileSchema.parse(JSON.parse(raw)).tasks : [];
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

async function persist(tasks: TaskInstance[]) {
  if (hasElectronApi()) {
    await window.kairos.saveTasks(tasks);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, tasks }));
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  hydrated: false,
  hydrate: async () => {
    try {
      const tasks = hasElectronApi() ? (await window.kairos.loadTasks()).tasks : readBrowserTasks();
      set({ tasks, hydrated: true });
    } catch {
      set({ tasks: [], hydrated: true });
    }
  },
  addTask: async (task) => {
    const tasks = [...get().tasks, task];
    await persist(tasks);
    set({ tasks });
  },
  updateTask: async (id, changes) => {
    const now = new Date().toISOString();
    const tasks = get().tasks.map((task) => task.id === id ? { ...task, ...changes, updatedAt: now } : task);
    await persist(tasks);
    set({ tasks });
  },
  removeTask: async (id) => {
    const tasks = get().tasks.filter((task) => task.id !== id);
    await persist(tasks);
    set({ tasks });
  },
  completeTask: async (id) => {
    const now = new Date().toISOString();
    const current = get().tasks.find((task) => task.id === id);
    if (!current) return;
    const completed = { ...current, completed: true, completedAt: now, updatedAt: now };
    const dueAt = nextDueAt(current);
    const next = dueAt ? {
      ...current,
      id: crypto.randomUUID(),
      seriesId: current.seriesId ?? current.id,
      dueAt,
      completed: false,
      completedAt: undefined,
      createdAt: now,
      updatedAt: now,
    } : undefined;
    const tasks = get().tasks.map((task) => task.id === id ? completed : task);
    if (next) tasks.push(next);
    await persist(tasks);
    set({ tasks });
  },
  clearCompleted: async () => {
    const tasks = get().tasks.filter((task) => !task.completed);
    await persist(tasks);
    set({ tasks });
  },
}));
