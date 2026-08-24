import { create } from "zustand";
import { nextDueAt, taskFileSchema, type TaskInstance } from "../../shared/task";

const STORAGE_KEY = "kairos.tasks.v1";

type TaskStore = {
  tasks: TaskInstance[];
  hydrated: boolean;
  hydrate: () => void;
  addTask: (task: TaskInstance) => void;
  updateTask: (id: string, changes: Partial<TaskInstance>) => void;
  removeTask: (id: string) => void;
  completeTask: (id: string) => void;
  clearCompleted: () => void;
};

function persist(tasks: TaskInstance[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, tasks }));
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  hydrated: false,
  hydrate: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return set({ hydrated: true });
      const parsed = taskFileSchema.parse(JSON.parse(raw));
      set({ tasks: parsed.tasks, hydrated: true });
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      set({ hydrated: true });
    }
  },
  addTask: (task) => {
    const tasks = [...get().tasks, task];
    persist(tasks);
    set({ tasks });
  },
  updateTask: (id, changes) => {
    const now = new Date().toISOString();
    const tasks = get().tasks.map((task) => task.id === id ? { ...task, ...changes, updatedAt: now } : task);
    persist(tasks);
    set({ tasks });
  },
  removeTask: (id) => {
    const tasks = get().tasks.filter((task) => task.id !== id);
    persist(tasks);
    set({ tasks });
  },
  completeTask: (id) => {
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
    persist(tasks);
    set({ tasks });
  },
  clearCompleted: () => {
    const tasks = get().tasks.filter((task) => !task.completed);
    persist(tasks);
    set({ tasks });
  },
}));
