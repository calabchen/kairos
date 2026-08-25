import { create } from "zustand";
import { ensureRecurringInstances, nextDueAt, stopRecurringSeries, taskFileSchema, type TaskInstance } from "../../shared/task";

const STORAGE_KEY = "kairos.tasks.v1";

type TaskStore = {
  tasks: TaskInstance[];
  hydrated: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  addTask: (task: TaskInstance) => Promise<void>;
  updateTask: (id: string, changes: Partial<TaskInstance>) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
  removeSeries: (seriesId: string) => Promise<void>;
  updateSeries: (seriesId: string, changes: Partial<TaskInstance>) => Promise<void>;
  stopSeries: (seriesId: string) => Promise<void>;
  completeTask: (id: string) => Promise<void>;
  clearCompleted: () => Promise<void>;
};

type TaskUpdate = (tasks: TaskInstance[]) => TaskInstance[] | Promise<TaskInstance[]>;
let operationQueue = Promise.resolve();

function applyEditableChanges(task: TaskInstance, changes: Partial<TaskInstance>, now: string): TaskInstance {
  const recurrence = changes.recurrence ?? task.recurrence;
  const seriesId = recurrence.type === "none" ? undefined : task.seriesId ?? task.id;
  return {
    ...task,
    title: changes.title ?? task.title,
    important: changes.important ?? task.important,
    urgent: changes.urgent ?? task.urgent,
    dueAt: changes.dueAt ?? task.dueAt,
    reminder: changes.reminder ?? task.reminder,
    recurrence,
    seriesId,
    updatedAt: now,
  };
}

function hasElectronApi(): boolean {
  return typeof window !== "undefined" && typeof window.kairos?.loadTasks === "function";
}

function readBrowserTasks(): TaskInstance[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? taskFileSchema.parse(JSON.parse(raw)).tasks : [];
}

async function persist(tasks: TaskInstance[]) {
  if (hasElectronApi()) {
    await window.kairos.saveTasks(tasks);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, tasks }));
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function enqueue(set: (state: Partial<TaskStore>) => void, get: () => TaskStore, update: TaskUpdate): Promise<void> {
  const operation = operationQueue.then(async () => {
    try {
      const tasks = await update(get().tasks);
      await persist(tasks);
      set({ tasks, error: null });
    } catch (error) {
      set({ error: errorMessage(error, "任务保存失败，请重试") });
    }
  });
  operationQueue = operation.then(() => undefined, () => undefined);
  await operation;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  hydrated: false,
  error: null,
  hydrate: async () => {
    try {
      const tasks = hasElectronApi() ? (await window.kairos.loadTasks()).tasks : readBrowserTasks();
      const normalized = ensureRecurringInstances(tasks);
      set({ tasks: normalized, hydrated: true, error: null });
      if (JSON.stringify(normalized) !== JSON.stringify(tasks)) await persist(normalized);
    } catch (error) {
      set({ hydrated: true, error: errorMessage(error, "任务数据读取失败，请检查本机数据文件") });
    }
  },
  addTask: async (task) => enqueue(set, get, (tasks) => {
    const normalized = task.recurrence.type === "none" ? task : { ...task, seriesId: task.seriesId ?? task.id };
    return [...tasks, normalized];
  }),
  updateTask: async (id, changes) => enqueue(set, get, (tasks) => {
    const now = new Date().toISOString();
    return tasks.map((task) => task.id === id ? applyEditableChanges(task, changes, now) : task);
  }),
  removeTask: async (id) => enqueue(set, get, (tasks) => tasks.filter((task) => task.id !== id)),
  removeSeries: async (seriesId) => enqueue(set, get, (tasks) => tasks.filter((task) => task.completed || task.seriesId !== seriesId)),
  updateSeries: async (seriesId, changes) => enqueue(set, get, (tasks) => {
    const now = new Date().toISOString();
    return tasks.map((task) => task.completed || task.seriesId !== seriesId ? task : applyEditableChanges(task, changes, now));
  }),
  stopSeries: async (seriesId) => enqueue(set, get, (tasks) => stopRecurringSeries(tasks, seriesId)),
  completeTask: async (id) => enqueue(set, get, (tasks) => {
    const now = new Date().toISOString();
    const current = tasks.find((task) => task.id === id);
    if (!current) return tasks;
    const completed = { ...current, completed: true, completedAt: now, updatedAt: now };
    const dueAt = nextDueAt(current);
    const seriesId = current.seriesId ?? (current.recurrence.type === "none" ? undefined : current.id);
    const next = dueAt && !tasks.some((task) => (task.seriesId ?? task.id) === (seriesId ?? "") && task.dueAt === dueAt) ? {
      ...current,
      id: crypto.randomUUID(),
      seriesId,
      dueAt,
      completed: false,
      completedAt: undefined,
      createdAt: now,
      updatedAt: now,
    } : undefined;
    const updated = tasks.map((task) => task.id === id ? completed : task);
    return next ? [...updated, next] : updated;
  }),
  clearCompleted: async () => enqueue(set, get, (tasks) => tasks.filter((task) => !task.completed)),
}));
