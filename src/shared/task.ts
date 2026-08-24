import { z } from "zod";

export const reminderOffsets = [
  "none",
  "one-day",
  "one-hour",
  "thirty-minutes",
  "fifteen-minutes",
  "at-time",
] as const;

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
  dueAt: z.string().datetime({ offset: true }),
  reminder: z.enum(reminderOffsets),
  recurrence: recurrenceRuleSchema,
  completed: z.boolean(),
  completedAt: z.string().datetime({ offset: true }).optional(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export const taskFileSchema = z.object({
  version: z.literal(1),
  tasks: z.array(taskInstanceSchema),
});

export type ReminderOffset = (typeof reminderOffsets)[number];
export type RecurrenceRule = z.infer<typeof recurrenceRuleSchema>;
export type TaskInstance = z.infer<typeof taskInstanceSchema>;
export type QuadrantKey = "do-now" | "schedule" | "delegate" | "eliminate";

export function quadrantFor(task: Pick<TaskInstance, "important" | "urgent">): QuadrantKey {
  if (task.important && task.urgent) return "do-now";
  if (task.important && !task.urgent) return "schedule";
  if (!task.important && task.urgent) return "delegate";
  return "eliminate";
}

export function sortTasks(tasks: TaskInstance[]): TaskInstance[] {
  return [...tasks].sort((left, right) => {
    const dueDifference = Date.parse(left.dueAt) - Date.parse(right.dueAt);
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
  return !task.completed && Date.parse(task.dueAt) < now.getTime();
}

export function toDatetimeLocal(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) + "T" + pad(date.getHours()) + ":" + pad(date.getMinutes());
}

export function fromDatetimeLocal(value: string): string {
  return new Date(value).toISOString();
}

export function nextDueAt(task: Pick<TaskInstance, "dueAt" | "recurrence">): string | undefined {
  const current = new Date(task.dueAt);
  const recurrence = task.recurrence;
  if (recurrence.type === "none") return undefined;
  if (recurrence.type === "daily") {
    current.setDate(current.getDate() + 1);
    return current.toISOString();
  }
  if (recurrence.type === "weekly") {
    const weekdays = new Set(recurrence.weekdays);
    for (let offset = 1; offset <= 7; offset += 1) {
      const candidate = new Date(current);
      candidate.setDate(current.getDate() + offset);
      if (weekdays.has(candidate.getDay())) return candidate.toISOString();
    }
  }
  if (recurrence.type === "monthly") {
    current.setMonth(current.getMonth() + 1, recurrence.dayOfMonth);
    return current.toISOString();
  }
  return undefined;
}
