import { ensureRecurringInstances, type TaskInstance } from "../../shared/task";
import type { ReminderScheduler } from "./reminderScheduler";
import type { TaskFileService } from "./taskFile";

export class TaskRuntime {
  private tasks: TaskInstance[] | null = null;
  private loading: Promise<TaskInstance[]> | null = null;

  constructor(
    private readonly taskFile: Pick<TaskFileService, "load" | "save">,
    private readonly reminderScheduler: Pick<ReminderScheduler, "reschedule" | "dispose">,
  ) {}

  loadAndSchedule(): Promise<TaskInstance[]> {
    if (this.tasks) return Promise.resolve(this.tasks);
    if (this.loading) return this.loading;

    this.loading = this.loadAndScheduleOnce();
    return this.loading.finally(() => {
      this.loading = null;
    });
  }

  async persist(tasks: TaskInstance[]): Promise<void> {
    await this.taskFile.save(tasks);
    this.tasks = tasks;
    this.reminderScheduler.reschedule(tasks);
  }

  private async loadAndScheduleOnce(): Promise<TaskInstance[]> {
    try {
      const loaded = await this.taskFile.load();
      const tasks = ensureRecurringInstances(loaded.tasks);
      if (JSON.stringify(tasks) !== JSON.stringify(loaded.tasks)) await this.taskFile.save(tasks);
      this.tasks = tasks;
      this.reminderScheduler.reschedule(tasks);
      return tasks;
    } catch (error) {
      this.tasks = null;
      this.reminderScheduler.dispose();
      throw error;
    }
  }
}
