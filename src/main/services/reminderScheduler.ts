import { Notification } from "electron";
import type { ReminderOffset, TaskInstance } from "../../shared/task";

const reminderMilliseconds: Record<Exclude<ReminderOffset, "none">, number> = {
  "one-day": 24 * 60 * 60 * 1000,
  "one-hour": 60 * 60 * 1000,
  "thirty-minutes": 30 * 60 * 1000,
  "fifteen-minutes": 15 * 60 * 1000,
  "at-time": 0,
};

export class ReminderScheduler {
  private static readonly maxTimerDelay = 2_147_000_000;
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private tasks: TaskInstance[] = [];

  reschedule(tasks: TaskInstance[]) {
    this.tasks = tasks;
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();

    if (!Notification.isSupported()) return;
    for (const task of tasks) {
      if (task.completed || task.reminder === "none") continue;
      const triggerAt = Date.parse(task.dueAt) - reminderMilliseconds[task.reminder];
      const delay = triggerAt - Date.now();
      if (delay <= 0) continue;
      this.schedule(task.id, delay);
    }
  }

  dispose() {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }

  private notify(taskId: string) {
    this.timers.delete(taskId);
    const task = this.tasks.find((item) => item.id === taskId);
    if (!task || task.completed || task.reminder === "none") return;
    new Notification({
      title: "Kairos 提醒",
      body: task.title + " · " + formatDue(task.dueAt),
    }).show();
  }

  private schedule(taskId: string, delay: number) {
    const timer = setTimeout(() => {
      const task = this.tasks.find((item) => item.id === taskId);
      if (!task || task.completed || task.reminder === "none") return;
      const remaining = Date.parse(task.dueAt) - reminderMilliseconds[task.reminder] - Date.now();
      if (remaining > 0) {
        this.schedule(taskId, remaining);
      } else {
        this.notify(taskId);
      }
    }, Math.min(delay, ReminderScheduler.maxTimerDelay));
    this.timers.set(taskId, timer);
  }
}

function formatDue(iso: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}
