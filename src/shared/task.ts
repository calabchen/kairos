import { z } from "zod";

export const reminderOffsets = [
  "none",
  "one-day",
  "one-hour",
  "thirty-minutes",
  "fifteen-minutes",
  "at-time",
] as const;

const localDateTimeSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "必须是本地日期和时间").superRefine((value, context) => {
  const parsed = parseLocalDateTime(value);
  if (!Number.isFinite(parsed.getTime()) || formatLocalDateTime(parsed) !== value) {
    context.addIssue({ code: "custom", message: "日期和时间无效" });
  }
});

export const recurrenceRuleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("none") }),
  z.object({ type: z.literal("daily") }),
  z.object({ type: z.literal("weekly"), weekdays: z.array(z.number().int().min(0).max(6)).min(1) }),
  z.object({ type: z.literal("monthly"), dayOfMonth: z.number().int().min(1).max(30) }),
]);

export const taskInstanceSchema = z.object({
  id: z.string().min(1),
  seriesId: z.string().min(1).optional(),
  title: z.string().trim().min(1),
  important: z.boolean(),
  urgent: z.boolean(),
  dueAt: localDateTimeSchema,
  reminder: z.enum(reminderOffsets),
  recurrence: recurrenceRuleSchema,
  completed: z.boolean(),
  completedAt: z.string().datetime({ offset: true }).optional(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
}).superRefine((task, context) => {
  if (task.completed && !task.completedAt) {
    context.addIssue({ code: "custom", path: ["completedAt"], message: "已完成任务必须包含完成时间" });
  }
  if (!task.completed && task.completedAt) {
    context.addIssue({ code: "custom", path: ["completedAt"], message: "未完成任务不能包含完成时间" });
  }
});

export const taskFileSchema = z.object({
  version: z.literal(1),
  tasks: z.array(taskInstanceSchema),
}).superRefine((file, context) => {
  const ids = new Set<string>();
  file.tasks.forEach((task, index) => {
    if (ids.has(task.id)) context.addIssue({ code: "custom", path: ["tasks", index, "id"], message: "任务 ID 必须唯一" });
    ids.add(task.id);
  });
});

export type ReminderOffset = (typeof reminderOffsets)[number];
export type RecurrenceRule = z.infer<typeof recurrenceRuleSchema>;
export type TaskInstance = z.infer<typeof taskInstanceSchema>;
export type QuadrantKey = "do-now" | "schedule" | "delegate" | "eliminate";
export type TaskFile = z.infer<typeof taskFileSchema>;

export function quadrantFor(task: Pick<TaskInstance, "important" | "urgent">): QuadrantKey {
  if (task.important && task.urgent) return "do-now";
  if (task.important && !task.urgent) return "schedule";
  if (!task.important && task.urgent) return "delegate";
  return "eliminate";
}

export function sortTasks(tasks: TaskInstance[]): TaskInstance[] {
  return [...tasks].sort((left, right) => {
    const dueDifference = parseLocalDateTime(left.dueAt).getTime() - parseLocalDateTime(right.dueAt).getTime();
    if (dueDifference !== 0) return dueDifference;
    const createdDifference = Date.parse(left.createdAt) - Date.parse(right.createdAt);
    return createdDifference !== 0 ? createdDifference : left.id.localeCompare(right.id);
  });
}

export function sortCompletedTasks(tasks: TaskInstance[]): TaskInstance[] {
  return [...tasks].sort((left, right) => {
    const completedDifference = Date.parse(right.completedAt ?? "") - Date.parse(left.completedAt ?? "");
    if (completedDifference !== 0) return completedDifference;
    return right.id.localeCompare(left.id);
  });
}

export function isOverdue(task: Pick<TaskInstance, "dueAt" | "completed">, now = new Date()): boolean {
  return !task.completed && parseLocalDateTime(task.dueAt).getTime() < now.getTime();
}

export function parseLocalDateTime(value: string): Date {
  const [date, time] = value.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

export function seriesIdForTask(task: Pick<TaskInstance, "id" | "seriesId" | "recurrence">): string | undefined {
  return task.recurrence.type === "none" ? undefined : task.seriesId ?? task.id;
}

export function normalizeRecurringTasks(tasks: TaskInstance[]): TaskInstance[] {
  return tasks.map((task) => {
    const seriesId = seriesIdForTask(task);
    if (task.recurrence.type === "none") {
      return task.seriesId ? { ...task, seriesId: undefined } : task;
    }
    return seriesId === task.seriesId ? task : { ...task, seriesId };
  });
}

export function stopRecurringSeries(tasks: TaskInstance[], seriesId: string, updatedAt = new Date().toISOString()): TaskInstance[] {
  return tasks.map((task) => task.completed || task.seriesId !== seriesId ? task : {
    ...task,
    recurrence: { type: "none" },
    seriesId: undefined,
    updatedAt,
  });
}

function instanceKey(task: Pick<TaskInstance, "id" | "seriesId" | "dueAt">): string {
  return `${task.seriesId ?? task.id}:${task.dueAt}`;
}

export function ensureRecurringInstances(tasks: TaskInstance[], now = new Date()): TaskInstance[] {
  const result = normalizeRecurringTasks(tasks);
  const keys = new Set(result.filter((task) => task.recurrence.type !== "none").map(instanceKey));
  const additions: TaskInstance[] = [];

  for (const source of result.filter((task) => !task.completed && task.recurrence.type !== "none")) {
    let candidate = source;
    let dueAt = nextDueAt(candidate);
    while (dueAt && parseLocalDateTime(dueAt).getTime() <= now.getTime()) {
      const next = {
        ...source,
        id: crypto.randomUUID(),
        seriesId: source.seriesId ?? source.id,
        dueAt,
        completed: false,
        completedAt: undefined,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      } satisfies TaskInstance;
      if (!keys.has(instanceKey(next))) {
        additions.push(next);
        keys.add(instanceKey(next));
      }
      candidate = next;
      dueAt = nextDueAt(candidate);
    }
  }

  return additions.length ? [...result, ...additions] : result;
}

export function formatLocalDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) + "T" + pad(date.getHours()) + ":" + pad(date.getMinutes());
}

export function toDatetimeLocal(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return value;
  return formatLocalDateTime(new Date(value));
}

export function fromDatetimeLocal(value: string): string {
  return value;
}

export function nextDueAt(task: Pick<TaskInstance, "dueAt" | "recurrence">): string | undefined {
  const current = parseLocalDateTime(task.dueAt);
  const recurrence = task.recurrence;
  if (recurrence.type === "none") return undefined;
  if (recurrence.type === "daily") {
    current.setDate(current.getDate() + 1);
    return formatLocalDateTime(current);
  }
  if (recurrence.type === "weekly") {
    const weekdays = new Set(recurrence.weekdays);
    for (let offset = 1; offset <= 7; offset += 1) {
      const candidate = new Date(current);
      candidate.setDate(current.getDate() + offset);
      if (weekdays.has(candidate.getDay())) return formatLocalDateTime(candidate);
    }
  }
  if (recurrence.type === "monthly") {
    const year = current.getFullYear();
    const month = current.getMonth() + 1;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const targetDay = Math.min(recurrence.dayOfMonth, lastDay);
    return formatLocalDateTime(new Date(year, month, targetDay, current.getHours(), current.getMinutes()));
  }
  return undefined;
}
